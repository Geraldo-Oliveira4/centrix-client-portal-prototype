import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from ..base import Base


class Booking(Base):
    """Dados de Frete (Booking) de um embarque.

    Relacao 1:1 com Embarque — o upsert em booking_repository garante que nunca
    existam duas linhas para o mesmo embarque_id.
    """

    __tablename__ = "centrix_shipment_bookings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    embarque_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("centrix_shipment_embarques.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    cia_aerea_armador: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    mawb_mbl: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    hawb_hbl: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    containers: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    frete_valor: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 2), nullable=True)
    seguro_valor: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 2), nullable=True)
    observacao: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=func.now()
    )
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
