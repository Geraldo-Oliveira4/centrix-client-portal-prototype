import uuid
from datetime import date, datetime
from enum import Enum
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Boolean, Date, DateTime, Enum as SQLEnum, Integer, Numeric, String
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from ..base import Base

if TYPE_CHECKING:
    from .freight_agent_contact import FreightAgentContact


class ModalRegion(str, Enum):
    AEREO_ASIA = "AEREO_ASIA"
    AEREO_EUROPA = "AEREO_EUROPA"
    AEREO_AMERICAS = "AEREO_AMERICAS"
    MARITIMO_FCL_ASIA = "MARITIMO_FCL_ASIA"
    MARITIMO_FCL_EUROPA = "MARITIMO_FCL_EUROPA"
    MARITIMO_FCL_AMERICAS = "MARITIMO_FCL_AMERICAS"
    MARITIMO_LCL_ASIA = "MARITIMO_LCL_ASIA"
    MARITIMO_LCL_EUROPA = "MARITIMO_LCL_EUROPA"
    MARITIMO_LCL_AMERICAS = "MARITIMO_LCL_AMERICAS"


class FreightAgent(Base):
    __tablename__ = "centrix_quotation_freight_agents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str] = mapped_column(String, nullable=False)
    preferred_channel: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    reliability_score: Mapped[Optional[float]] = mapped_column(
        Numeric(5, 2), nullable=True
    )
    total_quotations: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
    error_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
    modal_regions: Mapped[Optional[List[ModalRegion]]] = mapped_column(
        ARRAY(SQLEnum(ModalRegion, name="modal_region", create_type=False)),
        nullable=True,
    )
    certificacao_oea: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    data_validade_oea: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    carga_imo: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=func.now()
    )
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    contacts: Mapped[list["FreightAgentContact"]] = relationship(
        "FreightAgentContact",
        back_populates="freight_agent",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
