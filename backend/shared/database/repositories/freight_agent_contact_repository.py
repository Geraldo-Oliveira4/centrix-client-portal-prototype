import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from shared.database.models.quotation.freight_agent_contact import FreightAgentContact


def create(
    session: Session,
    freight_agent_id: uuid.UUID,
    name: str,
    email: str,
    phone: Optional[str] = None,
    export_air: bool = False,
    import_air: bool = False,
    export_maritime: bool = False,
    import_maritime: bool = False,
    export_road: bool = False,
    import_road: bool = False,
) -> FreightAgentContact:
    contact = FreightAgentContact(
        freight_agent_id=freight_agent_id,
        name=name,
        email=email,
        phone=phone,
        export_air=export_air,
        import_air=import_air,
        export_maritime=export_maritime,
        import_maritime=import_maritime,
        export_road=export_road,
        import_road=import_road,
    )
    session.add(contact)
    session.flush()
    return contact


def get(session: Session, contact_id: uuid.UUID) -> Optional[FreightAgentContact]:
    return session.get(FreightAgentContact, contact_id)


def get_by_email(session: Session, email: str) -> Optional[FreightAgentContact]:
    """Look up a freight agent contact by exact email match (case-insensitive)."""
    return (
        session.query(FreightAgentContact)
        .filter(FreightAgentContact.email.ilike(email.strip()))
        .first()
    )


def get_by_agent(session: Session, agent_id: uuid.UUID) -> list[FreightAgentContact]:
    return (
        session.query(FreightAgentContact)
        .filter(FreightAgentContact.freight_agent_id == agent_id)
        .order_by(FreightAgentContact.created_at)
        .all()
    )


def update(
    session: Session,
    contact_id: uuid.UUID,
    name: Optional[str] = None,
    email: Optional[str] = None,
    phone: Optional[str] = None,
    export_air: Optional[bool] = None,
    import_air: Optional[bool] = None,
    export_maritime: Optional[bool] = None,
    import_maritime: Optional[bool] = None,
    export_road: Optional[bool] = None,
    import_road: Optional[bool] = None,
) -> Optional[FreightAgentContact]:
    contact = session.get(FreightAgentContact, contact_id)
    if contact is None:
        return None

    if name is not None:
        contact.name = name
    if email is not None:
        contact.email = email
    if phone is not None:
        contact.phone = phone
    if export_air is not None:
        contact.export_air = export_air
    if import_air is not None:
        contact.import_air = import_air
    if export_maritime is not None:
        contact.export_maritime = export_maritime
    if import_maritime is not None:
        contact.import_maritime = import_maritime
    if export_road is not None:
        contact.export_road = export_road
    if import_road is not None:
        contact.import_road = import_road

    contact.updated_at = datetime.now(timezone.utc)
    session.flush()
    return contact


def delete(session: Session, contact_id: uuid.UUID) -> bool:
    contact = session.get(FreightAgentContact, contact_id)
    if contact is None:
        return False
    session.delete(contact)
    session.flush()
    return True


def delete_by_agent(session: Session, agent_id: uuid.UUID) -> int:
    result = (
        session.query(FreightAgentContact)
        .filter(FreightAgentContact.freight_agent_id == agent_id)
        .delete(synchronize_session=False)
    )
    return result


def get_email_for_quotation(
    session: Session,
    agent_id: uuid.UUID,
    modal: str,
    service_type: str,
) -> Optional[str]:
    emails = get_emails_for_quotation(session, agent_id, modal, service_type)
    return emails[0] if emails else None


def get_emails_for_quotation(
    session: Session,
    agent_id: uuid.UUID,
    modal: str,
    service_type: str,
) -> list[str]:
    modal_flag_map = {
        ("AEREO", "EXPORTACAO"): FreightAgentContact.export_air,
        ("AEREO", "IMPORTACAO"): FreightAgentContact.import_air,
        ("MARITIMO", "EXPORTACAO"): FreightAgentContact.export_maritime,
        ("MARITIMO", "IMPORTACAO"): FreightAgentContact.import_maritime,
        ("RODOVIARIO", "EXPORTACAO"): FreightAgentContact.export_road,
        ("RODOVIARIO", "IMPORTACAO"): FreightAgentContact.import_road,
    }

    target_flag = modal_flag_map.get((modal, service_type))
    if target_flag is not None:
        contacts = (
            session.query(FreightAgentContact)
            .filter(
                FreightAgentContact.freight_agent_id == agent_id,
                target_flag.is_(True),
            )
            .order_by(FreightAgentContact.created_at)
            .all()
        )
        if contacts:
            return [c.email for c in contacts]

    return []
