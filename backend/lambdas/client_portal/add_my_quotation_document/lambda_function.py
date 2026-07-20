"""add_my_quotation_document — POST /portal/quotations/{id}/documents/upload-url

Portal-facing document upload. Registers a new attachment key on the quotation
and returns a presigned S3 upload URL the client PUTs the file to directly.
Mirrors the analyst `add_quotation_document` with portal auth + ownership.

Body: { "filename": "<name>" }

Status codes:
    200 — { upload_url, s3_key, expires_in }
    400 — missing/invalid filename
    401 — JWT missing
    403 — not a portal user
    404 — quotation not found OR not owned (anti-enumeration)
    500 — internal error
"""

from shared.database.connection import get_session
from shared.database.repositories import quotation_repository
from shared.lambda_helpers import build_response, parse_body, parse_path_uuid
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

        body, err = parse_body(event)
        if err:
            return err
        filename = (body.get("filename") or "").strip()
        if not filename:
            return build_response(400, {"error": "Missing required field: filename"})

        validation_error = s3_service.validate_file(filename, 0)
        if validation_error:
            return build_response(400, {"error": validation_error})

        s3_key, upload_url = s3_service.presign_new_document_upload(quotation_id, filename)

        with get_session() as session:
            client_id, err = get_portal_client_id(event, session)
            if err:
                return err

            quotation, err = load_owned_quotation(session, quotation_id, client_id)
            if err:
                return err

            existing = dict(quotation.attachments_s3_keys or {})
            existing[filename] = s3_key
            quotation_repository.update_s3_keys(
                session,
                quotation_id=quotation_id,
                attachments_s3_keys=existing,
            )

        logger.info(
            "portal_quotation_document_added",
            extra={"document_filename": filename, "s3_key": s3_key},
        )

        return build_response(200, {
            "upload_url": upload_url,
            "s3_key": s3_key,
            "expires_in": s3_service.PRESIGNED_UPLOAD_EXPIRY,
        })

    except Exception:
        logger.exception("Unhandled error in add_my_quotation_document")
        return build_response(500, {"error": "Internal server error"})
