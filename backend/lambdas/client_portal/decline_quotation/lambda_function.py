"""decline_quotation — POST /portal/quotations/{id}/decline

Client-facing endpoint that lets a portal user decline an entire
quotation in ENVIADA_CLIENTE state. Tags the audit log with
action="client_declined_quotation" so the internal UI can distinguish
client-driven declines from analyst-driven ones.

Body:
    {
        "decline_reason": "<DeclineReason enum value>",
        "note": "...required when decline_reason=OUTROS, max 1000 chars..."
    }

    See DeclineReason in shared.database.models.quotation.enums for valid values.

Status codes:
    200 — declined; quotation now DECLINADA
    400 — missing or invalid decline_reason / invalid note
    401 — JWT missing
    403 — portal user not registered
    404 — quotation not found OR not owned (anti-enumeration)
    409 — quotation not in ENVIADA_CLIENTE
    500 — internal error
"""

from shared.database.connection import get_session
from shared.database.models.quotation.enums import DeclineReason, QuotationState
from shared.database.repositories import quotation_repository
from shared.domain import quotation_state_machine
from shared.lambda_helpers import build_response, get_user_id, parse_body, parse_path_uuid, validate_enum_field
from shared.observability import logger, tracer
from shared.portal_helpers import build_quotation_payload, get_portal_client_id


_NOTE_MAX_LENGTH = 1000
_NOTE_MIN_LENGTH = 10


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

        raw_reason = body.get("decline_reason")
        if not raw_reason:
            return build_response(400, {"error": "Missing required field: decline_reason"})
        reason, err_msg = validate_enum_field("decline_reason", raw_reason, DeclineReason)
        if err_msg:
            return build_response(400, {"error": err_msg})

        raw_note = body.get("note")
        note = None
        if raw_note is not None:
            if not isinstance(raw_note, str):
                return build_response(400, {"error": "note must be a string"})
            note = raw_note.strip() or None

        if reason == DeclineReason.OUTROS and note is None:
            return build_response(400, {
                "error": "note is required when decline_reason is OUTROS",
            })

        if note is not None:
            if len(note) < _NOTE_MIN_LENGTH:
                return build_response(400, {
                    "error": f"note must be at least {_NOTE_MIN_LENGTH} characters",
                })
            if len(note) > _NOTE_MAX_LENGTH:
                return build_response(400, {
                    "error": f"note exceeds {_NOTE_MAX_LENGTH} characters",
                })

        with get_session() as session:
            client_id, err = get_portal_client_id(event, session)
            if err:
                return err

            # Lock the quotation row so concurrent decline/approve calls on
            # the same quotation are serialized.
            quotation = quotation_repository.get(session, quotation_id, for_update=True)
            if quotation is None or quotation.client_id != client_id:
                return build_response(404, {"error": "Quotation not found"})

            if quotation.state != QuotationState.ENVIADA_CLIENTE:
                return build_response(409, {
                    "error": "Quotation is not awaiting client approval",
                    "state": quotation.state.value,
                })

            user_id = get_user_id(event)

            transition_context = {"decline_reason": reason.value}
            if note is not None:
                transition_context["decline_note"] = note

            result = quotation_state_machine.transition(
                session,
                quotation,
                QuotationState.DECLINADA,
                user_id,
                action="client_declined_quotation",
                **transition_context,
            )
            if not result["success"]:
                logger.error(
                    "Transition to DECLINADA blocked",
                    extra={"blocked_by": result["blocked_by"]},
                )
                return build_response(409, {
                    "error": "Could not finalize decline",
                    "blocked_by": result["blocked_by"],
                })

            logger.info(
                "Portal client declined quotation",
                extra={
                    "quotation_id": str(quotation_id),
                    "decline_reason": reason.value,
                    "has_note": note is not None,
                },
            )

            return build_response(200, {"quotation": build_quotation_payload(session, quotation)})

    except Exception:
        logger.exception("Unhandled error in decline_quotation")
        return build_response(500, {"error": "Internal server error"})
