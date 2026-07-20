import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from shared.database.models.quotation.audit_flag import AuditFlag
from shared.database.models.quotation.enums import AuditCategory, Severity


def create(
    session: Session,
    proposal_id: uuid.UUID,
    rule_category: AuditCategory,
    rule_name: str,
    severity: Severity,
    description: str,
) -> AuditFlag:
    flag = AuditFlag(
        proposal_id=proposal_id,
        rule_category=rule_category,
        rule_name=rule_name,
        severity=severity,
        description=description,
        resolved=False,
    )
    session.add(flag)
    session.flush()
    return flag


def create_bulk(
    session: Session,
    proposal_id: uuid.UUID,
    flags: list[dict],
) -> list[AuditFlag]:
    """Create multiple AuditFlag records at once.

    Each dict in flags must have: rule_category, rule_name, severity, description.
    """
    created = []
    for f in flags:
        created.append(create(
            session,
            proposal_id=proposal_id,
            rule_category=f["rule_category"],
            rule_name=f["rule_name"],
            severity=f["severity"],
            description=f["description"],
        ))
    return created


def delete_by_proposal(session: Session, proposal_id: uuid.UUID) -> int:
    count = (
        session.query(AuditFlag)
        .filter(AuditFlag.proposal_id == proposal_id)
        .delete()
    )
    session.flush()
    return count


def list_by_proposal(session: Session, proposal_id: uuid.UUID) -> list[AuditFlag]:
    return (
        session.query(AuditFlag)
        .filter(AuditFlag.proposal_id == proposal_id)
        .order_by(AuditFlag.created_at.asc())
        .all()
    )


def has_critical_unresolved(session: Session, proposal_id: uuid.UUID) -> bool:
    return (
        session.query(AuditFlag)
        .filter(
            AuditFlag.proposal_id == proposal_id,
            AuditFlag.severity == Severity.CRITICAL,
            AuditFlag.resolved.is_(False),
        )
        .first()
    ) is not None


def resolve(
    session: Session,
    flag_id: uuid.UUID,
    resolved_by: str,
    justification: Optional[str] = None,
) -> Optional[AuditFlag]:
    flag = session.get(AuditFlag, flag_id)
    if flag is None:
        return None
    flag.resolved = True
    flag.resolved_by = resolved_by
    flag.resolved_at = datetime.now(timezone.utc)
    if justification is not None:
        flag.justification = justification
    session.flush()
    return flag
