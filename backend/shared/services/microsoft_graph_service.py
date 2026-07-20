"""Microsoft Graph API client for M365 mailbox polling.

Used by the email_poller Lambda (ARB-1736 / FCX-S3-T01) to read unread
emails from the Freitas COMEX inbox and mark them as processed.

Authentication: OAuth2 client credentials flow (application permissions).
HTTP client: urllib.request — no SDK, per architectural decision.

Required env vars:
    MS_GRAPH_TENANT_ID     — Azure AD tenant ID
    MS_GRAPH_CLIENT_ID     — Azure AD application (client) ID
    MS_GRAPH_CLIENT_SECRET — Azure AD client secret

Credentials are read fresh on each call. Token lifetime is 1 hour; the
Lambda execution window is at most 300 s, so no in-process caching is needed.
"""

import base64
import json
import os
import urllib.error
import urllib.parse
import urllib.request
from typing import Optional, TypedDict

_GRAPH_BASE = "https://graph.microsoft.com/v1.0"
_TOKEN_URL_TEMPLATE = "https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"
_GRAPH_SCOPE = "https://graph.microsoft.com/.default"
_REQUEST_TIMEOUT = 30
_ATTACHMENT_MAX_BYTES = 40 * 1024 * 1024  # 40 MB
_EMAIL_PAGE_SIZE = 50


class EmailAttachment(TypedDict):
    """A file attachment for send_mail. content_bytes is the raw (undecoded) file content."""

    name: str
    content_type: str
    content_bytes: bytes


class MicrosoftGraphError(Exception):
    """Raised when the Graph API returns a non-2xx response."""

    def __init__(
        self,
        message: str,
        status_code: Optional[int] = None,
        raw: Optional[dict] = None,
    ):
        super().__init__(message)
        self.status_code = status_code
        self.raw = raw


def _get_credentials() -> tuple[str, str, str]:
    tenant_id = os.environ.get("MS_GRAPH_TENANT_ID")
    client_id = os.environ.get("MS_GRAPH_CLIENT_ID")
    client_secret = os.environ.get("MS_GRAPH_CLIENT_SECRET")
    missing = [k for k, v in {
        "MS_GRAPH_TENANT_ID": tenant_id,
        "MS_GRAPH_CLIENT_ID": client_id,
        "MS_GRAPH_CLIENT_SECRET": client_secret,
    }.items() if not v]
    if missing:
        raise RuntimeError(
            f"Missing required environment variables: {', '.join(missing)}"
        )
    return tenant_id, client_id, client_secret


def get_access_token() -> str:
    """Obtain a Bearer token via OAuth2 client credentials flow.

    Raises MicrosoftGraphError on authentication failure.
    """
    tenant_id, client_id, client_secret = _get_credentials()
    token_url = _TOKEN_URL_TEMPLATE.format(tenant_id=tenant_id)
    payload = urllib.parse.urlencode({
        "grant_type": "client_credentials",
        "client_id": client_id,
        "client_secret": client_secret,
        "scope": _GRAPH_SCOPE,
    }).encode()
    req = urllib.request.Request(
        token_url,
        data=payload,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    try:
        with urllib.request.urlopen(req, timeout=_REQUEST_TIMEOUT) as resp:
            data = json.loads(resp.read())
            return data["access_token"]
    except urllib.error.HTTPError as exc:
        raw = _read_error_body(exc)
        raise MicrosoftGraphError(
            f"Token request failed: {exc.code} {exc.reason}",
            status_code=exc.code,
            raw=raw,
        ) from exc


def _graph_request(
    token: str,
    method: str,
    path: str,
    body: Optional[dict] = None,
) -> Optional[dict]:
    """Send an authenticated request to the Graph API.

    Returns the parsed JSON body, or None for 204 No Content responses.
    Raises MicrosoftGraphError on non-2xx responses.
    """
    url = f"{_GRAPH_BASE}{path}"
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Authorization": f"Bearer {token}"}
    if data is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=_REQUEST_TIMEOUT) as resp:
            raw = resp.read()
            if not raw:
                return None
            return json.loads(raw)
    except urllib.error.HTTPError as exc:
        raw_body = _read_error_body(exc)
        error_msg = (
            raw_body.get("error", {}).get("message", f"HTTP {exc.code}")
            if raw_body
            else f"HTTP {exc.code}"
        )
        raise MicrosoftGraphError(
            f"Graph API error on {method} {path}: {error_msg}",
            status_code=exc.code,
            raw=raw_body,
        ) from exc


def _read_error_body(exc: urllib.error.HTTPError) -> Optional[dict]:
    """Safely parse the error response body from an HTTPError."""
    try:
        return json.loads(exc.read())
    except Exception:
        return None


def list_unread_emails(
    token: str,
    user_id: str,
    folder: str = "Inbox",
) -> list[dict]:
    """Return up to _EMAIL_PAGE_SIZE unread messages from the given mailbox folder.

    The `$select=body` parameter is required — Graph omits the body field in list
    responses unless explicitly requested via $select.

    Each returned dict contains at minimum: id, subject, from, receivedDateTime, body.
    """
    params = urllib.parse.urlencode({
        "$filter": "isRead eq false",
        "$top": str(_EMAIL_PAGE_SIZE),
        "$select": "id,subject,from,receivedDateTime,body",
        "$orderby": "receivedDateTime asc",
    })
    path = f"/users/{user_id}/mailFolders/{folder}/messages?{params}"
    data = _graph_request(token, "GET", path)
    return (data or {}).get("value", [])


def get_email_attachments(
    token: str,
    user_id: str,
    message_id: str,
) -> list[dict]:
    """Return file attachments for a message, skipping reference attachments.

    Only items with odata.type == '#microsoft.graph.fileAttachment' carry
    contentBytes. Attachments exceeding _ATTACHMENT_MAX_BYTES are excluded
    (size is checked before decoding to avoid memory pressure).
    """
    path = f"/users/{user_id}/messages/{message_id}/attachments"
    data = _graph_request(token, "GET", path)
    attachments = (data or {}).get("value", [])
    file_attachments = []
    for att in attachments:
        if att.get("@odata.type") != "#microsoft.graph.fileAttachment":
            continue
        size = att.get("size", 0)
        if size > _ATTACHMENT_MAX_BYTES:
            # Caller should log this; we exclude silently here.
            continue
        file_attachments.append(att)
    return file_attachments


def mark_email_as_read(token: str, user_id: str, message_id: str) -> None:
    """Mark a message as read in the given mailbox.

    Graph returns 200 with updated message body on success.
    """
    path = f"/users/{user_id}/messages/{message_id}"
    _graph_request(token, "PATCH", path, body={"isRead": True})


def send_mail(
    token: str,
    sender_user_id: str,
    to_addresses: list[str],
    subject: str,
    body_html: str,
    reply_to: str | None = None,
    cc_addresses: list[str] | None = None,
    attachments: list[EmailAttachment] | None = None,
) -> None:
    """Send an email from the given M365 mailbox via the Graph sendMail endpoint.

    Uses the `/users/{sender_user_id}/sendMail` endpoint (application permission
    Mail.Send). The message is sent on behalf of `sender_user_id`.

    Args:
        token:           Bearer access token.
        sender_user_id:  UPN or object ID of the sending mailbox.
        to_addresses:    List of recipient email addresses.
        subject:         Email subject line.
        body_html:       Full HTML body.
        reply_to:        Optional reply-to address. When supplied, replies from
                         agents will land in this address instead of the sender.
        cc_addresses:    Optional list of CC recipient email addresses.
        attachments:     Optional list of file attachments. Each dict must have:
                         {"name": str, "content_type": str, "content_bytes": bytes}.

    Raises:
        MicrosoftGraphError: on any non-2xx Graph API response.
        ValueError: if to_addresses is empty.
    """
    if not to_addresses:
        raise ValueError("send_mail requires at least one recipient address")

    recipients = [
        {"emailAddress": {"address": addr}} for addr in to_addresses
    ]

    message: dict = {
        "subject": subject,
        "body": {
            "contentType": "HTML",
            "content": body_html,
        },
        "toRecipients": recipients,
    }

    if reply_to:
        message["replyTo"] = [{"emailAddress": {"address": reply_to}}]

    if cc_addresses:
        message["ccRecipients"] = [
            {"emailAddress": {"address": addr}} for addr in cc_addresses
        ]

    if attachments:
        message["attachments"] = [
            {
                "@odata.type": "#microsoft.graph.fileAttachment",
                "name": att["name"],
                "contentType": att["content_type"],
                "contentBytes": base64.b64encode(att["content_bytes"]).decode("ascii"),
            }
            for att in attachments
        ]

    payload = {"message": message, "saveToSentItems": True}
    path = f"/users/{sender_user_id}/sendMail"
    # Graph returns 202 Accepted with no body on success.
    _graph_request(token, "POST", path, body=payload)
