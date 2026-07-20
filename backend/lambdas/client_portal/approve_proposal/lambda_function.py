"""approve_proposal — POST /portal/quotations/{id}/proposals/{proposal_id}/approve

Client-facing endpoint that lets a portal user approve one of the proposals on a
quotation in ENVIADA_CLIENTE state. Marks the proposal as winner and advances the
quotation to APROVADA_PELO_CLIENTE, where the guard rail reviews the client's
selection (ARB-2449). Logs the action with action="client_approved_proposal" so
the internal Kanban shows the approval badge. Does NOT auto-transition to FECHADA —
the analyst closes the quotation manually after review.

Status codes:
    200 — approved; quotation advanced to APROVADA_PELO_CLIENTE, winner is set
    401 — JWT missing
    403 — portal user not registered
    404 — quotation/proposal not found OR not owned (anti-enumeration)
    409 — quotation not in ENVIADA_CLIENTE
    500 — internal error
"""

import os

from shared.database.connection import get_session
from shared.database.models.quotation.enums import QuotationState
from shared.database.repositories import (
    proposal_repository,
    quotation_repository,
)
from shared.domain import quotation_state_machine
from shared.lambda_helpers import build_response, get_user_id, parse_path_uuid
from shared.observability import logger, tracer
from shared.portal_helpers import build_quotation_payload, get_portal_client_id
from shared.services import microsoft_graph_service, notification_service


@tracer.capture_lambda_handler
@logger.inject_lambda_context(correlation_id_path="requestContext.requestId")
def lambda_handler(event, context):
    try:
        quotation_id, err = parse_path_uuid(event, "id")
        if err:
            return err
        proposal_id, err = parse_path_uuid(event, "proposal_id")
        if err:
            return err

        with get_session() as session:
            client_id, err = get_portal_client_id(event, session)
            if err:
                return err

            # Lock the quotation row for the duration of the transaction so
            # concurrent approvals on the same quotation are serialized and
            # cannot produce two winners.
            quotation = quotation_repository.get(session, quotation_id, for_update=True)
            if quotation is None or quotation.client_id != client_id:
                return build_response(404, {"error": "Quotation not found"})

            proposal = proposal_repository.get(session, proposal_id)
            if proposal is None or proposal.quotation_id != quotation_id:
                return build_response(404, {"error": "Proposal not found"})

            if quotation.state != QuotationState.ENVIADA_CLIENTE:
                return build_response(409, {
                    "error": "Quotation is not awaiting client approval",
                    "state": quotation.state.value,
                })

            user_id = get_user_id(event)

            # Client selection advances the quotation to APROVADA_PELO_CLIENTE,
            # where the guard rail reviews the choice (ARB-2449).
            transition_result, agent_name = quotation_state_machine.approve_client_selection(
                session, quotation, proposal, user_id,
            )
            if not transition_result["success"]:
                return build_response(409, {
                    "error": "Could not register approval",
                    "blocked_by": transition_result["blocked_by"],
                })

            logger.info(
                "Portal client approved proposal",
                extra={
                    "quotation_id": str(quotation_id),
                    "proposal_id": str(proposal_id),
                    "agent_id": str(proposal.agent_id),
                    "total_value": float(proposal.total_value),
                },
            )

            quotation_payload = build_quotation_payload(session, quotation)
            quotation_reference = quotation.reference or ""
            quotation_id_str = str(quotation.id)

        app_base_url = os.environ.get("APP_BASE_URL", "")
        quotation_url = f"{app_base_url}/cotacao/{quotation_id_str}" if app_base_url else ""

        try:
            ms_token = microsoft_graph_service.get_access_token()
            mailbox_user = os.environ.get("MS_GRAPH_MAILBOX_USER", "")
            notification_service.notify_operator_client_approved(
                token=ms_token,
                mailbox_user=mailbox_user,
                quotation_reference=quotation_reference,
                quotation_url=quotation_url,
                agent_name=agent_name,
                send_mail_fn=microsoft_graph_service.send_mail,
            )
        except Exception:
            logger.warning("Failed to send client approval notification (non-blocking)")

        return build_response(200, {"quotation": quotation_payload})

    except Exception:
        logger.exception("Unhandled error in approve_proposal")
        return build_response(500, {"error": "Internal server error"})
