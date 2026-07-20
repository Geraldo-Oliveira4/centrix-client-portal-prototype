from sqlalchemy.orm import Session

from shared.database.models.config import Config


def get(session: Session, config_type: str) -> Config | None:
    return session.get(Config, config_type)


def get_all(session: Session) -> list[Config]:
    return list(session.query(Config).all())
