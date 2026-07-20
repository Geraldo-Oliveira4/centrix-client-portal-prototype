"""Abstract base class for AI-powered document extractors.

Handles document preparation (PDF, images, Excel, plain text) and provides
a structured interface for calling OpenRouter with extraction prompts.
Concrete subclasses implement the extract() method with domain-specific
prompts and schemas (e.g. quotation field extraction, client identification).
"""

import base64
import io
import logging
from abc import ABC, abstractmethod
from typing import Any

import docx
import openpyxl

from shared.services import openrouter_service
from shared.services.extractors.pdf_enhancer import render_and_enhance

logger = logging.getLogger(__name__)


# -- Document part types (mirror OpenRouter message content format) -----------

def text_part(text: str) -> dict:
    return {"type": "text", "text": text}


def image_part(data_url: str) -> dict:
    return {"type": "image_url", "image_url": {"url": data_url}}


def buffer_to_data_url(data: bytes, mime_type: str) -> str:
    b64 = base64.b64encode(data).decode("ascii")
    return f"data:{mime_type};base64,{b64}"


# -- MIME type helpers --------------------------------------------------------

_SPREADSHEET_MIMES = {
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "text/csv",
}

_IMAGE_MIMES = {
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
}

_DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


def _is_spreadsheet(mime_type: str) -> bool:
    return mime_type in _SPREADSHEET_MIMES


def _is_pdf(mime_type: str) -> bool:
    return mime_type == "application/pdf"


def _is_image(mime_type: str) -> bool:
    return mime_type in _IMAGE_MIMES


def _is_docx(mime_type: str) -> bool:
    return mime_type == _DOCX_MIME


# -- Base class ---------------------------------------------------------------

class BaseExtractor(ABC):
    """Abstract extractor that prepares documents and calls OpenRouter."""

    document_type: str
    version: str = "1.0.0"
    temperature: float = 0.1

    def __init__(self, document_type: str):
        self.document_type = document_type

    @abstractmethod
    def extract(self, document_data: bytes, mime_type: str) -> dict[str, Any]:
        """Extract structured data from a document.

        Args:
            document_data: Raw file bytes.
            mime_type: MIME type of the document.

        Returns:
            Dict with extraction results. Shape defined by each subclass.
        """

    # -- Document preparation -------------------------------------------------

    def prepare_document(self, document_data: bytes, mime_type: str) -> list[dict]:
        """Convert raw document bytes into OpenRouter message content parts."""
        if _is_spreadsheet(mime_type):
            return [self._process_spreadsheet(document_data)]

        if _is_pdf(mime_type):
            return self._process_pdf(document_data, mime_type)

        if _is_image(mime_type):
            data_url = buffer_to_data_url(document_data, mime_type)
            return [image_part(data_url)]

        if _is_docx(mime_type):
            return [self._process_docx(document_data)]

        # Default: treat as plain text
        try:
            decoded = document_data.decode("utf-8")
        except UnicodeDecodeError:
            decoded = document_data.decode("latin-1")
        return [text_part(decoded)]

    def _process_pdf(self, data: bytes, mime_type: str) -> list[dict]:
        """Render and enhance PDF pages."""
        pages = render_and_enhance(data)
        return [
            image_part(buffer_to_data_url(page.buffer, page.mime_type))
            for page in pages
        ]

    def _process_spreadsheet(self, data: bytes) -> dict:
        """Convert spreadsheet to text representation."""
        try:
            wb = openpyxl.load_workbook(filename=io.BytesIO(data), read_only=True)
            full_text = ""
            for sheet_name in wb.sheetnames:
                ws = wb[sheet_name]
                rows = list(ws.iter_rows(values_only=True))
                if rows:
                    full_text += f"\n--- SHEET: {sheet_name} ---\n"
                    for row in rows:
                        cells = [str(c) if c is not None else "" for c in row]
                        full_text += ",".join(cells) + "\n"
            wb.close()
            return text_part(full_text or "Empty spreadsheet.")
        except Exception as exc:
            logger.warning("Failed to parse spreadsheet, treating as binary: %s", exc)
            return text_part(f"[Unreadable spreadsheet content: {str(exc)}]")

    def _process_docx(self, data: bytes) -> dict:
        """Convert a Word document to a text representation (paragraphs + tables)."""
        try:
            document = docx.Document(io.BytesIO(data))
            parts: list[str] = [p.text for p in document.paragraphs if p.text.strip()]
            for table in document.tables:
                for row in table.rows:
                    cells = [cell.text.strip() for cell in row.cells]
                    if any(cells):
                        parts.append(" | ".join(cells))
            full_text = "\n".join(parts)
            return text_part(full_text or "Empty document.")
        except Exception as exc:
            logger.warning("Failed to parse docx, treating as binary: %s", exc)
            return text_part(f"[Unreadable docx content: {str(exc)}]")

    # -- OpenRouter call with extraction prompt -------------------------------

    def call_extraction(
        self,
        document_parts: list[dict],
        instructions: str,
        json_schema: dict,
        schema_name: str,
        max_attempts: int = openrouter_service._MAX_ATTEMPTS,
        use_fallback: bool = True,
        timeout: float | None = None,
    ) -> dict[str, Any]:
        """Send document parts + instructions to OpenRouter and return parsed result.

        Args:
            document_parts: Content parts from prepare_document().
            instructions: Extraction prompt.
            json_schema: JSON Schema that the model must follow.
            schema_name: Name for the schema (required by OpenRouter).
            max_attempts: attempts per model (default 3). Sync callers pass 1.
            use_fallback: try the fallback model after the primary fails (default True).
            timeout: per-request HTTP timeout in seconds (None = pool default).

        Returns:
            {"result": <parsed JSON>, "model": <model used>} on success.
            {"result": None, "error": <message>} on failure.
        """
        content = [text_part(instructions)] + document_parts

        response_format = {
            "type": "json_schema",
            "json_schema": {
                "name": schema_name,
                "strict": True,
                "schema": json_schema,
            },
        }

        try:
            result = openrouter_service.call(
                messages=[{"role": "user", "content": content}],
                temperature=self.temperature,
                response_format=response_format,
                max_attempts=max_attempts,
                use_fallback=use_fallback,
                timeout=timeout,
            )
            return result
        except openrouter_service.OpenRouterError as exc:
            logger.error("Extraction failed for %s: %s", self.document_type, exc)
            return {"result": None, "error": str(exc)}
