import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from shared.database.models.shipment.embarque import Embarque
from shared.database.models.shipment.enums import EmbarqueState


def _generate_reference(session: Session) -> str:
    """Generate the next sequential reference in EMB-YYYY-XXXX format.

    Locks the latest row to prevent concurrent duplicates. The unique
    constraint on the reference column is the final safety net. EMB- is the GE
    shipment prefix, kept distinct from the SI's SHP- (see Embarque docstring).
    """
    year = datetime.now(timezone.utc).year
    last_reference = session.execute(
        select(Embarque.reference)
        .where(Embarque.reference.op("~")(rf"^EMB-{year}-\d{{4}}$"))
        .order_by(Embarque.reference.desc())
        .limit(1)
        .with_for_update()
    ).scalar()
    next_seq = int(last_reference.split("-")[-1]) + 1 if last_reference else 1
    return f"EMB-{year}-{next_seq:04d}"


def create(
    session: Session,
    *,
    processo_id: uuid.UUID,
    estado: EmbarqueState = EmbarqueState.SOLICITADO,
) -> Embarque:
    embarque = Embarque(
        processo_id=processo_id,
        estado=estado,
        reference=_generate_reference(session),
    )
    session.add(embarque)
    session.flush()
    return embarque


def get(session: Session, embarque_id) -> Optional[Embarque]:
    return session.get(Embarque, embarque_id)


def list(
    session: Session,
    *,
    processo_id: Optional[uuid.UUID] = None,
    estado: Optional[EmbarqueState] = None,
) -> list[Embarque]:
    stmt = select(Embarque)
    if processo_id is not None:
        stmt = stmt.where(Embarque.processo_id == processo_id)
    if estado is not None:
        stmt = stmt.where(Embarque.estado == estado)
    stmt = stmt.order_by(Embarque.created_at.desc())
    return session.execute(stmt).scalars().all()


def update(
    session: Session,
    embarque: Embarque,
    *,
    estado: Optional[EmbarqueState] = None,
) -> Embarque:
    if estado is not None:
        embarque.estado = estado
    embarque.updated_at = datetime.now(timezone.utc)
    session.flush()
    return embarque


