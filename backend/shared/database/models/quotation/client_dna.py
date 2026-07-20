import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from ..base import Base
from .enums import (
    InsuranceResponsibility,
    LogisticsType,
    Modal,
    PriceOrPerformance,
    ServiceType,
    TipoEmbarque,
)


class QuotationClientDna(Base):
    __tablename__ = "centrix_quotation_client_dna"
    __table_args__ = (
        UniqueConstraint("client_id", "service_type", name="uq_client_dna_client_service"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("centrix_quotation_clients.id", ondelete="CASCADE"),
        nullable=False,
    )
    # A client may keep one DNA per operation (import vs export). Selected by the
    # quotation's ServiceType. Backfilled to IMPORTACAO + cloned to EXPORTACAO in
    # migration 089 (ARB-2445).
    service_type: Mapped[ServiceType] = mapped_column(
        Enum(ServiceType, name="servicetype"),
        nullable=False,
        default=ServiceType.IMPORTACAO,
    )
    modality: Mapped[Optional[Modal]] = mapped_column(
        Enum(Modal, name="modal"), nullable=True
    )
    tipo_embarque: Mapped[Optional[TipoEmbarque]] = mapped_column(
        Enum(TipoEmbarque, name="tipoembarque"), nullable=True
    )
    logistics_type: Mapped[Optional[LogisticsType]] = mapped_column(
        Enum(LogisticsType, name="logisticstype"), nullable=True
    )
    # List of preferred freight agent IDs
    default_agents: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    # Legacy free-text field, replaced by the 3 modal-specific columns below
    # (ARB-2384). Kept for rollback safety, no longer written by new code.
    destination_yard: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    destination_yard_aereo: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    destination_yard_maritimo_fcl: Mapped[Optional[str]] = mapped_column(
        String, nullable=True
    )
    destination_yard_maritimo_lcl: Mapped[Optional[str]] = mapped_column(
        String, nullable=True
    )
    insurance_responsibility: Mapped[Optional[InsuranceResponsibility]] = mapped_column(
        Enum(InsuranceResponsibility, name="insuranceresponsibility"), nullable=True
    )
    quotation_particularities: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    dangerous_cargo_shipper: Mapped[Optional[bool]] = mapped_column(nullable=True)
    price_or_performance: Mapped[Optional[PriceOrPerformance]] = mapped_column(
        Enum(PriceOrPerformance, name="priceorperformance"), nullable=True
    )
    cargo_profile: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    contact_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    contact_email: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    # Cognito user ID of the assigned analyst
    assigned_analyst: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    exige_oea: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    anvisa_restrictions: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    # Preferred export loading point (used by audit engine rule 1.3)
    preferred_embarque_local: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
