from sqlalchemy.orm import Session

from shared.database.models.pre_registered_user import PreRegisteredUser


def add(session: Session, email: str, role: str = "user") -> PreRegisteredUser:
    user = PreRegisteredUser(email=email, role=role)
    session.add(user)
    session.flush()
    return user


def get(session: Session, email: str) -> PreRegisteredUser | None:
    return session.get(PreRegisteredUser, email)


def delete(session: Session, email: str) -> PreRegisteredUser | None:
    user = session.get(PreRegisteredUser, email)
    if user:
        session.delete(user)
        session.flush()
    return user


def get_all(session: Session) -> list[PreRegisteredUser]:
    return list(session.query(PreRegisteredUser).all())
