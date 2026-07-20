from typing import Optional

from sqlalchemy.orm import Session

from shared.database.models.quotation.enums import Modal
from shared.database.models.quotation.transit_time_reference import TransitTimeReference


def get_by_modal_and_origin(
    session: Session,
    modal: Modal,
    origin_country: str,
) -> Optional[TransitTimeReference]:
    """Return the transit time reference for a given modal and origin country.

    Matching is case-insensitive on origin_country. Returns None if no
    reference data exists for the combination.
    """
    return (
        session.query(TransitTimeReference)
        .filter(
            TransitTimeReference.modal == modal,
            TransitTimeReference.origin_country.ilike(origin_country),
        )
        .first()
    )
