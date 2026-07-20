import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from ..base import Base


class Followup(Base):
    """Ocorrencia (follow-up) registrada contra um embarque.

    `origem` discrimina entradas criadas pelo usuario ("MANUAL") de entradas
    geradas automaticamente por transicoes de estado ou pela Lambda de varredura
    de alertas ("AUTOMATICO"). Apenas ocorrencias MANUAL podem ser deletadas.

    `responsavel_id` armazena o Cognito sub do usuario responsavel (nullable
    para registros AUTOMATICO gerados por Lambdas sem contexto de usuario).
    """

    __tablename__ = "centrix_shipment_followups"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    embarque_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("centrix_shipment_embarques.id", ondelete="CASCADE"),
        nullable=False,
    )
    grupo: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    tipo_ocorrencia: Mapped[str] = mapped_column(String, nullable=False)
    nota: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    origem: Mapped[str] = mapped_column(String, nullable=False)
    responsavel_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=func.now()
    )
