import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Enum, Integer, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from ..base import Base
from .enums import Modal


class TransitTimeReference(Base):
    __tablename__ = "centrix_quotation_transit_time_references"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    modal: Mapped[Modal] = mapped_column(
        Enum(Modal, name="modal"), nullable=False
    )
    origin_country: Mapped[str] = mapped_column(String, nullable=False)
    avg_days: Mapped[int] = mapped_column(Integer, nullable=False)
    sample_size: Mapped[int] = mapped_column(Integer, nullable=False)
    # Tolerance percentage before flagging transit time anomaly (default 20%)
    tolerance_pct: Mapped[float] = mapped_column(
        Numeric(5, 2), nullable=False, default=20.0
    )
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, default=func.now()
    )
