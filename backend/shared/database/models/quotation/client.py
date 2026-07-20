import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Enum, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from ..base import Base
from .enums import ClientTier


class QuotationClient(Base):
    __tablename__ = "centrix_quotation_clients"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    sector: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    email: Mapped[str] = mapped_column(String, nullable=False)
    company_code: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    cnpj: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    razao_social: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    endereco: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    # Company that appears as importer of record — may differ from the buyer
    # when the client imports through a trading company.
    importador: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    # Buyer of the goods. Not shown/collected when importacao_direta=True
    # (importer and buyer are the same party).
    adquirente: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    importacao_direta: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    tier: Mapped[ClientTier] = mapped_column(
        Enum(ClientTier, name="clienttier"), nullable=False, default=ClientTier.MANTER
    )
    is_vip: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=func.now()
    )
