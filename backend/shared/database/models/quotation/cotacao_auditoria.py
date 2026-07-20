import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import CheckConstraint, DateTime, Enum, ForeignKey, SmallInteger, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from ..base import Base
from .enums import AuditAcaoTomada, AuditResultado, AuditResolucaoTipo


class CotacaoAuditoria(Base):
    __tablename__ = "centrix_quotation_cotacao_auditoria"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    cotacao_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("centrix_quotation_quotations.id", ondelete="CASCADE"),
        nullable=False,
    )
    momento: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    agente_carga_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("centrix_quotation_freight_agents.id", ondelete="SET NULL"),
        nullable=True,
    )
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=func.now()
    )
    resultado: Mapped[AuditResultado] = mapped_column(
        Enum(
            AuditResultado,
            name="auditresultado",
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=False,
    )
    divergencias: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    acao_tomada: Mapped[AuditAcaoTomada] = mapped_column(
        Enum(
            AuditAcaoTomada,
            name="auditacaotomada",
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=False,
    )
    # Cognito user sub — not a FK; Cognito is authoritative for user identity
    resolvido_por: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    resolvido_em: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    resolucao_tipo: Mapped[Optional[AuditResolucaoTipo]] = mapped_column(
        Enum(
            AuditResolucaoTipo,
            name="auditresolucaotipo",
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=True,
    )
    observacao: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    __table_args__ = (
        CheckConstraint("momento IN (1, 2, 3)", name="ck_cotacao_auditoria_momento"),
    )
