"""cancel_quotation — POST /portal/quotations/{id}/cancel

Client-facing endpoint that lets a portal user cancel their own quotation while
it is still in progress (any non-terminal state). Mirrors the analyst cancel
(`lambdas/quotation/transition_quotation` -> CANCELADO): it runs the same state
transition and notifies every RFQ-targeted agent via the shared
`notify_agents_of_cancellation` helper, so the agent-facing email is identical.

The audit log is tagged action="client_cancelled_quotation" so the internal UI
can distinguish a client-driven cancel from an analyst-driven one.

Body (optional):
    { "note": "...free-text reason, max 1000 chars..." }

Status codes:
    200 — cancelled; quotation now CANCELADO. Returns { quotation, notifications }
    400 — invalid note
    401 — JWT missing
    403 — portal user not registered
    404 — quotation not found OR not owned (anti-enumeration)
    409 — quotation already in a terminal state (cannot be cancelled)
    500 — internal error
"""

from shared.database.connection import get_session
from shared.database.models.quotation.enums import QuotationState
from shared.database.repositories import quotation_repository
from shared.domain import quotation_state_machine
from shared.lambda_helpers import (
    build_response,
    get_user_id,
    parse_body,
    parse_path_uuid,
)
from shared.observability import logger, tracer
from shared.portal_helpers import build_quotation_payload, get_portal_client_id
from shared.services.rfq_dispatch_service import notify_agents_of_cancellation


_NOTE_MAX_LENGTH = 1000


@tracer.capture_lambda_handler
@logger.inject_lambda_context(correlation_id_path="requestContext.requestId")
def lambda_handler(event, context):
    try:
        quotation_id, err = parse_path_uuid(event, "id")
        if err:
            return err
        logger.append_keys(quotation_id=str(quotation_id))

        # Body is optional — cancel needs no reason (matches the analyst flow).
        body, err = parse_body(event)
        if err or not isinstance(body, dict):
            body = {}

        raw_note = body.get("note")
        note = None
        if raw_note is not None:
            if not isinstance(raw_note, str):
                return build_response(400, {"error": "note must be a string"})
            note = raw_note.strip() or None
            if note and len(note) > _NOTE_MAX_LENGTH:
                return build_response(400, {
                    "error": f"note exceeds {_NOTE_MAX_LENGTH} characters",
                })

        with get_session() as session:
            client_id, err = get_portal_client_id(event, session)
            if err:
                return err

            # Lock the quotation row so a concurrent approve/decline/cancel on
            # the same quotation is serialized.
            quotation = quotation_repository.get(session, quotation_id, for_update=True)
            if quotation is None or quotation.client_id != client_id:
                return build_response(404, {"error": "Quotation not found"})

            user_id = get_user_id(event)

            transition_context = {"note": note} if note else {}
            result = quotation_state_machine.transition(
                session,
                quotation,
                QuotationState.CANCELADO,
                user_id,
                action="client_cancelled_quotation",
                **transition_context,
            )
            if not result["success"]:
                # The only reason the graph blocks CANCELADO is a terminal
                # source state (FECHADA / DECLINADA / already CANCELADO).
                return build_response(409, {
                    "error": "Quotation can no longer be cancelled",
                    "state": quotation.state.value,
                    "blocked_by": result["blocked_by"],
                })

            notifications = notify_agents_of_cancellation(session, quotation)

            logger.info(
                "Portal client cancelled quotation",
                extra={
                    "quotation_id": str(quotation_id),
                    "has_note": note is not None,
                    "agents_notified": len(notifications),
                },
            )

            return build_response(200, {
                "quotation": build_quotation_payload(session, quotation),
                "notifications": notifications,
            })

    except Exception:
        logger.exception("Unhandled error in cancel_quotation")
        return build_response(500, {"error": "Internal server error"})
