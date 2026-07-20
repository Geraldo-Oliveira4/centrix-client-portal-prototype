import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from ..base import Base


class FreightAgentContact(Base):
    __tablename__ = "centrix_quotation_freight_agent_contacts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    freight_agent_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("centrix_quotation_freight_agents.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    export_air: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    import_air: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    export_maritime: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    import_maritime: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    export_road: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    import_road: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=func.now()
    )
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, onupdate=func.now()
    )

    freight_agent: Mapped["FreightAgent"] = relationship(
        "FreightAgent", back_populates="contacts"
    )
