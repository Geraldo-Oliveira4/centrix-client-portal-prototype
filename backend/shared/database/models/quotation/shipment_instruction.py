import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from ..base import Base
from .enums import SIStatus


class ShipmentInstruction(Base):
    __tablename__ = "centrix_shipment_instructions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # Human-readable reference e.g. SHP-2026-0001
    reference: Mapped[str] = mapped_column(String, nullable=False, unique=True)

    quotation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("centrix_quotation_quotations.id", ondelete="CASCADE"),
        nullable=False,
    )
    # Winning proposal at the time the SI was created
    proposal_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("centrix_quotation_proposals.id", ondelete="SET NULL"),
        nullable=True,
    )

    status: Mapped[SIStatus] = mapped_column(
        Enum(SIStatus, name="sistatus"),
        nullable=False,
        default=SIStatus.RASCUNHO,
    )

    # Party data — pre-populated from DNA/Client, editable before send.
    # Schema: {nome, cnpj, endereco, pic, tel, email}
    exportador: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    consignatario: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    notificado: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    # Incoterm fields — divergence between these two triggers RN-01 alert.
    incoterm_cotado: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    incoterm_aprovado: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # Structured flags (replaces KeeperQuotes free-text flags)
    ptax_tipo: Mapped[Optional[str]] = mapped_column(String, nullable=True)  # "padrao" | "negociado"
    ptax_valor: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4), nullable=True)
    incluir_seguro: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    solicitar_agente_origem: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    prontidao_prevista: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    instrucoes_livres: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # LOG COTACAO follow emails — pre-populated from DNA, editable
    cc_emails: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)

    # Filled after agent responds with local origin agent info
    agente_origem: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_by: Mapped[str] = mapped_column(String, nullable=False)
    sent_by: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=func.now()
    )
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
