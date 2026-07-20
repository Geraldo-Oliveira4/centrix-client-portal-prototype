import uuid
from typing import Optional

from sqlalchemy.orm import Session

from shared.database.models.quotation.enums import DimensaoUnidade, PesoUnidade, TipoEmbalagem
from shared.database.models.quotation.quotation_volume import QuotationVolume


def create(
    session: Session,
    quotation_id: uuid.UUID,
    quantity: int,
    embalagem: Optional[TipoEmbalagem] = None,
    peso_bruto: Optional[float] = None,
    peso_unidade: PesoUnidade = PesoUnidade.KG,
    comprimento: Optional[float] = None,
    largura: Optional[float] = None,
    altura: Optional[float] = None,
    dimensao_unidade: DimensaoUnidade = DimensaoUnidade.CM,
    volume_m3: Optional[float] = None,
    inspecao_iof: Optional[bool] = None,
) -> QuotationVolume:
    volume = QuotationVolume(
        quotation_id=quotation_id,
        quantity=quantity,
        embalagem=embalagem,
        peso_bruto=peso_bruto,
        peso_unidade=peso_unidade,
        comprimento=comprimento,
        largura=largura,
        altura=altura,
        dimensao_unidade=dimensao_unidade,
        volume_m3=volume_m3,
        inspecao_iof=inspecao_iof,
    )
    session.add(volume)
    session.flush()
    return volume


def list_by_quotation(session: Session, quotation_id: uuid.UUID) -> list[QuotationVolume]:
    return (
        session.query(QuotationVolume)
        .filter(QuotationVolume.quotation_id == quotation_id)
        .order_by(QuotationVolume.created_at.asc())
        .all()
    )


def delete_by_quotation(session: Session, quotation_id: uuid.UUID) -> None:
    session.query(QuotationVolume).filter(
        QuotationVolume.quotation_id == quotation_id
    ).delete()
    session.flush()
