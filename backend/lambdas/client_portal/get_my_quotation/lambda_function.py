from shared.database.connection import get_session
from shared.database.models.quotation.enums import GuardRailDecision
from shared.database.repositories import (
    freight_agent_repository,
    proposal_repository,
    proposal_score_repository,
    quotation_equipment_repository,
    quotation_repository,
    quotation_volume_repository,
)
from shared.domain import guard_rail
from shared.lambda_helpers import build_response, parse_path_uuid
from shared.observability import logger, tracer
from shared.portal_helpers import (
    get_portal_client_id,
    load_owned_quotation,
    serialize_proposals_for_portal_with_flags,
    serialize_quotation_for_portal,
)


@tracer.capture_lambda_handler
@logger.inject_lambda_context(correlation_id_path="requestContext.requestId")
def lambda_handler(event, context):
    try:
        quotation_id, err = parse_path_uuid(event, "id")
        if err:
            return err

        with get_session() as session:
            client_id, err = get_portal_client_id(event, session)
            if err:
                return err

            quotation, err = load_owned_quotation(session, quotation_id, client_id)
            if err:
                return err

            equipments = quotation_equipment_repository.list_by_quotation(
                session, quotation.id
            )
            volumes = quotation_volume_repository.list_by_quotation(
                session, quotation.id
            )
            proposals = proposal_repository.list_by_quotation(session, quotation.id)
            scores_by_proposal = {
                s.proposal_id: s
                for s in proposal_score_repository.list_by_quotation(session, quotation.id)
            }

            for proposal in proposals:
                proposal.agent = freight_agent_repository.get(session, proposal.agent_id)
                proposal.score = scores_by_proposal.get(proposal.id)

            result = serialize_quotation_for_portal(
                quotation,
                equipments=equipments,
                volumes=volumes,
                proposals_count=len(proposals),
            )
            result["proposals"] = serialize_proposals_for_portal_with_flags(proposals, quotation=quotation)

            is_portal_origin = quotation_repository.was_created_by_portal(session, quotation.id)
            # Self-service features (RFQ dispatch, document upload, history, cancel)
            # are only offered for quotations the client created via the portal.
            # Analyst-created quotations are view/approve only.
            result["created_via_portal"] = is_portal_origin
            result["guard_rail_active"] = guard_rail.active_from_proposals(
                quotation, is_portal_origin=is_portal_origin, proposals=proposals
            )
            # When an analyst blocks the guard rail with a justification, surface
            # that message to the client so they know what Freitas asked for.
            if quotation.guard_rail_decision == GuardRailDecision.BLOCKED:
                result["guard_rail_block_reason"] = quotation.guard_rail_block_reason

            return build_response(200, {"quotation": result})

    except Exception:
        logger.exception("Unhandled error")
        return build_response(500, {"error": "Internal server error"})
