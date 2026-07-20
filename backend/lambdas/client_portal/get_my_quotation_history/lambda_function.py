"""get_my_quotation_history — GET /portal/quotations/{id}/history

Portal-facing timeline. Unlike the analyst history it exposes only
client-relevant milestones (creation, RFQ dispatch, proposals received,
sent/approved/declined/cancelled) and strips every internal detail (analyst
notes, agent-review reasons, user ids). See `serialize_client_history`.

Status codes:
    200 — { items: [...], total: int }
    401 — JWT missing
    403 — not a portal user
    404 — quotation not found OR not owned (anti-enumeration)
    500 — internal error
"""

from shared.database.connection import get_session
from shared.database.repositories import quotation_repository
from shared.lambda_helpers import build_response, parse_path_uuid
from shared.observability import logger, tracer
from shared.portal_helpers import (
    get_portal_client_id,
    load_owned_quotation,
    serialize_client_history,
)


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

            _, err = load_owned_quotation(session, quotation_id, client_id)
            if err:
                return err

            logs = quotation_repository.get_logs(session, quotation_id)
            items = serialize_client_history(logs)

        return build_response(200, {"items": items, "total": len(items)})

    except Exception:
        logger.exception("Unhandled error in get_my_quotation_history")
        return build_response(500, {"error": "Internal server error"})
