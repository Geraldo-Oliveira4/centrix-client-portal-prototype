import uuid
from datetime import date, datetime
from typing import Optional

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from ..base import Base
from .enums import RouteType, TipoContainer


class Proposal(Base):
    __tablename__ = "centrix_quotation_proposals"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    quotation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("centrix_quotation_quotations.id", ondelete="CASCADE"),
        nullable=False,
    )
    agent_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("centrix_quotation_freight_agents.id", ondelete="RESTRICT"),
        nullable=False,
    )
    total_value: Mapped[float] = mapped_column(Numeric(15, 2), nullable=False)
    freight_value: Mapped[float] = mapped_column(Numeric(15, 2), nullable=False)
    # Breakdown of taxes and surcharges as key-value pairs
    taxes_breakdown: Mapped[dict] = mapped_column(JSONB, nullable=False)
    transit_time: Mapped[int] = mapped_column(Integer, nullable=False)
    route_type: Mapped[Optional[RouteType]] = mapped_column(
        Enum(RouteType, name="proposal_route_type"), nullable=True
    )
    route_detail: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    carrier: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    validity: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    insurance_included: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    incoterm: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    is_winner: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=func.now()
    )
    original_email_s3_key: Mapped[Optional[str]] = mapped_column(
        String, nullable=True
    )
    attachments_s3_keys: Mapped[Optional[dict]] = mapped_column(
        JSONB, nullable=True
    )
    # AI extraction metadata
    extraction_status: Mapped[Optional[str]] = mapped_column(
        String, nullable=True
    )
    extraction_model: Mapped[Optional[str]] = mapped_column(
        String, nullable=True
    )
    extracted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    confidence_scores: Mapped[Optional[dict]] = mapped_column(
        JSONB, nullable=True
    )
    # Review tracking (ARB-1733)
    review_status: Mapped[Optional[str]] = mapped_column(
        String, nullable=True
    )
    review_reason: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True
    )
    # Portal-confirmed routing fields (added in migration 019)
    # Pre-filled from quotation data on the agent portal; agent may adjust if needed.
    proposal_origin: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    proposal_destination: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Agent-supplied fields (added in migration 013)
    numero_oferta: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ptax_percentual: Mapped[Optional[float]] = mapped_column(Numeric(5, 2), nullable=True)
    prazo_pagamento_dias: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    seguro_percentual: Mapped[Optional[float]] = mapped_column(Numeric(10, 4), nullable=True)
    seguro_minimo: Mapped[Optional[float]] = mapped_column(Numeric(10, 2), nullable=True)
    frequencia: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    free_time_dias: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    observations: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    carga_perigosa: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    # Currency metadata for multi-currency proposals (migration 040)
    taxes_currency_breakdown: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    freight_currency: Mapped[Optional[str]] = mapped_column(String(3), nullable=True)
    # Versioning fields (migration 047)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    is_latest: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    parent_proposal_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("centrix_quotation_proposals.id", ondelete="SET NULL"),
        nullable=True,
    )
    version_diff: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    is_recommended: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    additional_costs: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    # FCL only: number of containers the agent priced (must match sum of quotation_equipment.quantity)
    containers_priced: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    # Container type the agent is offering (migration 084). Validated against
    # QuotationEquipment.tipo_container in submit_proposal when the quotation
    # has an explicitly requested container type (ARB-2477).
    offered_container_type: Mapped[Optional[TipoContainer]] = mapped_column(
        Enum(TipoContainer, name="tipocontainer"), nullable=True
    )
    # Soft-delete timestamp (ARB-2429). When set, the proposal is hidden from
    # normal read/list paths but preserved for audit/version history.
    deleted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
