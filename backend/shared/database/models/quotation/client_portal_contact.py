import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from ..base import Base


class ClientPortalContact(Base):
    """An e-mail authorised to self-register for the client portal.

    Decoupled from QuotationClientDna.contact_email (ARB-2501): that field
    is the single business contact used elsewhere (e.g. shipment instruction
    consignee) and stays a single value. A client can have any number of
    portal contacts — e.g. an internal Freitas analyst who also wants to see
    the client-facing view needs a distinct e-mail here, since Cognito
    enforces one account per e-mail per pool and the internal login and the
    portal contact are two separate Cognito identities (separate pools since
    docs/refacs/cognito-dual-pool-split.md; previously a single shared pool,
    where reusing the internal e-mail risked locking the account out of
    internal routes).
    """

    __tablename__ = "centrix_client_portal_contacts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("centrix_quotation_clients.id", ondelete="CASCADE"),
        nullable=False,
    )
    email: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=func.now()
    )
