from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class Config(Base):
    __tablename__ = "configs"

    config_type: Mapped[str] = mapped_column(String, primary_key=True)
    config_data: Mapped[dict] = mapped_column(JSONB)
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    updated_by: Mapped[Optional[str]] = mapped_column(String, nullable=True)
