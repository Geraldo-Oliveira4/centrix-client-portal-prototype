import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from shared.database.models.portal_user import PortalUser


def create(
    session: Session,
    id: str,
    email: str,
    name: str,
    client_id: uuid.UUID,
) -> PortalUser:
    user = PortalUser(id=id, email=email, name=name, client_id=client_id)
    session.add(user)
    session.flush()
    return user


def get(session: Session, user_id: str) -> PortalUser | None:
    return session.get(PortalUser, user_id)


def get_by_email(session: Session, email: str) -> PortalUser | None:
    return session.query(PortalUser).filter(PortalUser.email == email.lower()).first()


def list_by_client(session: Session, client_id: uuid.UUID) -> list[PortalUser]:
    return list(
        session.query(PortalUser)
        .filter(PortalUser.client_id == client_id)
        .order_by(PortalUser.name)
        .all()
    )


def update_name(session: Session, user_id: str, name: str) -> PortalUser | None:
    user = session.get(PortalUser, user_id)
    if user:
        user.name = name
        user.updated_at = datetime.now(timezone.utc)
        session.flush()
    return user


def delete(session: Session, user_id: str) -> bool:
    user = session.get(PortalUser, user_id)
    if user:
        session.delete(user)
        session.flush()
        return True
    return False
