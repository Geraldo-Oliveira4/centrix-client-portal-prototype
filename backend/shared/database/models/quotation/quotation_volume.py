import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from ..base import Base
from .enums import DimensaoUnidade, PesoUnidade, TipoEmbalagem


class QuotationVolume(Base):
    """One package/volume line within an LCL or air quotation.

    A quotation may have multiple volume rows, each representing a type of package.
    Aggregate weight/volume on the parent Quotation can be computed from these rows.
    """

    __tablename__ = "centrix_quotation_volumes"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    quotation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("centrix_quotation_quotations.id", ondelete="CASCADE"),
        nullable=False,
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    embalagem: Mapped[Optional[TipoEmbalagem]] = mapped_column(
        Enum(TipoEmbalagem, name="tipoembalagem"), nullable=True
    )
    peso_bruto: Mapped[Optional[float]] = mapped_column(Numeric(12, 3), nullable=True)
    peso_unidade: Mapped[PesoUnidade] = mapped_column(
        Enum(PesoUnidade, name="pesounidade"), nullable=False, default=PesoUnidade.KG
    )
    comprimento: Mapped[Optional[float]] = mapped_column(Numeric(10, 3), nullable=True)
    largura: Mapped[Optional[float]] = mapped_column(Numeric(10, 3), nullable=True)
    altura: Mapped[Optional[float]] = mapped_column(Numeric(10, 3), nullable=True)
    dimensao_unidade: Mapped[DimensaoUnidade] = mapped_column(
        Enum(DimensaoUnidade, name="dimensaounidade"), nullable=False, default=DimensaoUnidade.CM
    )
    volume_m3: Mapped[Optional[float]] = mapped_column(Numeric(10, 3), nullable=True)
    # Air freight specific: IOF inspection flag per volume line
    inspecao_iof: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=func.now()
    )
