from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class PreRegisteredUser(Base):
    __tablename__ = "pre_registered_users"

    email: Mapped[str] = mapped_column(String, primary_key=True)
    role: Mapped[str] = mapped_column(String, default="user")
