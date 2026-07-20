import uuid
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from shared.database.models.shipment.documento import Documento


def list_by_embarque(session: Session, embarque_id: uuid.UUID) -> list[Documento]:
    return (
        session.execute(
            select(Documento)
            .where(Documento.embarque_id == embarque_id)
            .order_by(Documento.created_at.desc())
        )
        .scalars()
        .all()
    )


def get(session: Session, documento_id: uuid.UUID) -> Optional[Documento]:
    return session.get(Documento, documento_id)


def create(
    session: Session,
    *,
    embarque_id: uuid.UUID,
    tipo_arquivo_label: str,
    url_s3: str,
    tipo_arquivo_codigo: Optional[int] = None,
    observacao: Optional[str] = None,
    responsavel_id: Optional[str] = None,
    inova_sequencia: Optional[int] = None,
) -> Documento:
    documento = Documento(
        id=uuid.uuid4(),
        embarque_id=embarque_id,
        tipo_arquivo_codigo=tipo_arquivo_codigo,
        tipo_arquivo_label=tipo_arquivo_label,
        url_s3=url_s3,
        observacao=observacao,
        responsavel_id=responsavel_id,
        inova_sequencia=inova_sequencia,
    )
    session.add(documento)
    session.flush()
    return documento


def delete(session: Session, documento: Documento) -> None:
    session.delete(documento)
    session.flush()
