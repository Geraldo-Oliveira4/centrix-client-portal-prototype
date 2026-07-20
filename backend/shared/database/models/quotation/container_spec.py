from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Enum, Integer, Numeric
from sqlalchemy.orm import Mapped, mapped_column

from ..base import Base
from .enums import TipoContainer


class ContainerSpec(Base):
    """Physical specifications for each container type.

    Reference table — populated once and used for validation logic
    (e.g. checking whether declared cargo volume exceeds container capacity).
    Dimensions are stored in millimetres; weights in kilograms.
    """

    __tablename__ = "centrix_quotation_container_specs"

    tipo_container: Mapped[TipoContainer] = mapped_column(
        Enum(TipoContainer, name="tipocontainer"), primary_key=True
    )
    comprimento_interno_mm: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    largura_interna_mm: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    altura_interna_mm: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    capacidade_m3: Mapped[Optional[float]] = mapped_column(Numeric(8, 2), nullable=True)
    carga_maxima_kg: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    tara_kg: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    peso_max_total_kg: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
