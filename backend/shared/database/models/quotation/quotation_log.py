import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from ..base import Base


class QuotationLog(Base):
    """Immutable audit trail for quotation state transitions and actions.

    Records must never be updated or deleted. All writes are append-only.
    The application layer is responsible for enforcing this constraint.
    """

    __tablename__ = "centrix_quotation_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    quotation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("centrix_quotation_quotations.id", ondelete="CASCADE"),
        nullable=False,
    )
    action: Mapped[str] = mapped_column(String, nullable=False)
    previous_state: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    new_state: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    # Cognito user ID of the actor
    user_id: Mapped[str] = mapped_column(String, nullable=False)
    details: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=func.now()
    )
