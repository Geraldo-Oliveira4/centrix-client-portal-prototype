"""list_my_shipments — GET /portal/shipments

Lists the shipments (Processo + Embarque) belonging to the authenticated client,
urgent cargo first then newest first. These rows are created automatically when
the client approves a proposal: the quotation state machine calls
`shipment_service.provision_processo_from_quotation` on the transition to
FECHADA, so every closed quotation has exactly one shipment here.

Analyst-owned processes belonging to other clients are never returned — the
ownership filter lives in `portal_shipment_repository`, not at this call site.

Response also carries `by_estado`, a plain count of shipments per state. That is
the only summary derivable from the stored data; see the module docstring of
shared/portal_shipment_helpers.py for why the GE control-tower KPIs are not here.

Status codes:
    200 — { items: [...], total: int, by_estado: {estado: count} }
    401 — JWT missing
    403 — not a portal user
    500 — internal error
"""

from shared.database.connection import get_session
from shared.database.repositories import portal_shipment_repository
from shared.lambda_helpers import build_response
from shared.observability import logger, tracer
from shared.portal_helpers import get_portal_client_id
from shared.portal_shipment_helpers import (
    count_by_estado,
    serialize_shipment_for_portal,
)


@tracer.capture_lambda_handler
@logger.inject_lambda_context(correlation_id_path="requestContext.requestId")
def lambda_handler(event, context):
    try:
        with get_session() as session:
            client_id, err = get_portal_client_id(event, session)
            if err:
                return err

            rows = portal_shipment_repository.list_by_client(session, client_id)
            items = [
                serialize_shipment_for_portal(processo, embarque, agente_nome)
                for processo, embarque, agente_nome in rows
            ]
            by_estado = count_by_estado(rows)

        return build_response(
            200, {"items": items, "total": len(items), "by_estado": by_estado}
        )

    except Exception:
        logger.exception("Unhandled error")
        return build_response(500, {"error": "Internal server error"})
