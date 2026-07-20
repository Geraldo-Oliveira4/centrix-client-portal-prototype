import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from .base import Base


class Log(Base):
    __tablename__ = "logs"

    log_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=func.now()
    )
    action_type: Mapped[str] = mapped_column(String)
    user_id: Mapped[str] = mapped_column(String)
    status: Mapped[str] = mapped_column(String)  # "SUCCESS" | "ERROR"
    details: Mapped[dict] = mapped_column(JSONB)
    error_message: Mapped[Optional[str]] = mapped_column(String, nullable=True)
