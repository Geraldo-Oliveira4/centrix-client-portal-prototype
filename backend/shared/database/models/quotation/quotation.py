import uuid
from datetime import date, datetime
from typing import Optional

from sqlalchemy import (
    ARRAY,
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from ..base import Base
from .enums import (
    CargaPerigosa,
    Currency,
    DeclineReason,
    ExtractionStatus,
    GuardRailDecision,
    Modal,
    PriceOrPerformance,
    QuotationState,
    ServiceType,
    TipoCotacao,
    TipoEmbarque,
    UrgencyLevel,
)


class Quotation(Base):
    __tablename__ = "centrix_quotation_quotations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # Human-readable reference (e.g. COT-2026-001), unique per quotation
    reference: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    state: Mapped[QuotationState] = mapped_column(
        Enum(QuotationState, name="quotationstate"),
        nullable=False,
        default=QuotationState.TRIAGEM_IA,
    )
    priority_score: Mapped[Optional[float]] = mapped_column(
        Numeric(5, 2), nullable=True
    )
    completeness_score: Mapped[Optional[float]] = mapped_column(
        Numeric(5, 2), nullable=True
    )

    # Freight details extracted from the incoming email
    service_type: Mapped[Optional[ServiceType]] = mapped_column(
        Enum(ServiceType, name="servicetype"), nullable=True
    )
    modal: Mapped[Optional[Modal]] = mapped_column(
        Enum(Modal, name="modal"), nullable=True
    )
    # Maritime sub-type (FCL / LCL / BREAK_BULK) — only relevant when modal=MARITIMO
    tipo_embarque: Mapped[Optional[TipoEmbarque]] = mapped_column(
        Enum(TipoEmbarque, name="tipoembarque"), nullable=True
    )
    # Quotation type: formal offer (REAL) or budget estimate (ESTIMATIVA)
    tipo_cotacao: Mapped[Optional[TipoCotacao]] = mapped_column(
        Enum(TipoCotacao, name="tipocotacao"), nullable=True
    )
    # Date when the quotation was opened/registered (not the system created_at)
    data_cotacao: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    origin: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    # Specific port/airport names — more granular than origin
    porto_embarque: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    porto_destino: Mapped[Optional[list[str]]] = mapped_column(ARRAY(String), nullable=True)
    aeroporto_embarque: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    aeroporto_destino: Mapped[Optional[list[str]]] = mapped_column(ARRAY(String), nullable=True)
    # Whether final-mile delivery at destination is included in the quote
    incluir_entrega_destino_final: Mapped[Optional[bool]] = mapped_column(
        Boolean, nullable=True
    )
    incoterm: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    product: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    # Desired delivery date+time (TIMESTAMPTZ). Time component is optional but supported.
    desired_deadline: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Client's hard deadline (date when cargo is absolutely needed by)
    data_limite_necessidade: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    # Date when cargo will be ready for pickup/loading
    data_prontidao: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    declared_value: Mapped[Optional[float]] = mapped_column(
        Numeric(15, 2), nullable=True
    )
    declared_value_currency: Mapped[Optional[Currency]] = mapped_column(
        Enum(Currency, name="currency"), nullable=True
    )
    stackability: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    # Whether cargo can be tilted/tipped during transport
    carga_tombavel: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    insurance_required: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    destination_yard: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    # Final delivery address when porta-a-porta is requested (air modal only)
    endereco_entrega_final: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    # DPU: seller must unload at destination; flag captures explicit client requirement
    necessidade_descarga: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    # DDP: NCM code required for customs declaration and duty calculation
    ncm: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    # Exporter/shipper company name — free text, extracted from commercial docs
    exportador: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    # Country of origin for customs purposes (e.g. "China", "Alemanha")
    pais_procedencia: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    # Taxable weight in kg — entered by analyst or provided by agent
    peso_taxado: Mapped[Optional[float]] = mapped_column(Numeric(10, 2), nullable=True)
    observations: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Cargo classification
    carga_perigosa: Mapped[Optional[CargaPerigosa]] = mapped_column(
        Enum(CargaPerigosa, name="cargaperigosa"), nullable=True
    )
    # UN dangerous goods number — required when carga_perigosa is IMO or RA
    un_number: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    # IMO class code — required when carga_perigosa is IMO
    imo_class: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    # Temperature range in Celsius — only for refrigerated/reefer cargo
    temperatura_min: Mapped[Optional[float]] = mapped_column(
        Numeric(5, 1), nullable=True
    )
    temperatura_max: Mapped[Optional[float]] = mapped_column(
        Numeric(5, 1), nullable=True
    )
    # Client's own reference for this shipment
    client_reference: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    # Flags indicating the freight agent should choose the port/airport (not the analyst)
    agente_define_porto_embarque: Mapped[Optional[bool]] = mapped_column(
        Boolean, nullable=True
    )
    agente_define_porto_destino: Mapped[Optional[bool]] = mapped_column(
        Boolean, nullable=True
    )
    agente_define_aeroporto_embarque: Mapped[Optional[bool]] = mapped_column(
        Boolean, nullable=True
    )
    agente_define_aeroporto_destino: Mapped[Optional[bool]] = mapped_column(
        Boolean, nullable=True
    )
    agente_define_local_coleta: Mapped[Optional[bool]] = mapped_column(
        Boolean, nullable=True
    )
    # Negotiated PTAX rate (e.g. "1%", "2%", ..., "5%")
    ptax_negociada: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    # Client's decision driver for this quotation: price-first or performance-first
    price_or_performance: Mapped[Optional[PriceOrPerformance]] = mapped_column(
        Enum(PriceOrPerformance, name="priceorperformance"), nullable=True
    )
    # Manual urgency classification set by the analyst
    urgency: Mapped[Optional[UrgencyLevel]] = mapped_column(
        Enum(UrgencyLevel, name="urgencylevel"), nullable=True
    )

    # Cognito user ID of the responsible analyst
    analyst_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    client_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("centrix_quotation_clients.id", ondelete="SET NULL"),
        nullable=True,
    )
    # Exporter feeding the cargo profile into audit rules 1.5/1.6 (ARB-2443)
    exporter_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("centrix_exporters.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Terminal state fields (populated on FECHADA / DECLINADA)
    decline_reason: Mapped[Optional[DeclineReason]] = mapped_column(
        Enum(DeclineReason, name="declinereason"), nullable=True
    )
    decline_note: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    winning_agent_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("centrix_quotation_freight_agents.id", ondelete="SET NULL"),
        nullable=True,
    )
    quoted_value_usd: Mapped[Optional[float]] = mapped_column(
        Numeric(15, 2), nullable=True
    )

    # AI extraction metadata
    confidence_scores: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    extraction_status: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    extraction_model: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    extracted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Client matching metadata (populated by extract_quotation_data)
    sender_email: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    client_match_status: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    client_match_candidates: Mapped[Optional[dict]] = mapped_column(
        JSONB, nullable=True
    )

    # S3 references for the originating email and any attachments
    original_email_s3_key: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    attachments_s3_keys: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    # Re-cotação / duplication traceability (ARB-2053, ARB-2056)
    # UUID of the quotation this one was cloned from (duplicate or re-cotacao flow)
    originated_from_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("centrix_quotation_quotations.id", ondelete="SET NULL"),
        nullable=True,
    )
    # Free-text reason provided by the operator when triggering a re-cotacao
    recotacao_motivo: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Durable state-transition timestamps. Stamped by the state machine on each
    # transition into the matching state (most recent occurrence wins). These are
    # the authoritative source for the kanban card dates — never derived from the
    # audit log, which is history and may be pruned.
    #
    # These are never cleared: a value is the timestamp of the last entry into the
    # state, NOT proof the quotation is currently in it. A re-cotacao (FECHADA ->
    # COTANDO) leaves closed_at set while the quotation moves on; a declined card
    # carries both sent_at and declined_at. Read each column as "when it last
    # happened", and gate on quotation.state for "is it in this state now".
    sent_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    closed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    declined_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Guard rail (ARB-2449) — portal-flow safety net. The analyst's decision on a
    # quotation held by the guard rail. null = pending review. RELEASED unlocks the
    # client's portal approval; BLOCKED keeps it locked. These persist the human
    # decision only — the computed evaluation lives in shared/domain/guard_rail.py.
    guard_rail_decision: Mapped[Optional[GuardRailDecision]] = mapped_column(
        Enum(GuardRailDecision, name="guardraildecision"), nullable=True
    )
    guard_rail_block_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Cognito user ID of the analyst who released/blocked the guard rail
    guard_rail_reviewed_by: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    guard_rail_reviewed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=func.now()
    )
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
