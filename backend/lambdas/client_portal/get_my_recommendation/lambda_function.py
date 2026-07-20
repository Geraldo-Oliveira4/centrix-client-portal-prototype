"""get_my_recommendation — GET /portal/quotations/{id}/recommendation

Portal-facing counterpart of the analyst `get_recommendation`. Returns the AI
recommendation (per-proposal scores + recommended proposal) so the client can
see why a proposal is suggested. Read-only: the portal never overrides.

Reuses `recommendation_service` (calculate_and_persist + serialize_result) so the
scoring is byte-for-byte identical to the analyst view.

Status codes:
    200 — { recommended_proposal_id, recommendation_text, is_overridden, override, scores }
    401 — JWT missing
    403 — not a portal user
    404 — quotation not found OR not owned (anti-enumeration)
    500 — internal error
"""

from shared.database.connection import get_session
from shared.domain import recommendation_service
from shared.lambda_helpers import build_response, parse_path_uuid
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

            _, err = load_owned_quotation(session, quotation_id, client_id)
            if err:
                return err

            body = recommendation_service.calculate_and_serialize(session, quotation_id)

        # The recommended proposal already reflects any analyst override; never
        # expose the internal override justification/author to the customer.
        body["is_overridden"] = False
        body["override"] = None

        return build_response(200, body)

    except Exception:
        logger.exception("Unhandled error in get_my_recommendation")
        return build_response(500, {"error": "Internal server error"})
