import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from ..base import Base
from ..quotation.enums import Modal, TipoEmbarque
from .enums import TipoDespacho

if TYPE_CHECKING:
    from .embarque import Embarque


class Processo(Base):
    """A GE process. Created automatically when a quotation is approved
    (Ponte 1) or manually (Perfil B — exporter already closed the freight).

    ``quotation_id`` is nullable by design: Perfil B (DAP/CIP/CPT) enters GE
    without a quotation. Writing it as NOT NULL would be an implementation error,
    not a product decision (GE technical discovery, Section 5).
    """

    __tablename__ = "centrix_shipment_processos"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # Nullable by design — see class docstring (Perfil B / manual creation)
    quotation_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("centrix_quotation_quotations.id", ondelete="SET NULL"),
        nullable=True,
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("centrix_quotation_clients.id", ondelete="RESTRICT"),
        nullable=False,
    )
    incoterm: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    # Modal and tipo_embarque reuse the existing quotation PG enum types
    # ("modal", "tipoembarque") — no new type is created for them.
    modal: Mapped[Optional[Modal]] = mapped_column(
        Enum(Modal, name="modal"), nullable=True
    )
    tipo_embarque: Mapped[Optional[TipoEmbarque]] = mapped_column(
        Enum(TipoEmbarque, name="tipoembarque"), nullable=True
    )
    tipo_despacho: Mapped[Optional[TipoDespacho]] = mapped_column(
        Enum(TipoDespacho, name="tipodespacho"), nullable=True
    )
    carga_urgente: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    agente_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("centrix_quotation_freight_agents.id", ondelete="SET NULL"),
        nullable=True,
    )
    # Container specs carried over from the quotation/proposal (list of dicts)
    containers: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    # Key process dates (ETD, ETA, prontidao, etc.) as a flexible map
    datas: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    observacao: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Numero do processo na Inova (ex: FRT0585.II). Nasce do lado da Inova —
    # nullable por design, skip gracioso com alerta enquanto vazio (ARB-2438).
    inova_processo_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=func.now()
    )
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    embarques: Mapped[list["Embarque"]] = relationship(
        "Embarque", back_populates="processo", cascade="all, delete-orphan"
    )
