import os
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Optional

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from shared.services.microsoft_graph_service import EmailAttachment

# Default Content-Type for presigned PUT uploads where the browser sends raw
# bytes with no client-provided type (S3 upload convention — see CLAUDE.md
# "S3 uploads bypass base_api").
DEFAULT_UPLOAD_CONTENT_TYPE = "application/octet-stream"

_SAFE_FILENAME_PATTERN = re.compile(r"[^a-zA-Z0-9._-]")

_ALLOWED_EXTENSIONS = {
    ".msg",
    ".pdf",
    ".xlsx", ".xls", ".csv",
    ".jpg", ".jpeg", ".png", ".gif", ".webp",
    ".txt",
    ".docx",
}
_MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB
_PRESIGNED_UPLOAD_EXPIRY = 900   # 15 minutes — enough for large .msg uploads
_PRESIGNED_DOWNLOAD_EXPIRY = 3600  # 1 hour — per RF spec

_PREVIEW_CONTENT_TYPES: dict[str, str] = {
    ".pdf": "application/pdf",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
}


_s3_client = None


def _get_client():
    global _s3_client
    if _s3_client is None:
        _s3_client = boto3.client(
            "s3",
            config=Config(retries={"max_attempts": 3, "mode": "standard"}),
        )
    return _s3_client


def get_attachments_bucket() -> str:
    bucket = os.environ.get("S3_ATTACHMENTS_BUCKET")
    if not bucket:
        raise RuntimeError(
            "S3_ATTACHMENTS_BUCKET is not configured for this Lambda. "
            "Add it to the function's environment_variables in Terraform."
        )
    return bucket


def safe_filename(filename: str) -> str:
    """Sanitize a filename for use as an S3 key segment (alnum, dot, dash, underscore only)."""
    return _SAFE_FILENAME_PATTERN.sub("_", filename)


def validate_file(filename: str, size_bytes: int) -> Optional[str]:
    """Return an error message if the file is invalid, None if valid."""
    ext = os.path.splitext(filename.lower())[1]
    if ext not in _ALLOWED_EXTENSIONS:
        allowed = ", ".join(sorted(_ALLOWED_EXTENSIONS))
        return f"File type '{ext}' is not allowed. Accepted: {allowed}"
    if size_bytes > _MAX_FILE_SIZE_BYTES:
        return f"File '{filename}' exceeds the 50 MB size limit"
    return None


def generate_presigned_upload_url(bucket: str, key: str, content_type: str) -> str:
    """Return a presigned PUT URL for direct browser-to-S3 upload."""
    s3 = _get_client()
    return s3.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": bucket,
            "Key": key,
            "ContentType": content_type,
            "ServerSideEncryption": "AES256",
        },
        ExpiresIn=_PRESIGNED_UPLOAD_EXPIRY,
    )


def generate_presigned_download_url(bucket: str, key: str) -> str:
    """Return a presigned GET URL for secure attachment download."""
    s3 = _get_client()
    return s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket, "Key": key},
        ExpiresIn=_PRESIGNED_DOWNLOAD_EXPIRY,
    )


def generate_presigned_preview_url(bucket: str, key: str) -> str | None:
    """Return a presigned GET URL that forces the correct Content-Type for inline preview.

    Returns None if the file extension is not previewable.
    """
    ext = os.path.splitext(key.lower())[1]
    content_type = _PREVIEW_CONTENT_TYPES.get(ext)
    if not content_type:
        return None
    s3 = _get_client()
    return s3.generate_presigned_url(
        "get_object",
        Params={
            "Bucket": bucket,
            "Key": key,
            "ResponseContentType": content_type,
            "ResponseContentDisposition": "inline",
        },
        ExpiresIn=_PRESIGNED_DOWNLOAD_EXPIRY,
    )


def generate_presigned_download_urls(bucket: str, keys: list[str]) -> dict[str, str]:
    """Generate presigned download URLs for multiple keys concurrently.

    Returns a dict mapping each S3 key to its presigned URL.
    Keys that fail silently return an empty string (non-blocking).
    """
    if not keys:
        return {}

    def _generate_one(key: str) -> tuple[str, str]:
        try:
            url = generate_presigned_download_url(bucket, key)
            return key, url
        except Exception:
            return key, ""

    with ThreadPoolExecutor(max_workers=min(len(keys), 10)) as executor:
        futures = {executor.submit(_generate_one, key): key for key in keys}
        return {key: url for future in as_completed(futures) for key, url in [future.result()]}


def object_exists(bucket: str, key: str) -> bool:
    """Check whether an S3 object exists without downloading it."""
    s3 = _get_client()
    try:
        s3.head_object(Bucket=bucket, Key=key)
        return True
    except ClientError as e:
        if e.response["Error"]["Code"] in ("404", "NoSuchKey"):
            return False
        raise


# Public TTL so handlers can report the same expiry the presigned URL actually
# uses, instead of hardcoding a duplicate literal.
PRESIGNED_UPLOAD_EXPIRY = _PRESIGNED_UPLOAD_EXPIRY


def serialize_existing_attachments(bucket: str, attachments_map: dict) -> list[dict]:
    """Serialize a quotation's attachment map to portal/analyst DTOs.

    Presigns only objects that actually exist in S3 — keys can be registered
    before the upload completes, and a presigned URL for a missing object yields
    NoSuchKey on access. Returns items with download_url + preview_url. Shared by
    the analyst and portal attachment endpoints so the two never drift.
    """
    if not attachments_map:
        return []
    existing_keys = [
        s3_key for s3_key in attachments_map.values() if object_exists(bucket, s3_key)
    ]
    presigned_urls = generate_presigned_download_urls(bucket, existing_keys)
    existing_key_set = set(existing_keys)
    return [
        {
            "filename": filename,
            "s3_key": s3_key,
            "download_url": presigned_urls.get(s3_key, ""),
            "preview_url": generate_presigned_preview_url(bucket, s3_key),
        }
        for filename, s3_key in attachments_map.items()
        if s3_key in existing_key_set
    ]


def presign_new_document_upload(quotation_id, filename: str) -> tuple[str, str]:
    """Build the S3 key for a new quotation document and its presigned PUT URL.

    Caller is responsible for validating the filename (validate_file) and for
    registering the returned key on the quotation. Returns (s3_key, upload_url).
    """
    s3_key = f"quotations/{quotation_id}/documents/{safe_filename(filename)}"
    upload_url = generate_presigned_upload_url(
        bucket=get_attachments_bucket(),
        key=s3_key,
        content_type=DEFAULT_UPLOAD_CONTENT_TYPE,
    )
    return s3_key, upload_url


class S3ObjectNotFoundError(Exception):
    """Raised when an S3 object does not exist."""


def download_object(bucket: str, key: str) -> bytes:
    """Download an S3 object and return its raw bytes.

    Raises S3ObjectNotFoundError if the key does not exist.
    """
    s3 = _get_client()
    try:
        response = s3.get_object(Bucket=bucket, Key=key)
        return response["Body"].read()
    except ClientError as e:
        if e.response["Error"]["Code"] == "NoSuchKey":
            raise S3ObjectNotFoundError(f"Object not found: {key}") from e
        raise


def list_objects(bucket: str, prefix: str) -> list[str]:
    """List all S3 keys under a prefix."""
    s3 = _get_client()
    result = s3.list_objects_v2(Bucket=bucket, Prefix=prefix)
    return [obj["Key"] for obj in result.get("Contents", [])]


def download_proposal_pdfs(proposal, logger=None) -> list[EmailAttachment]:
    """Download a proposal's PDF attachments from S3 as email attachments.

    Non-PDF entries are skipped. Individual download failures are logged (when a
    logger is provided) and skipped, so one bad key never blocks the email.
    """
    attachments_keys: dict = getattr(proposal, "attachments_s3_keys", None) or {}
    if not attachments_keys:
        return []

    bucket = get_attachments_bucket()
    result: list[EmailAttachment] = []
    for filename, s3_key in attachments_keys.items():
        if not filename.lower().endswith(".pdf"):
            continue
        try:
            content = download_object(bucket, s3_key)
            result.append({
                "name": filename,
                "content_type": "application/pdf",
                "content_bytes": content,
            })
        except Exception:
            if logger is not None:
                logger.warning("Failed to download proposal attachment", extra={"s3_key": s3_key})
    return result
