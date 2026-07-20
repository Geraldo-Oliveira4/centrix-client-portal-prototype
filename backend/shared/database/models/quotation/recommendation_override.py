import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from ..base import Base


class RecommendationOverride(Base):
    __tablename__ = "centrix_quotation_recommendation_overrides"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    quotation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("centrix_quotation_quotations.id", ondelete="CASCADE"),
        nullable=False,
    )
    # SET NULL so historical override rows survive if the proposal is deleted
    proposal_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("centrix_quotation_proposals.id", ondelete="SET NULL"),
        nullable=True,
    )
    # What the AI had recommended at the time of the override — training signal for Fase 2.
    recommended_proposal_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("centrix_quotation_proposals.id", ondelete="SET NULL"),
        nullable=True,
    )
    # Captured at write time so the audit trail survives agent record changes
    agent_name: Mapped[str] = mapped_column(String, nullable=False)
    justification: Mapped[str] = mapped_column(Text, nullable=False)
    overridden_by: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
