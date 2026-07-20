import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from shared.database.models.quotation.proposal_score import ProposalScore


def upsert_for_quotation(
    session: Session,
    quotation_id: uuid.UUID,
    scores: list[dict],
) -> list[ProposalScore]:
    """Replace all score rows for a quotation with a fresh set.

    Each dict in scores must have: proposal_id, is_eligible, and optionally
    ineligibility_reason, cost_score, transit_score, validity_score, total_score,
    frequency_score, route_score, free_time_score, validade_status,
    posicao_ranking, motivo.
    """
    session.query(ProposalScore).filter(
        ProposalScore.quotation_id == quotation_id
    ).delete()
    session.flush()

    now = datetime.now(timezone.utc)
    created = []
    for s in scores:
        row = ProposalScore(
            quotation_id=quotation_id,
            proposal_id=s["proposal_id"],
            is_eligible=s["is_eligible"],
            ineligibility_reason=s.get("ineligibility_reason"),
            cost_score=s.get("cost_score"),
            transit_score=s.get("transit_score"),
            validity_score=s.get("validity_score"),
            frequency_score=s.get("frequency_score"),
            route_score=s.get("route_score"),
            free_time_score=s.get("free_time_score"),
            total_score=s.get("total_score"),
            validade_status=s.get("validade_status"),
            posicao_ranking=s.get("posicao_ranking"),
            motivo=s.get("motivo"),
            calculated_at=now,
        )
        session.add(row)
        created.append(row)
    session.flush()
    return created


def get_recommended_proposal_id(
    session: Session, quotation_id: uuid.UUID
) -> Optional[uuid.UUID]:
    """Return the proposal_id with the highest total_score among eligible proposals.

    Validity is a weighted criterion (ARB-2478), not a hard gate — an at-risk
    proposal can still be recommended, penalized proportionally by its
    validity_score. Expired proposals never reach here: they are excluded from
    scoring entirely upstream (calculate_and_persist) and have no score row.
    """
    scores = list_by_quotation(session, quotation_id)
    eligible = [
        s for s in scores
        if s.is_eligible and s.total_score is not None
    ]
    if not eligible:
        return None
    return max(eligible, key=lambda s: float(s.total_score)).proposal_id


def list_by_quotation(session: Session, quotation_id: uuid.UUID) -> list[ProposalScore]:
    return (
        session.query(ProposalScore)
        .filter(ProposalScore.quotation_id == quotation_id)
        .all()
    )


def get_by_proposal(session: Session, proposal_id: uuid.UUID) -> Optional[ProposalScore]:
    return (
        session.query(ProposalScore)
        .filter(ProposalScore.proposal_id == proposal_id)
        .first()
    )


def get_by_proposal_ids(
    session: Session, proposal_ids: list[uuid.UUID]
) -> dict[uuid.UUID, ProposalScore]:
    """Batch-fetch scores keyed by proposal_id. Missing proposals are absent."""
    if not proposal_ids:
        return {}
    scores = (
        session.query(ProposalScore)
        .filter(ProposalScore.proposal_id.in_(proposal_ids))
        .all()
    )
    return {s.proposal_id: s for s in scores}
