"""Offline mocks for the client-portal prototype.

The prototype runs with no AWS. This module monkeypatches the leaf functions in
`shared/services/*` that would otherwise reach S3, SQS or Microsoft Graph, so the
business handlers (which are copied verbatim from Centrix) run unchanged.

Design:
- S3 -> local filesystem under ./storage. Presigned "upload"/"download" URLs
  point at the FastAPI `/_local_s3/...` routes (see app.routers.local_s3).
- Microsoft Graph -> logged no-op (emails are never actually sent).
- SQS -> handled by simply leaving SQS_*_QUEUE_URL env vars unset, which makes
  `sqs_service.publish_extraction_task` no-op on its own. Nothing to patch.

Patching leaf functions works even for callers that do `from ... import name`,
as long as those callers reference the leaf via the module (e.g.
`s3_service.generate_presigned_upload_url(...)`). The one exception is
`rfq_dispatch_service`, which imports `send_mail`/`get_access_token` by name;
those bound names are patched directly on that module.
"""

import logging
import os
from pathlib import Path

logger = logging.getLogger("prototype.mocks")

# Local stand-in for the S3 bucket. Files land here; the `/_local_s3` routes
# read/write this same directory.
STORAGE_DIR = Path(os.environ.get("LOCAL_STORAGE_DIR", "storage")).resolve()

_LOCAL_BASE_URL = os.environ.get("LOCAL_S3_BASE_URL", "http://localhost:8000")
_MOCK_BUCKET = "local-bucket"

_PREVIEWABLE_EXTS = {".pdf", ".jpg", ".jpeg", ".png"}


def _storage_path_for(key: str) -> Path:
    return STORAGE_DIR / key


def object_exists_local(key: str) -> bool:
    return _storage_path_for(key).is_file()


def _upload_url(key: str) -> str:
    return f"{_LOCAL_BASE_URL}/_local_s3/{key}"


def _download_url(key: str) -> str:
    return f"{_LOCAL_BASE_URL}/_local_s3/{key}"


def install_mocks() -> None:
    STORAGE_DIR.mkdir(parents=True, exist_ok=True)

    from shared.services import s3_service, microsoft_graph_service

    # ---- S3 -----------------------------------------------------------------
    s3_service.get_attachments_bucket = lambda: _MOCK_BUCKET

    def _presigned_upload(bucket, key, content_type=None):
        return _upload_url(key)

    def _presigned_download(bucket, key):
        return _download_url(key)

    def _presigned_preview(bucket, key):
        ext = os.path.splitext(key.lower())[1]
        return _download_url(key) if ext in _PREVIEWABLE_EXTS else None

    s3_service.generate_presigned_upload_url = _presigned_upload
    s3_service.generate_presigned_download_url = _presigned_download
    s3_service.generate_presigned_preview_url = _presigned_preview
    s3_service.object_exists = lambda bucket, key: object_exists_local(key)

    # ---- Microsoft Graph (email) -------------------------------------------
    def _mock_get_access_token(*args, **kwargs):
        return "mock-graph-token"

    def _mock_send_mail(*args, **kwargs):
        # Real signature: send_mail(token, sender_user_id, to_addresses,
        # subject, body_html, ...). Pull subject/recipients positionally or by
        # keyword for a useful log line.
        to = kwargs.get("to_addresses") or (args[2] if len(args) > 2 else None)
        subject = kwargs.get("subject") or (args[3] if len(args) > 3 else None)
        logger.info("[MOCK send_mail] subject=%r to=%r", subject, to)
        return None

    microsoft_graph_service.get_access_token = _mock_get_access_token
    microsoft_graph_service.send_mail = _mock_send_mail

    # rfq_dispatch_service imported these by name at module load, so rebind the
    # names in its own namespace too.
    from shared.services import rfq_dispatch_service

    rfq_dispatch_service.get_access_token = _mock_get_access_token
    rfq_dispatch_service.send_mail = _mock_send_mail

    logger.info("Prototype mocks installed (S3 -> %s, Graph -> no-op)", STORAGE_DIR)
