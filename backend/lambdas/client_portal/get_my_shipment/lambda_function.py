"""get_my_shipment — GET /portal/shipments/{id}

Detail of a single shipment owned by the authenticated client. `{id}` is the
Processo id, the same identity the analyst workspace uses (the EMB- reference
lives on the Embarque and is returned as `referencia`).

Anti-enumeration: a shipment owned by another client and a shipment that does
not exist both return the same 404, so a portal user cannot probe for the
existence of another client's processes. Same invariant `load_owned_quotation`
enforces for quotations — here it is `portal_shipment_repository.get_owned`.

The payload carries the current state only. There is no transition history in
the database (see shared/portal_shipment_helpers.py), so this handler has no
`history` field to fill and the frontend renders the state as a progress
indicator rather than a timeline.

Status codes:
    200 — { shipment: {...} }
    400 — malformed id
    401 — JWT missing
    403 — not a portal user
    404 — unknown shipment OR owned by another client
    500 — internal error
"""

from shared.database.connection import get_session
from shared.database.repositories import portal_shipment_repository
from shared.lambda_helpers import build_response, parse_path_uuid
from shared.observability import logger, tracer
from shared.portal_helpers import get_portal_client_id
from shared.portal_shipment_helpers import serialize_shipment_detail_for_portal


@tracer.capture_lambda_handler
@logger.inject_lambda_context(correlation_id_path="requestContext.requestId")
def lambda_handler(event, context):
    try:
        shipment_id, err = parse_path_uuid(event, "id")
        if err:
            return err

        with get_session() as session:
            client_id, err = get_portal_client_id(event, session)
            if err:
                return err

            owned = portal_shipment_repository.get_owned(
                session, shipment_id, client_id
            )
            if owned is None:
                return build_response(404, {"error": "Shipment not found"})

            processo, embarque, agent = owned
            result = serialize_shipment_detail_for_portal(processo, embarque, agent)

        return build_response(200, {"shipment": result})

    except Exception:
        logger.exception("Unhandled error")
        return build_response(500, {"error": "Internal server error"})
