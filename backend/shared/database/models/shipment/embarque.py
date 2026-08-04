import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from ..base import Base
from .enums import EmbarqueState

if TYPE_CHECKING:
    from .processo import Processo


class Embarque(Base):
    """A shipment within a Processo. Carries the operational lifecycle state and
    the human-readable reference (EMB-YYYY-NNNN).

    EMB- is the GE shipment prefix. It is deliberately distinct from SHP-, which
    the Shipment Instruction (SI) already uses for its own reference and email
    routing — sharing the prefix would collide in the email_poller router.

    The reference is generated application-side following the established
    ``_generate_reference`` convention (see quotation_repository), not by a DB
    trigger — this keeps it consistent with COT-YYYY-NNNN and working under both
    Alembic migrations and ``Base.metadata.create_all`` in tests.
    """

    __tablename__ = "centrix_shipment_embarques"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    processo_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("centrix_shipment_processos.id", ondelete="CASCADE"),
        nullable=False,
    )
    # Lowercase enum values -> values_callable is mandatory
    estado: Mapped[EmbarqueState] = mapped_column(
        Enum(
            EmbarqueState,
            name="embarquestate",
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=False,
        default=EmbarqueState.SOLICITADO,
        server_default=EmbarqueState.SOLICITADO.value,
    )
    # Human-readable reference (e.g. EMB-2026-0001), unique per embarque.
    # Generated application-side — see class docstring.
    reference: Mapped[str] = mapped_column(String, nullable=False, unique=True)

    # Carrier tracking (migration 091, prototype-only). Nothing in this repo
    # writes these: they are the plug for the ShipsGo integration and stay NULL
    # until it exists. NULL means "not integrated yet" and the portal renders
    # "Pendente integração" — it never derives an ETA or a delay from a guess.
    # tracking_data_status = 'INCOMPLETE' is a different statement: integrated,
    # but the carrier did not report enough for this shipment.
    tracking_first_eta: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    tracking_current_eta: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    tracking_eta_is_actual: Mapped[Optional[bool]] = mapped_column(
        Boolean, nullable=True
    )
    tracking_data_status: Mapped[Optional[str]] = mapped_column(
        String(16), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=func.now()
    )
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    processo: Mapped["Processo"] = relationship(
        "Processo", back_populates="embarques"
    )
