"""list_quotation_agents — GET /portal/quotations/{id}/agents

Returns the freight agents the portal client is allowed to target for this
quotation. The eligible list is pre-set by Freitas in the client's DNA
(`QuotationClientDna.default_agents`) — the client never registers a new agent,
they only pick from this list (ARB-2450, spec section 3).

Also returns the current RFQ assembly state (whether it was already dispatched
and which agents are currently selected) so the portal can decide between
showing the assembly form or a read-only "already dispatched" state.

Status codes:
    200 — { agents: [...], rfq_dispatched: bool, selected_agent_ids: [...] }
    401 — JWT missing
    403 — not a portal user
    404 — quotation not found OR not owned (anti-enumeration)
    500 — internal error
"""

from shared.database.connection import get_session
from shared.database.repositories import client_dna_repository, rfq_repository
from shared.domain.portal_rfq import load_eligible_agents
from shared.lambda_helpers import build_response, parse_path_uuid, serialize_freight_agent
from shared.observability import logger, tracer
from shared.portal_helpers import get_portal_client_id, load_owned_quotation


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

            dna = client_dna_repository.get_by_quotation(session, quotation)
            agents = load_eligible_agents(session, dna)

            rfq = rfq_repository.get_by_quotation(session, quotation_id)

            return build_response(200, {
                "agents": [serialize_freight_agent(a) for a in agents],
                "rfq_dispatched": bool(rfq and rfq.dispatched_at),
                "selected_agent_ids": (rfq.agents_targeted or []) if rfq else [],
            })

    except Exception:
        logger.exception("Unhandled error in list_quotation_agents")
        return build_response(500, {"error": "Internal server error"})
