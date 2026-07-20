"""Quotation extraction domain.

Usage:
    from shared.services.extractors.quotation import QuotationExtractor
    from shared.services.extractors.quotation import EXTRACTION_FIELDS
"""

from shared.services.extractors.quotation.extractor import QuotationExtractor
from shared.services.extractors.quotation.schema import (
    EXTRACTION_FIELDS,
    QUOTATION_EXTRACTION_SCHEMA,
)

__all__ = [
    "QuotationExtractor",
    "QUOTATION_EXTRACTION_SCHEMA",
    "EXTRACTION_FIELDS",
]
