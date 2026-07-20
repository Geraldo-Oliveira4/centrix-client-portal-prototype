import json
import logging
import os

import boto3

logger = logging.getLogger(__name__)


def _get_client():
    return boto3.client("sqs")


def publish_extraction_task(
    quotation_id: str,
    raw_s3_key: str | None = None,
    sender_email: str | None = None,
) -> None:
    """Enqueue an async extraction task for the AI processor (T08).

    Fire-and-forget: failures are logged but never propagated to the caller.
    The quotation record is already committed before this is called, so a
    failed publish only delays AI extraction — it does not corrupt state.

    raw_s3_key is optional: present for .msg-originated quotations (the
    original email path); omitted for PDF/attachment-only uploads where
    extraction reads directly from the extracted/attachments/ prefix.
    """
    queue_url = os.environ.get("SQS_EXTRACTION_QUEUE_URL")
    if not queue_url:
        logger.warning("SQS_EXTRACTION_QUEUE_URL not set — skipping extraction dispatch")
        return

    try:
        _get_client().send_message(
            QueueUrl=queue_url,
            MessageBody=json.dumps(
                {
                    "task": "extract_quotation_data",
                    "quotation_id": quotation_id,
                    "raw_s3_key": raw_s3_key,
                    "sender_email": sender_email,
                }
            ),
        )
    except Exception as exc:
        logger.error(
            "Failed to publish extraction task for quotation %s: %s",
            quotation_id,
            exc,
        )


def publish_proposal_extraction_task(
    quotation_id: str, proposal_id: str, user_id: str
) -> None:
    """Enqueue an async extraction task for proposal fields (ARB-1731).

    Fire-and-forget: failures are logged but never propagated to the caller.
    user_id is forwarded so the extraction Lambda can attribute state-machine
    transitions to the user who triggered the upload.
    """
    queue_url = os.environ.get("SQS_PROPOSAL_EXTRACTION_QUEUE_URL")
    if not queue_url:
        logger.warning("SQS_PROPOSAL_EXTRACTION_QUEUE_URL not set — skipping proposal extraction dispatch")
        return

    try:
        _get_client().send_message(
            QueueUrl=queue_url,
            MessageBody=json.dumps(
                {
                    "task": "extract_proposal_data",
                    "quotation_id": quotation_id,
                    "proposal_id": proposal_id,
                    "user_id": user_id,
                }
            ),
        )
    except Exception as exc:
        logger.error(
            "Failed to publish proposal extraction task for %s/%s: %s",
            quotation_id,
            proposal_id,
            exc,
        )


def publish_inova_sync_task(message_body: dict) -> bool:
    """Enqueue an async Inova sync task.

    Fire-and-forget: failures are logged and swallowed so the caller's primary
    write is never rolled back by a queue hiccup. Returns True when the message
    was accepted, False when the queue URL is not configured or the publish
    failed.

    Expected message_body shape:
        {
            "task": "inova_sync",
            "action": "status" | "datas" | "anexo",
            "inova_processo_id": "FRT0585.II",
            "payload": {...},
            "metadata": {...},   # optional context (e.g. embarque_id, documento_id)
        }
    """
    queue_url = os.environ.get("SQS_INOVA_SYNC_QUEUE_URL")
    if not queue_url:
        logger.warning("SQS_INOVA_SYNC_QUEUE_URL not set — skipping Inova sync dispatch")
        return False

    body = {"task": "inova_sync", **message_body}
    try:
        _get_client().send_message(
            QueueUrl=queue_url,
            MessageBody=json.dumps(body),
        )
        return True
    except Exception as exc:
        logger.error(
            "Failed to publish Inova sync task for %s %s: %s",
            body.get("action"),
            body.get("inova_processo_id"),
            exc,
        )
        return False
