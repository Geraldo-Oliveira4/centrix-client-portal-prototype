"""AI extraction package — document-to-structured-data pipelines.

Structure
---------
Each extraction domain lives in its own subdirectory:

  extractors/
  ├── proposal/          # Freight agent proposal documents
  │   ├── extractor.py   # ProposalExtractor (12 fields)
  │   └── schema.py      # PROPOSAL_EXTRACTION_SCHEMA + PROPOSAL_EXTRACTION_FIELDS
  ├── quotation/         # Inbound quotation requests (emails + attachments)
  │   ├── extractor.py   # QuotationExtractor (23 fields)
  │   └── schema.py      # QUOTATION_EXTRACTION_SCHEMA + EXTRACTION_FIELDS
  ├── base_extractor.py  # BaseExtractor ABC: PDF rendering, spreadsheet parsing,
  │                      # image encoding, OpenRouter call via call_extraction()
  ├── extraction_common.py  # load_documents_from_s3(), parse_extraction_result()
  └── pdf_enhancer.py    # PDF-to-image rendering (pymupdf)

Trigger patterns
----------------
  Async (SQS)  — For background jobs where the user does not wait in the browser.
                 Lambda A marks a record as PENDING and publishes to SQS.
                 Lambda B (SQS-triggered) runs the extractor and updates the DB.
                 Use this for: quotation extraction (email poller flow),
                 proposal extraction (internal analyst upload flow).

  Sync (HTTP)  — For user-facing flows where the browser waits for the result.
                 A single public Lambda validates the token, runs the extractor
                 inline, and returns extracted_fields + confidence_scores.
                 Use this for: agent portal PDF extraction.

Adding a new extractor domain (checklist)
------------------------------------------
  1. Create shared/services/extractors/{domain}/
  2. Create {domain}/schema.py
     — Define the JSON Schema object and {DOMAIN}_EXTRACTION_FIELDS list.
  3. Create {domain}/extractor.py
     — Inherit BaseExtractor, define _INSTRUCTIONS, implement extract().
  4. Create {domain}/__init__.py with clean re-exports.
  5. Choose trigger pattern (async vs sync — see above).
  6. If async: add a Lambda pair (trigger + SQS worker) under lambdas/{domain}/.
     If sync: add a single public Lambda under lambdas/{domain}/.
  7. Add Terraform blocks to the relevant domain_*.tf file.
  8. Update this module and backend/CLAUDE.md.
"""

from shared.services.extractors.base_extractor import BaseExtractor
from shared.services.extractors.extraction_common import (
    load_documents_from_s3,
    parse_extraction_result,
)
from shared.services.extractors.proposal import ProposalExtractor
from shared.services.extractors.quotation import QuotationExtractor

__all__ = [
    "BaseExtractor",
    "QuotationExtractor",
    "ProposalExtractor",
    "load_documents_from_s3",
    "parse_extraction_result",
]
