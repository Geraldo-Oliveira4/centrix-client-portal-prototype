import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.orm import Session

from shared.database.models.quotation.quotation_client_token import QuotationClientToken

_TOKEN_TTL_DAYS = 30


def create(
    session: Session,
    quotation_id: uuid.UUID,
    created_by: str,
    observations: Optional[str] = None,
) -> QuotationClientToken:
    now = datetime.now(timezone.utc)
    record = QuotationClientToken(
        id=uuid.uuid4(),
        quotation_id=quotation_id,
        token=secrets.token_urlsafe(32),
        created_by=created_by,
        observations=observations,
        expires_at=now + timedelta(days=_TOKEN_TTL_DAYS),
        created_at=now,
    )
    session.add(record)
    session.flush()
    return record


def get_valid_by_token(session: Session, token: str) -> Optional[QuotationClientToken]:
    record = (
        session.query(QuotationClientToken)
        .filter(QuotationClientToken.token == token)
        .first()
    )
    if record is None:
        return None
    if record.expires_at <= datetime.now(timezone.utc):
        return None
    return record


def list_by_quotation(
    session: Session, quotation_id: uuid.UUID
) -> list[QuotationClientToken]:
    return (
        session.query(QuotationClientToken)
        .filter(QuotationClientToken.quotation_id == quotation_id)
        .order_by(QuotationClientToken.created_at.desc())
        .all()
    )


def mark_sent(session: Session, token_record: QuotationClientToken) -> None:
    token_record.sent_at = datetime.now(timezone.utc)
    session.flush()
