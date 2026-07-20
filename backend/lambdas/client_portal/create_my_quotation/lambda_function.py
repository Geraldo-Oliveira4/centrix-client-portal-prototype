"""create_my_quotation — POST /portal/quotations

Portal-facing endpoint that lets an authenticated client open a new quotation
request directly from the portal. The client_id is always derived from the JWT
(via portal_users table) — any client_id in the body is ignored.

No DNA pre-fill is applied: the client fills the form with their own knowledge
of the shipment. The analyst picks up the card in the Kanban and proceeds
normally. analyst_id is left NULL to signal that no analyst has been assigned yet.

Status codes:
    201 — quotation created; returns { quotation, upload_urls }
    400 — invalid payload or file validation error
    401 — JWT missing
    403 — not a portal user
    500 — internal error
"""

from shared.database.connection import get_session, run_with_db_retry
from shared.database.repositories import client_repository
from shared.domain.quotation_creation import (
    ACTION_QUOTATION_CREATED_BY_PORTAL,
    MANUAL_SOURCE,
    build_upload_urls,
    create_quotation_core,
)
from shared.lambda_helpers import (
    build_response,
    get_user_id,
    parse_body,
    serialize_quotation,
)
from shared.observability import logger, tracer
from shared.portal_helpers import get_portal_client_id
from shared.services import s3_service


@tracer.capture_lambda_handler
@logger.inject_lambda_context(correlation_id_path="requestContext.requestId")
def lambda_handler(event, context):
    try:
        body, err = parse_body(event)
        if err:
            return err

        def _do_create():
            with get_session() as session:
                # get_portal_client_id already enforces `portal` group membership
                # internally; get_user_id just reads the sub for the audit log.
                sub = get_user_id(event)

                client_id, err = get_portal_client_id(event, session)
                if err:
                    return err

                client = client_repository.get(session, client_id)
                is_vip = client.is_vip if client else False

                try:
                    created = create_quotation_core(
                        session,
                        body,
                        analyst_id=None,
                        client_id=client_id,
                        is_vip=is_vip,
                        insurance_required=body.get("insurance_required"),
                        log_action=ACTION_QUOTATION_CREATED_BY_PORTAL,
                        log_actor_id=sub,
                        default_source=MANUAL_SOURCE,
                    )
                except ValueError as exc:
                    return build_response(400, {"error": str(exc)})

                result = serialize_quotation(
                    created["quotation"],
                    equipments=created["created_equipments"],
                    volumes=created["created_volumes"],
                )

            logger.append_keys(quotation_id=created["quotation_id"])
            logger.info("quotation_created_by_portal", extra={"state": result["state"]})

            return build_response(201, {
                "quotation": result,
                "upload_urls": build_upload_urls(
                    s3_service.get_attachments_bucket(),
                    created["quotation_id"],
                    created["source"],
                    created["msg_filename"],
                    created["raw_s3_key"],
                    created["attachment_filenames"],
                ),
            })

        # Retries only the Neon cold-start read-only race (ARB — COT-2026-0888
        # incident); validation/guard failures above return on the first pass.
        return run_with_db_retry(_do_create)

    except Exception:
        logger.exception("Unhandled error")
        return build_response(500, {"error": "Internal server error"})
