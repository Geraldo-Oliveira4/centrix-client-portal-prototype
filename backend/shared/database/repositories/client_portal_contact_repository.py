import uuid
from typing import Optional

from sqlalchemy.orm import Session

from shared.database.models.quotation.client_portal_contact import ClientPortalContact


def create(
    session: Session,
    client_id: uuid.UUID,
    email: str,
    name: Optional[str] = None,
) -> ClientPortalContact:
    contact = ClientPortalContact(
        client_id=client_id,
        email=email.lower().strip(),
        name=name,
    )
    session.add(contact)
    session.flush()
    return contact


def get_by_email(session: Session, email: str) -> Optional[ClientPortalContact]:
    """Find the contact row whose e-mail matches `email` (case-insensitive).
    Used by the portal register/confirm flow to authorise sign-up.
    """
    if not email:
        return None
    return (
        session.query(ClientPortalContact)
        .filter(ClientPortalContact.email.ilike(email.strip()))
        .first()
    )


def list_by_client(session: Session, client_id: uuid.UUID) -> list[ClientPortalContact]:
    return (
        session.query(ClientPortalContact)
        .filter(ClientPortalContact.client_id == client_id)
        .order_by(ClientPortalContact.created_at)
        .all()
    )


def delete(session: Session, contact_id: uuid.UUID, client_id: uuid.UUID) -> bool:
    contact = (
        session.query(ClientPortalContact)
        .filter(
            ClientPortalContact.id == contact_id,
            ClientPortalContact.client_id == client_id,
        )
        .first()
    )
    if contact is None:
        return False
    session.delete(contact)
    session.flush()
    return True
