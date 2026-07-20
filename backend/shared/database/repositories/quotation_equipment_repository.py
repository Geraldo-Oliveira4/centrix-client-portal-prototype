import uuid
from typing import Optional

from sqlalchemy.orm import Session

from shared.database.models.quotation.enums import PesoUnidade, TipoContainer
from shared.database.models.quotation.quotation_equipment import QuotationEquipment


def create(
    session: Session,
    quotation_id: uuid.UUID,
    quantity: int,
    tipo_container: TipoContainer,
    volume_m3: Optional[float] = None,
    peso_bruto: Optional[float] = None,
    peso_unidade: PesoUnidade = PesoUnidade.KG,
) -> QuotationEquipment:
    equipment = QuotationEquipment(
        quotation_id=quotation_id,
        quantity=quantity,
        tipo_container=tipo_container,
        volume_m3=volume_m3,
        peso_bruto=peso_bruto,
        peso_unidade=peso_unidade,
    )
    session.add(equipment)
    session.flush()
    return equipment


def list_by_quotation(session: Session, quotation_id: uuid.UUID) -> list[QuotationEquipment]:
    return (
        session.query(QuotationEquipment)
        .filter(QuotationEquipment.quotation_id == quotation_id)
        .order_by(QuotationEquipment.created_at.asc())
        .all()
    )


def delete_by_quotation(session: Session, quotation_id: uuid.UUID) -> None:
    session.query(QuotationEquipment).filter(
        QuotationEquipment.quotation_id == quotation_id
    ).delete()
    session.flush()
