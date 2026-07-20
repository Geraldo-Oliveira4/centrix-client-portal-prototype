import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from ..base import Base


class RFQ(Base):
    __tablename__ = "centrix_quotation_rfqs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    quotation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("centrix_quotation_quotations.id", ondelete="CASCADE"),
        nullable=False,
    )
    # List of freight agent IDs targeted in this RFQ
    agents_targeted: Mapped[dict] = mapped_column(JSONB, nullable=False)
    # Rendered template data sent to agents
    template_data: Mapped[dict] = mapped_column(JSONB, nullable=False)
    include_insurance: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    destination_yard: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    particularities: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    dispatched_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=func.now()
    )
