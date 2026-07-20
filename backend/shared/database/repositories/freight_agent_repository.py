import uuid
from datetime import date, datetime, timezone
from typing import List, Optional

from sqlalchemy.orm import Session

from shared.database.models.quotation.freight_agent import FreightAgent, ModalRegion

_UNSET = object()


def create(
    session: Session,
    name: str,
    email: str,
    preferred_channel: Optional[str] = None,
    modal_regions: Optional[List[ModalRegion]] = None,
    certificacao_oea: Optional[bool] = None,
    data_validade_oea: Optional[date] = None,
    carga_imo: Optional[bool] = None,
) -> FreightAgent:
    agent = FreightAgent(
        name=name,
        email=email,
        preferred_channel=preferred_channel,
        modal_regions=modal_regions,
        certificacao_oea=certificacao_oea,
        data_validade_oea=data_validade_oea,
        carga_imo=carga_imo,
        reliability_score=100.0,
        total_quotations=0,
        error_count=0,
    )
    session.add(agent)
    session.flush()
    return agent


def get(session: Session, agent_id: uuid.UUID) -> Optional[FreightAgent]:
    return session.get(FreightAgent, agent_id)


def get_by_ids(
    session: Session, agent_ids: list[uuid.UUID]
) -> dict[uuid.UUID, FreightAgent]:
    """Batch version of `get` — fetches many agents in a single query and
    returns them keyed by id. Use in list/kanban handlers to avoid N+1
    patterns when embedding agent info in multiple proposals/quotations.
    Missing ids are simply absent from the returned dict.
    """
    if not agent_ids:
        return {}
    agents = (
        session.query(FreightAgent)
        .filter(FreightAgent.id.in_(agent_ids))
        .all()
    )
    return {a.id: a for a in agents}


def get_by_email(session: Session, email: str) -> Optional[FreightAgent]:
    """Look up a freight agent by email address (case-insensitive)."""
    return (
        session.query(FreightAgent)
        .filter(FreightAgent.email.ilike(email.strip()))
        .first()
    )


def get_all(
    session: Session,
    name: Optional[str] = None,
) -> list[FreightAgent]:
    query = session.query(FreightAgent)

    if name is not None:
        query = query.filter(FreightAgent.name.ilike(f"%{name}%"))

    return list(query.order_by(FreightAgent.reliability_score.desc().nullslast()).all())


def update(
    session: Session,
    agent_id: uuid.UUID,
    name: Optional[str] = None,
    email: Optional[str] = None,
    preferred_channel: Optional[str] = None,
    modal_regions: Optional[List[ModalRegion]] = None,
    certificacao_oea: Optional[bool] = None,
    data_validade_oea=_UNSET,
    carga_imo: Optional[bool] = None,
) -> Optional[FreightAgent]:
    agent = session.get(FreightAgent, agent_id)
    if agent is None:
        return None

    if name is not None:
        agent.name = name
    if email is not None:
        agent.email = email
    if preferred_channel is not None:
        agent.preferred_channel = preferred_channel
    if modal_regions is not None:
        agent.modal_regions = modal_regions
    if certificacao_oea is not None:
        agent.certificacao_oea = certificacao_oea
    if data_validade_oea is not _UNSET:
        agent.data_validade_oea = data_validade_oea
    if carga_imo is not None:
        agent.carga_imo = carga_imo

    agent.updated_at = datetime.now(timezone.utc)
    session.flush()
    return agent
