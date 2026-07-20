import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, SmallInteger, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from ..base import Base


class ProposalScore(Base):
    __tablename__ = "centrix_quotation_proposal_scores"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    quotation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("centrix_quotation_quotations.id", ondelete="CASCADE"),
        nullable=False,
    )
    proposal_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("centrix_quotation_proposals.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    is_eligible: Mapped[bool] = mapped_column(Boolean, nullable=False)
    ineligibility_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    cost_score: Mapped[Optional[float]] = mapped_column(Numeric(6, 2), nullable=True)
    transit_score: Mapped[Optional[float]] = mapped_column(Numeric(6, 2), nullable=True)
    validity_score: Mapped[Optional[float]] = mapped_column(Numeric(6, 2), nullable=True)
    frequency_score: Mapped[Optional[float]] = mapped_column(Numeric(5, 2), nullable=True)
    route_score: Mapped[Optional[float]] = mapped_column(Numeric(5, 2), nullable=True)
    free_time_score: Mapped[Optional[float]] = mapped_column(Numeric(5, 2), nullable=True)
    total_score: Mapped[Optional[float]] = mapped_column(Numeric(6, 2), nullable=True)
    validade_status: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    posicao_ranking: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    motivo: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    calculated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
