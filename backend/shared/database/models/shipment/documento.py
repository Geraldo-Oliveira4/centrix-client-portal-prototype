import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from ..base import Base


class Documento(Base):
    """Documento anexado a um embarque (aba Documentos Anexados, ARB-2379).

    `url_s3` guarda a chave do objeto no bucket, nunca a URL presigned —
    URLs de download sao geradas on-demand via GET (mesmo padrao de
    `attachments_s3_keys` em Quotation).

    `inova_sequencia` fica None quando o sync com a Inova nao roda (dev sem
    INOVA_API_BASE_URL configurado) ou quando o embarque ainda nao tem o
    numero do processo Inova mapeado — o upload em Centrix nunca fica
    bloqueado por esse sync (ver `send_shipment_instruction._patch_inova`
    para o mesmo padrao de skip gracioso).
    """

    __tablename__ = "centrix_shipment_documentos"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    embarque_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("centrix_shipment_embarques.id", ondelete="CASCADE"),
        nullable=False,
    )
    tipo_arquivo_codigo: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    tipo_arquivo_label: Mapped[str] = mapped_column(String, nullable=False)
    url_s3: Mapped[str] = mapped_column(String, nullable=False)
    observacao: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    responsavel_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    inova_sequencia: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=func.now()
    )
