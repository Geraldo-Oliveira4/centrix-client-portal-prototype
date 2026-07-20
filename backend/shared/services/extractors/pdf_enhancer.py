"""PDF page rendering and image enhancement for AI extraction.

Renders PDF pages to PNG via PyMuPDF and applies image enhancements
(normalize, contrast, sharpen) via Pillow to improve OCR/vision accuracy
on scanned or low-quality documents.
"""

import io
import logging
from dataclasses import dataclass
from typing import Optional

import fitz
from PIL import Image, ImageEnhance, ImageFilter, ImageOps

logger = logging.getLogger(__name__)


@dataclass
class EnhancementOptions:
    dpi: int = 200
    dpi_subsequent_pages: int = 150
    normalize: bool = True
    sharpen: bool = True
    greyscale: bool = False
    contrast: float = 1.1


@dataclass
class EnhancedPage:
    buffer: bytes
    mime_type: str = "image/png"


def _enhance_image(png_bytes: bytes, options: EnhancementOptions) -> bytes:
    """Apply image enhancements to a PNG buffer using Pillow."""
    img = Image.open(io.BytesIO(png_bytes))

    if options.greyscale:
        img = img.convert("L")

    if options.normalize:
        img = ImageOps.autocontrast(img)

    if options.contrast and options.contrast != 1.0:
        img = ImageEnhance.Contrast(img).enhance(options.contrast)

    if options.sharpen:
        img = img.filter(ImageFilter.SHARPEN)

    out = io.BytesIO()
    img.save(out, format="PNG")
    return out.getvalue()


def render_and_enhance(
    pdf_bytes: bytes,
    options: Optional[EnhancementOptions] = None,
) -> list[EnhancedPage]:
    """Render each PDF page to PNG and apply enhancements.

    Uses PyMuPDF for rendering (no external tools needed in Lambda).
    """
    opts = options or EnhancementOptions()

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    pages: list[EnhancedPage] = []

    for i, page in enumerate(doc):
        page_dpi = opts.dpi if i == 0 else opts.dpi_subsequent_pages
        raw_png = page.get_pixmap(dpi=page_dpi).tobytes("png")
        enhanced_png = _enhance_image(raw_png, opts)
        pages.append(EnhancedPage(buffer=enhanced_png))
        logger.debug(
            "Page %d enhanced at %d DPI: %d -> %d bytes", i + 1, page_dpi, len(raw_png), len(enhanced_png)
        )

    doc.close()
    logger.info("PDF processed: %d pages rendered and enhanced at %d DPI", len(pages), opts.dpi)
    return pages
