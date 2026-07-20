import datetime

from sqlalchemy import Date, DateTime, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class SlackDailyThread(Base):
    __tablename__ = "centrix_slack_daily_threads"
    __table_args__ = (
        UniqueConstraint("date", "channel_id", name="uq_slack_daily_thread_date_channel"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    channel_id: Mapped[str] = mapped_column(String, nullable=False)
    thread_ts: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
