import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from ..base import Base
from .enums import AuditCategory, Severity


class AuditFlag(Base):
    __tablename__ = "centrix_quotation_audit_flags"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    proposal_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("centrix_quotation_proposals.id", ondelete="CASCADE"),
        nullable=False,
    )
    rule_category: Mapped[AuditCategory] = mapped_column(
        Enum(AuditCategory, name="auditcategory"), nullable=False
    )
    rule_name: Mapped[str] = mapped_column(String, nullable=False)
    severity: Mapped[Severity] = mapped_column(
        Enum(Severity, name="severity"), nullable=False
    )
    description: Mapped[str] = mapped_column(Text, nullable=False)
    resolved: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # Cognito user ID of the analyst who resolved the flag
    resolved_by: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    justification: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=func.now()
    )
