from datetime import datetime, timezone

from sqlalchemy.orm import Session

from shared.database.models.user import CentrixUser

_VALID_ROLES = {"user", "admin"}


def _validate_role(role: str) -> None:
    if role not in _VALID_ROLES:
        raise ValueError(f"Invalid role '{role}'. Must be one of: {sorted(_VALID_ROLES)}")


def create(session: Session, id: str, email: str, name: str, role: str = "user") -> CentrixUser:
    _validate_role(role)
    user = CentrixUser(id=id, email=email, name=name, role=role)
    session.add(user)
    session.flush()
    return user


def get(session: Session, user_id: str) -> CentrixUser | None:
    return session.get(CentrixUser, user_id)


def get_by_email(session: Session, email: str) -> CentrixUser | None:
    return session.query(CentrixUser).filter(CentrixUser.email == email).first()


def get_all(session: Session) -> list[CentrixUser]:
    return list(session.query(CentrixUser).order_by(CentrixUser.name).all())


def update_role(session: Session, user_id: str, role: str) -> CentrixUser | None:
    _validate_role(role)
    user = session.get(CentrixUser, user_id)
    if user:
        user.role = role
        user.updated_at = datetime.now(timezone.utc)
        session.flush()
    return user


def delete(session: Session, user_id: str) -> bool:
    user = session.get(CentrixUser, user_id)
    if user:
        session.delete(user)
        session.flush()
        return True
    return False
