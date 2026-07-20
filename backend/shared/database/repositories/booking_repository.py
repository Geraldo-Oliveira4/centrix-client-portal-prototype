import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from shared.database.models.shipment.booking import Booking

_UPDATABLE_FIELDS = (
    "cia_aerea_armador",
    "mawb_mbl",
    "hawb_hbl",
    "containers",
    "frete_valor",
    "seguro_valor",
    "observacao",
)


def get(session: Session, embarque_id: uuid.UUID) -> Optional[Booking]:
    return session.execute(
        select(Booking).where(Booking.embarque_id == embarque_id)
    ).scalar_one_or_none()


def upsert(session: Session, embarque_id: uuid.UUID, **fields) -> Booking:
    """Cria ou atualiza o booking do embarque (idempotente).

    SELECT ... FOR UPDATE previne duplicatas em invocacoes concorrentes. A
    restricao UNIQUE em embarque_id e a rede de seguranca final.
    """
    booking = session.execute(
        select(Booking).where(Booking.embarque_id == embarque_id).with_for_update()
    ).scalar_one_or_none()
    if booking is None:
        booking = Booking(id=uuid.uuid4(), embarque_id=embarque_id)
        session.add(booking)
    for field in _UPDATABLE_FIELDS:
        if field in fields:
            setattr(booking, field, fields[field])
    booking.updated_at = datetime.now(timezone.utc)
    session.flush()
    return booking
