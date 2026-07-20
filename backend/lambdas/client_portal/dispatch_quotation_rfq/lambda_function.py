"""dispatch_quotation_rfq — POST /portal/quotations/{id}/rfq/dispatch

Portal-facing mirror of the internal `dispatch_rfq`: the client fires the saved
RFQ to their pre-set agents and the quotation advances to COTANDO. Shares the
exact dispatch mechanics (agent resolution, OEA compliance, Moment-1 audit,
email format, COTANDO transition) with the analyst flow via
`shared/services/rfq_dispatch_service.py`.

Extra guard over the internal handler: every targeted agent is re-checked
against the client's pre-set list (`QuotationClientDna.default_agents`) so a
portal client can never dispatch to an agent Freitas did not pre-approve, even
if the stored RFQ was tampered with.

Status codes:
    200 / 207 — dispatched (207 on partial email failure)
    401 — JWT missing
    403 — not a portal user
    404 — quotation/RFQ not found OR not owned (anti-enumeration)
    422 — no/invalid targeted agents, OEA or audit block
    500 — internal error / mailbox not configured
    502 — Graph authentication failed
"""

import os

from shared.database.connection import get_session
from shared.database.repositories import client_dna_repository, rfq_repository
from shared.domain.portal_rfq import resolve_eligible_agent_ids, validate_selected_agents
from shared.lambda_helpers import build_response, parse_path_uuid
from shared.observability import logger, tracer
from shared.portal_helpers import get_portal_client_id, load_owned_quotation
from shared.services.rfq_dispatch_service import execute_rfq_dispatch

# Audit-log action recorded for the portal-driven COTANDO transition, so the
# timeline distinguishes a client self-service dispatch from an analyst one.
PORTAL_DISPATCH_ACTION = "portal_rfq_dispatched"


@tracer.capture_lambda_handler
@logger.inject_lambda_context(correlation_id_path="requestContext.requestId")
def lambda_handler(event, context):
    try:
        quotation_id, err = parse_path_uuid(event, "id")
        if err:
            return err

        logger.append_keys(quotation_id=str(quotation_id))

        mailbox_user = os.environ.get("MS_GRAPH_MAILBOX_USER")
        if not mailbox_user:
            logger.error("MS_GRAPH_MAILBOX_USER env var not set")
            return build_response(500, {"error": "Email sender not configured"})

        app_base_url = os.environ.get("APP_BASE_URL", "").rstrip("/")

        with get_session() as session:
            client_id, err = get_portal_client_id(event, session)
            if err:
                return err

            quotation, err = load_owned_quotation(session, quotation_id, client_id)
            if err:
                return err

            rfq = rfq_repository.get_by_quotation(session, quotation_id)
            if rfq is None:
                return build_response(404, {"error": "RFQ not found for this quotation"})

            # Defence in depth: even though save_quotation_rfq validated the
            # selection, re-check the stored targets against the pre-set list.
            dna = client_dna_repository.get_by_quotation(session, quotation)
            eligible_ids = resolve_eligible_agent_ids(dna)
            selection = validate_selected_agents(rfq.agents_targeted or [], eligible_ids)
            if not selection.ok:
                return build_response(422, {
                    "error": "RFQ contem agentes fora da lista pre-definida do cliente."
                    if selection.reason == "out_of_list"
                    else "Selecione ao menos um agente da lista pre-definida.",
                    "invalid_agent_ids": selection.invalid_ids,
                    "eligible_agent_ids": eligible_ids,
                })

            status_code, body = execute_rfq_dispatch(
                session,
                quotation=quotation,
                rfq=rfq,
                actor_id=str(client_id),
                mailbox_user=mailbox_user,
                app_base_url=app_base_url,
                log_action=PORTAL_DISPATCH_ACTION,
                cc_addresses=["logistica@freitascomex.com.br"],
            )
            return build_response(status_code, body)

    except Exception:
        logger.exception("Unhandled error in dispatch_quotation_rfq")
        return build_response(500, {"error": "Internal server error"})
