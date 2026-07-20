from shared.database.connection import get_session
from shared.database.repositories import (
    freight_agent_repository,
    proposal_repository,
    proposal_score_repository,
    quotation_repository,
)
from shared.domain.portal_buckets import (
    PORTAL_ALL_BUCKETS,
    PORTAL_BUCKET_ORDER,
    bucket_for,
)
from shared.domain import guard_rail
from shared.domain.recommendation_service import resolve_comparison_ptax, normalize_proposal_cost_to_brl
from shared.lambda_helpers import build_response, get_user_id
from shared.observability import logger, tracer
from shared.portal_helpers import get_portal_client_id, serialize_quotation_for_portal


def _best_proposal(proposals, comparison_ptax: float | None):
    """Lowest BRL-normalised cost. Ties broken by received_at (oldest wins)."""
    if not proposals:
        return None
    return min(
        proposals,
        key=lambda p: (normalize_proposal_cost_to_brl(p, ptax_override=comparison_ptax), p.received_at),
    )


@tracer.capture_lambda_handler
@logger.inject_lambda_context(correlation_id_path="requestContext.requestId")
def lambda_handler(event, context):
    try:
        with get_session() as session:
            # get_portal_client_id already enforces `portal` group membership
            # internally; get_user_id just reads the sub for created_by_me.
            sub = get_user_id(event)

            client_id, err = get_portal_client_id(event, session)
            if err:
                return err

            quotations = quotation_repository.get_all(session, client_id=client_id)

            proposals_by_q = proposal_repository.list_by_quotation_ids(
                session, [q.id for q in quotations]
            )
            comparison_ptax_by_q = {
                q.id: resolve_comparison_ptax(q, proposals_by_q.get(q.id, []))
                for q in quotations
            }
            best_by_q = {
                q.id: _best_proposal(proposals_by_q.get(q.id, []), comparison_ptax_by_q[q.id])
                for q in quotations
            }
            agent_ids = [b.agent_id for b in best_by_q.values() if b is not None]
            agents_by_id = freight_agent_repository.get_by_ids(session, agent_ids)

            best_proposal_ids = [b.id for b in best_by_q.values() if b is not None]
            scores_by_proposal = proposal_score_repository.get_by_proposal_ids(
                session, best_proposal_ids
            )
            
            created_by_me_ids = quotation_repository.batch_fetch_created_by_portal(
                session, [q.id for q in quotations], user_id=sub
            )
            # Guard rail (ARB-2449): scope is any portal-origin quotation (not only
            # the ones this user opened), so a client sees the lock even on a
            # quotation a colleague on the same client account created.
            portal_origin_ids = quotation_repository.batch_fetch_created_by_portal(
                session, [q.id for q in quotations]
            )

            buckets: dict[str, list[dict]] = {b: [] for b in PORTAL_ALL_BUCKETS}

            for q in quotations:
                proposals = proposals_by_q.get(q.id, [])
                best = best_by_q[q.id]
                if best is not None:
                    best.agent = agents_by_id.get(best.agent_id)
                    best.score = scores_by_proposal.get(best.id)
                item = serialize_quotation_for_portal(
                    q,
                    best_proposal=best,
                    proposals_count=len(proposals),
                    ptax_override=comparison_ptax_by_q[q.id],
                )
                item["created_by_me"] = q.id in created_by_me_ids
                item["guard_rail_active"] = guard_rail.active_from_proposals(
                    q, is_portal_origin=q.id in portal_origin_ids, proposals=proposals
                )
                buckets[bucket_for(q.state)].append(item)

            summary = {
                "aprovar_propostas": len(buckets.get("aguardando_aprovacao", [])),
                "aguardando_propostas": len(buckets.get("buscando_propostas", [])),
            }

            return build_response(200, {
                "buckets": buckets,
                "bucket_order": PORTAL_BUCKET_ORDER,
                "total": len(quotations),
                "summary": summary,
            })

    except Exception:
        logger.exception("Unhandled error")
        return build_response(500, {"error": "Internal server error"})
