import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from shared.database.models.quotation.rfq import RFQ


def create(
    session: Session,
    quotation_id: uuid.UUID,
    agents_targeted: list,
    template_data: dict,
    include_insurance: bool,
    destination_yard: Optional[str] = None,
    particularities: Optional[str] = None,
) -> RFQ:
    rfq = RFQ(
        quotation_id=quotation_id,
        agents_targeted=agents_targeted,
        template_data=template_data,
        include_insurance=include_insurance,
        destination_yard=destination_yard,
        particularities=particularities,
    )
    session.add(rfq)
    session.flush()
    return rfq


def get(session: Session, rfq_id: uuid.UUID) -> Optional[RFQ]:
    return session.query(RFQ).filter(RFQ.id == rfq_id).first()


def get_by_quotation(session: Session, quotation_id: uuid.UUID) -> Optional[RFQ]:
    return (
        session.query(RFQ)
        .filter(RFQ.quotation_id == quotation_id)
        .first()
    )


def update(
    session: Session,
    rfq: RFQ,
    agents_targeted: Optional[list] = None,
    template_data: Optional[dict] = None,
    include_insurance: Optional[bool] = None,
    destination_yard: Optional[str] = None,
    particularities: Optional[str] = None,
    dispatched_at: Optional[datetime] = None,
) -> RFQ:
    if agents_targeted is not None:
        rfq.agents_targeted = agents_targeted
    if template_data is not None:
        rfq.template_data = template_data
    if include_insurance is not None:
        rfq.include_insurance = include_insurance
    if destination_yard is not None:
        rfq.destination_yard = destination_yard
    if particularities is not None:
        rfq.particularities = particularities
    if dispatched_at is not None:
        rfq.dispatched_at = dispatched_at
    session.flush()
    return rfq
