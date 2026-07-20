"""get_my_quotation_documents — GET /portal/quotations/{id}/attachments

Portal-facing document list. Returns presigned download + preview URLs for the
files attached to the quotation. Unlike the analyst attachments endpoint it does
NOT expose the internal extracted email body.

Status codes:
    200 — { items: [{ filename, s3_key, download_url, preview_url }] }
    401 — JWT missing
    403 — not a portal user
    404 — quotation not found OR not owned (anti-enumeration)
    500 — internal error
"""

from shared.database.connection import get_session
from shared.lambda_helpers import build_response, parse_path_uuid
from shared.observability import logger, tracer
from shared.portal_helpers import get_portal_client_id, load_owned_quotation
from shared.services import s3_service


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

            quotation, err = load_owned_quotation(session, quotation_id, client_id)
            if err:
                return err

            attachments_map: dict = quotation.attachments_s3_keys or {}

        bucket = s3_service.get_attachments_bucket()
        items = s3_service.serialize_existing_attachments(bucket, attachments_map)

        return build_response(200, {"items": items})

    except Exception:
        logger.exception("Unhandled error in get_my_quotation_documents")
        return build_response(500, {"error": "Internal server error"})
