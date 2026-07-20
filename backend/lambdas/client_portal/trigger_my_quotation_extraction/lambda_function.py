"""trigger_my_quotation_extraction — POST /portal/quotations/{id}/trigger-extraction

Portal-facing version of trigger_quotation_extraction. Called by the portal
frontend after all presigned URL uploads complete when the upload set contains
no .msg file (PDF, XLSX, etc.). Validates that the quotation belongs to the
authenticated portal user before publishing to the SQS extraction queue.

For .msg uploads the extraction is triggered automatically via S3 event →
parse_email_msg → SQS, so this endpoint is not needed in that case.

Status codes:
    200 — extraction queued; { status: "queued" }
    400 — missing or invalid quotation id
    401 — JWT missing
    403 — not a portal user
    404 — quotation not found OR not owned (anti-enumeration)
    500 — internal error
"""

from shared.database.connection import get_session
from shared.database.repositories import quotation_repository
from shared.lambda_helpers import build_response, parse_path_uuid
from shared.observability import logger, tracer
from shared.portal_helpers import get_portal_client_id
from shared.services import sqs_service


@tracer.capture_lambda_handler
@logger.inject_lambda_context(correlation_id_path="requestContext.requestId")
def lambda_handler(event, context):
    try:
        quotation_id, err = parse_path_uuid(event, "id")
        if err:
            return err
        logger.append_keys(quotation_id=str(quotation_id))

        with get_session() as session:
            client_id, err = get_portal_client_id(event, session)
            if err:
                return err

            quotation = quotation_repository.get(session, quotation_id)
            if quotation is None or quotation.client_id != client_id:
                return build_response(404, {"error": "Quotation not found"})

        sqs_service.publish_extraction_task(quotation_id=str(quotation_id))
        logger.info("Extraction triggered for quotation %s by portal client %s", quotation_id, client_id)

        return build_response(200, {"status": "queued"})

    except Exception:
        logger.exception("Unhandled error")
        return build_response(500, {"error": "Internal server error"})
