"""Shared utilities for AI extraction lambdas (quotation and proposal).

Both extract_quotation_data and extract_proposal_data follow the same pattern:
load documents from S3, call an extractor, parse the result. The functions
here centralise that logic so each lambda only declares its domain-specific
prefix and field list.
"""

import mimetypes
import os
import time

from shared.observability import logger
from shared.services import s3_service

# mimetypes.guess_type() resolves many non-trivial extensions (.xlsx, .docx,
# .webp, ...) via OS files like /etc/mime.types — present on most dev
# machines but absent from the Lambda runtime's minimal container, where
# guess_type() silently returns None for them even though it works locally.
# Explicit table for every extension shared/services/s3_service.py accepts,
# checked first so extraction never depends on OS mime tables.
_EXTENSION_MIME_MAP: dict[str, str] = {
    ".pdf": "application/pdf",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".xls": "application/vnd.ms-excel",
    ".csv": "text/csv",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".txt": "text/plain",
}


def guess_mime_type(key: str) -> str:
    ext = os.path.splitext(key)[1].lower()
    if ext in _EXTENSION_MIME_MAP:
        return _EXTENSION_MIME_MAP[ext]
    mime, _ = mimetypes.guess_type(key)
    return mime or "application/octet-stream"


def elapsed_ms(t_start: float) -> int:
    return int((time.monotonic() - t_start) * 1000)


def calc_payload_bytes(parts: list[dict]) -> int:
    return sum(
        len(p.get("text") or "") + len((p.get("image_url") or {}).get("url") or "")
        for p in parts
    )


def load_documents_from_s3(bucket: str, prefix: str, extractor, context_label: str) -> list[dict]:
    """Download all files under prefix from S3 and prepare as content parts.

    Args:
        bucket: S3 bucket name.
        prefix: Key prefix to list (e.g. "quotations/{id}/extracted/").
        extractor: Extractor instance with a prepare_document(data, mime_type) method.
        context_label: Human-readable label used in log messages (e.g. "quotation abc-123").
    """
    keys = s3_service.list_objects(bucket, prefix)

    if not keys:
        logger.warning("No files found in S3 for %s", context_label)
        return []

    all_parts = []
    total_file_bytes = 0

    for key in keys:
        filename = key.split("/")[-1]
        mime_type = guess_mime_type(key)
        data = s3_service.download_object(bucket, key)

        if not data:
            continue

        file_size_bytes = len(data)
        total_file_bytes += file_size_bytes

        t_render = time.monotonic()
        parts = extractor.prepare_document(data, mime_type)
        render_ms = elapsed_ms(t_render)

        logger.info(
            "Prepared %d parts from %s: mime=%s size_bytes=%d render_ms=%d",
            len(parts), filename, mime_type, file_size_bytes, render_ms,
        )
        all_parts.extend(parts)

    if all_parts:
        logger.info(
            "All documents prepared for %s: files=%d parts=%d total_file_bytes=%d payload_bytes=%d",
            context_label, len(keys), len(all_parts), total_file_bytes, calc_payload_bytes(all_parts),
        )

    return all_parts


def parse_extraction_result(result: dict, fields: list[str]) -> tuple[dict, dict]:
    """Split an extractor response into field values and confidence scores.

    Args:
        result: Raw dict returned by the extractor (expects a "result" key).
        fields: Ordered list of field names to extract.

    Returns:
        (extracted_fields, confidence_scores) — both dicts keyed by field name.
    """
    extracted_fields = {}
    confidence_scores = {}

    data = result.get("result", {})
    for field in fields:
        field_data = data.get(field, {})
        extracted_fields[field] = field_data.get("value")
        confidence_scores[field] = field_data.get("confidence")

    return extracted_fields, confidence_scores
