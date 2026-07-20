import datetime

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from shared.database.models.slack_daily_thread import SlackDailyThread


def get_thread_ts(session: Session, date: datetime.date, channel_id: str) -> str | None:
    row = session.execute(
        select(SlackDailyThread).where(
            SlackDailyThread.date == date,
            SlackDailyThread.channel_id == channel_id,
        )
    ).scalar_one_or_none()
    return row.thread_ts if row else None


def save_thread_ts(
    session: Session, date: datetime.date, channel_id: str, thread_ts: str
) -> None:
    """Persist a new daily thread. Silently no-ops on duplicate (race-safe).

    Uses a savepoint so a concurrent duplicate insert does not roll back the
    caller's outer transaction (proposal creation, audit flags, etc.).
    """
    try:
        with session.begin_nested():
            session.add(SlackDailyThread(date=date, channel_id=channel_id, thread_ts=thread_ts))
            session.flush()
    except IntegrityError:
        pass
