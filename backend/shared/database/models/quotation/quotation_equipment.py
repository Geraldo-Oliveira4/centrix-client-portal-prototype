import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from ..base import Base
from .enums import PesoUnidade, TipoContainer


class QuotationEquipment(Base):
    """One FCL container line within a maritime quotation.

    A quotation may have multiple equipment rows (e.g. 2x STANDARD_20 + 1x HIGH_CUBE_40).
    Aggregate weight/volume on the parent Quotation can be computed from these rows.
    """

    __tablename__ = "centrix_quotation_equipments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    quotation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("centrix_quotation_quotations.id", ondelete="CASCADE"),
        nullable=False,
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    tipo_container: Mapped[TipoContainer] = mapped_column(
        Enum(TipoContainer, name="tipocontainer"), nullable=False
    )
    volume_m3: Mapped[Optional[float]] = mapped_column(Numeric(10, 3), nullable=True)
    peso_bruto: Mapped[Optional[float]] = mapped_column(Numeric(12, 3), nullable=True)
    peso_unidade: Mapped[PesoUnidade] = mapped_column(
        Enum(PesoUnidade, name="pesounidade"), nullable=False, default=PesoUnidade.KG
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=func.now()
    )
