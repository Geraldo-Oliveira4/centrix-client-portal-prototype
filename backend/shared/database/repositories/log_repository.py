from datetime import datetime
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from shared.database.models.log import Log


def add(
    session: Session,
    action_type: str,
    user_id: str,
    details: dict,
    status: str = "SUCCESS",
    error_message: Optional[str] = None,
) -> Log:
    log = Log(
        action_type=action_type,
        user_id=user_id,
        details=details,
        status=status,
        error_message=error_message,
    )
    session.add(log)
    session.flush()
    return log


def get_all(
    session: Session,
    start_date: Optional[datetime] = None,
    limit: int = 100,
) -> list[Log]:
    stmt = select(Log).order_by(Log.timestamp.desc()).limit(limit)
    if start_date is not None:
        stmt = stmt.where(Log.timestamp >= start_date)
    return list(session.execute(stmt).scalars().all())
