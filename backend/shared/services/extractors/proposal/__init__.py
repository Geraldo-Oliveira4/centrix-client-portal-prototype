"""Proposal extraction domain.

Usage:
    from shared.services.extractors.proposal import ProposalExtractor
    from shared.services.extractors.proposal import PROPOSAL_EXTRACTION_FIELDS
"""

from shared.services.extractors.proposal.extractor import ProposalExtractor
from shared.services.extractors.proposal.schema import (
    PROPOSAL_EXTRACTION_FIELDS,
    PROPOSAL_EXTRACTION_SCHEMA,
)

__all__ = [
    "ProposalExtractor",
    "PROPOSAL_EXTRACTION_SCHEMA",
    "PROPOSAL_EXTRACTION_FIELDS",
]
