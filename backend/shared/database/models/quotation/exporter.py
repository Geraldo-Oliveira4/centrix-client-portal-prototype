import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Enum, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from ..base import Base
from .enums import ExporterCargoProfile


class Exporter(Base):
    __tablename__ = "centrix_exporters"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    endereco: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    particularidades: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    cargo_profile: Mapped[ExporterCargoProfile] = mapped_column(
        Enum(ExporterCargoProfile, name="exportercargoprofile"),
        nullable=False,
        default=ExporterCargoProfile.GERAL,
    )
    contact_email: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=func.now()
    )
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
