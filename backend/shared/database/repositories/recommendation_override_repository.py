import uuid
from typing import Optional

from sqlalchemy.orm import Session

from shared.database.models.quotation.recommendation_override import RecommendationOverride


def create(
    session: Session,
    quotation_id: uuid.UUID,
    proposal_id: Optional[uuid.UUID],
    agent_name: str,
    justification: str,
    overridden_by: str,
    recommended_proposal_id: Optional[uuid.UUID] = None,
) -> RecommendationOverride:
    override = RecommendationOverride(
        quotation_id=quotation_id,
        proposal_id=proposal_id,
        agent_name=agent_name,
        justification=justification,
        overridden_by=overridden_by,
        recommended_proposal_id=recommended_proposal_id,
    )
    session.add(override)
    session.flush()
    return override


def get_latest(session: Session, quotation_id: uuid.UUID) -> Optional[RecommendationOverride]:
    return (
        session.query(RecommendationOverride)
        .filter(RecommendationOverride.quotation_id == quotation_id)
        .order_by(RecommendationOverride.created_at.desc())
        .first()
    )


def list_by_quotation(
    session: Session, quotation_id: uuid.UUID
) -> list[RecommendationOverride]:
    return (
        session.query(RecommendationOverride)
        .filter(RecommendationOverride.quotation_id == quotation_id)
        .order_by(RecommendationOverride.created_at.desc())
        .all()
    )
