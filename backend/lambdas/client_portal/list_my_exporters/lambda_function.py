"""list_my_exporters — GET /portal/exporters

Lists the exporters the authenticated client registered through the portal,
ordered by name. Analyst-managed global exporters (client_id IS NULL) are not
returned — the portal only offers back what the client entered themselves.

Status codes:
    200 — { items: [...], total: int }
    401 — JWT missing
    403 — not a portal user
    500 — internal error
"""

from shared.database.connection import get_session
from shared.database.repositories import portal_exporter_repository
from shared.lambda_helpers import build_response, serialize_exporter
from shared.observability import logger, tracer
from shared.portal_helpers import get_portal_client_id


@tracer.capture_lambda_handler
@logger.inject_lambda_context(correlation_id_path="requestContext.requestId")
def lambda_handler(event, context):
    try:
        with get_session() as session:
            client_id, err = get_portal_client_id(event, session)
            if err:
                return err

            exporters = portal_exporter_repository.list_by_client(session, client_id)
            items = [serialize_exporter(e) for e in exporters]

        return build_response(200, {"items": items, "total": len(items)})

    except Exception:
        logger.exception("Unhandled error")
        return build_response(500, {"error": "Internal server error"})
