import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from shared.database.models.quotation.rfq_agent_token import RFQAgentToken


def create(
    session: Session,
    rfq_id: uuid.UUID,
    agent_id: uuid.UUID,
    token: str,
) -> RFQAgentToken:
    record = RFQAgentToken(
        rfq_id=rfq_id,
        agent_id=agent_id,
        token=token,
    )
    session.add(record)
    session.flush()
    return record


def get_by_token(session: Session, token: str) -> Optional[RFQAgentToken]:
    return (
        session.query(RFQAgentToken)
        .filter(RFQAgentToken.token == token)
        .first()
    )


def get_valid_token(session: Session, token: str) -> Optional[RFQAgentToken]:
    record = get_by_token(session, token)
    if record is None or record.revoked_at is not None:
        return None
    return record


def get_by_rfq_and_agent(
    session: Session, rfq_id: uuid.UUID, agent_id: uuid.UUID
) -> Optional[RFQAgentToken]:
    return (
        session.query(RFQAgentToken)
        .filter(
            RFQAgentToken.rfq_id == rfq_id,
            RFQAgentToken.agent_id == agent_id,
        )
        .first()
    )


def list_by_rfq(session: Session, rfq_id: uuid.UUID) -> list[RFQAgentToken]:
    return (
        session.query(RFQAgentToken)
        .filter(RFQAgentToken.rfq_id == rfq_id)
        .all()
    )


def decline_token(
    session: Session,
    token_record: RFQAgentToken,
    reason: str | None,
) -> None:
    # O declinio apenas grava declined_at/decline_reason; revoked_at fica intacto
    # de proposito, para que o link original do agente continue valido (get_valid_token
    # so checa revoked_at). E isso que permite o analista reabrir um declinio
    # (clear_decline) e o submit_proposal limpar um declinio obsoleto ao postar.
    token_record.declined_at = datetime.now(timezone.utc)
    token_record.decline_reason = reason
    session.flush()


def clear_decline(session: Session, token_record: RFQAgentToken) -> None:
    token_record.declined_at = None
    token_record.decline_reason = None
    session.flush()


def revoke_token(session: Session, token_record: RFQAgentToken) -> None:
    token_record.revoked_at = datetime.now(timezone.utc)
    session.flush()


def delete_all_tokens_for_rfq(session: Session, rfq_id: uuid.UUID) -> int:
    count = (
        session.query(RFQAgentToken)
        .filter(RFQAgentToken.rfq_id == rfq_id)
        .delete(synchronize_session=False)
    )
    session.flush()
    return count
