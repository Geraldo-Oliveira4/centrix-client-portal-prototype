import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from shared.database.models.shipment.enums import FollowupOrigem
from shared.database.models.shipment.followup import Followup


def list_by_embarque(session: Session, embarque_id: uuid.UUID) -> list[Followup]:
    return (
        session.execute(
            select(Followup)
            .where(Followup.embarque_id == embarque_id)
            .order_by(Followup.created_at.desc())
        )
        .scalars()
        .all()
    )


def get(session: Session, followup_id: uuid.UUID) -> Optional[Followup]:
    return session.get(Followup, followup_id)


def create(
    session: Session,
    *,
    embarque_id: uuid.UUID,
    tipo_ocorrencia: str,
    origem: str,
    nota: Optional[str] = None,
    grupo: Optional[str] = None,
    responsavel_id: Optional[str] = None,
) -> Followup:
    followup = Followup(
        id=uuid.uuid4(),
        embarque_id=embarque_id,
        tipo_ocorrencia=tipo_ocorrencia,
        origem=origem,
        nota=nota,
        grupo=grupo,
        responsavel_id=responsavel_id,
    )
    session.add(followup)
    session.flush()
    return followup


def delete(session: Session, followup: Followup) -> None:
    session.delete(followup)
    session.flush()


def exists_recent(
    session: Session,
    embarque_id: uuid.UUID,
    tipo_ocorrencia: str,
    hours: int = 24,
) -> bool:
    """Retorna True se ja existe followup AUTOMATICO do mesmo tipo nas ultimas `hours` horas."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    return (
        session.execute(
            select(Followup.id)
            .where(
                Followup.embarque_id == embarque_id,
                Followup.tipo_ocorrencia == tipo_ocorrencia,
                Followup.origem == FollowupOrigem.AUTOMATICO,
                Followup.created_at >= cutoff,
            )
            .limit(1)
        ).scalar_one_or_none()
        is not None
    )
