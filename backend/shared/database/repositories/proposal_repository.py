import logging
import uuid
from datetime import date, datetime, timezone
from enum import Enum
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from shared.database.models.quotation.enums import ExtractionStatus, RouteType, TipoContainer
from shared.database.models.quotation.proposal import Proposal
from shared.lambda_helpers import coerce_taxes_breakdown, parse_date

logger = logging.getLogger(__name__)

# Simple scalar fields from PROPOSAL_EXTRACTION_FIELDS that update_extraction()
# assigns via a plain cast. Fields requiring custom parsing/validation
# (route_type, taxes_breakdown, taxes_currency_breakdown, validity) are handled
# separately in update_extraction() and listed in
# _EXTRACTION_FIELDS_HANDLED_SEPARATELY below. Together the two sets must cover
# every entry in PROPOSAL_EXTRACTION_FIELDS — see
# test_update_extraction_covers_all_extraction_fields, which fails loudly if a
# new extraction field is added to schema.py without a matching setter here.
_EXTRACTION_FIELD_SETTERS = {
    "total_value": float,
    "freight_value": float,
    "freight_currency": str,
    "transit_time": int,
    "carrier": str,
    "incoterm": str,
    "route_detail": str,
    "insurance_included": bool,
    "numero_oferta": str,
    "frequencia": str,
    "prazo_pagamento_dias": int,
    "free_time_dias": int,
    "observations": str,
}

_EXTRACTION_FIELDS_HANDLED_SEPARATELY = {
    "route_type",
    "taxes_breakdown",
    "taxes_currency_breakdown",
    "validity",
}

_VERSIONED_FIELDS = [
    "total_value",
    "freight_value",
    "transit_time",
    "carrier",
    "incoterm",
    "route_type",
    "route_detail",
    "insurance_included",
    "validity",
    "numero_oferta",
    "ptax_percentual",
    "prazo_pagamento_dias",
    "seguro_percentual",
    "seguro_minimo",
    "frequencia",
    "free_time_dias",
    "observations",
    "taxes_breakdown",
    "taxes_currency_breakdown",
    "freight_currency",
    "containers_priced",
    "offered_container_type",
]


def compute_diff(old: Proposal, new_values: dict) -> dict:
    diff = {}
    for field in _VERSIONED_FIELDS:
        old_val = _normalize_diff_value(getattr(old, field, None))
        new_val = _normalize_diff_value(new_values.get(field))
        if old_val != new_val:
            diff[field] = {"before": old_val, "after": new_val}
    return diff


def _normalize_diff_value(value):
    if isinstance(value, Enum):
        value = value.value
    if hasattr(value, "__float__"):
        value = float(value)
    if hasattr(value, "isoformat"):
        value = value.isoformat()
    return value


def supersede_and_prepare_revision(
    session: Session,
    quotation_id: uuid.UUID,
    agent_id: uuid.UUID,
    new_values: dict,
) -> tuple[bool, int, Optional[uuid.UUID], Optional[dict]]:
    """Enforce the supersede sequence for an auto-resubmission.

    Looks up all current is_latest proposals from this agent for this quotation.
    - Zero found → first submission (version=1, no parent).
    - One found  → normal revision (supersede it, version+1).
    - Multiple found → agent previously used force_new to create independent offers.
      Supersede all of them and create a new root proposal (version=1, no parent)
      to avoid arbitrary selection via .first().

    Returns (is_revision, new_version, parent_id, diff).

    This is the single authoritative place for the supersede sequence.
    All proposal-creation paths (create_proposal, submit_proposal,
    extract_proposal_data) must call this function instead of duplicating
    the list_latest_for_agent → compute_diff → mark_superseded sequence.
    """
    existing_list = list_latest_for_agent(session, quotation_id, agent_id)
    if not existing_list:
        return False, 1, None, None
    if len(existing_list) == 1:
        existing = existing_list[0]
        diff = compute_diff(existing, new_values)
        mark_superseded(session, existing.id)
        return True, existing.version + 1, existing.id, diff
    # Multiple is_latest proposals exist (from prior force_new submissions).
    # Supersede all and start a new root to avoid non-deterministic .first() selection.
    for p in existing_list:
        mark_superseded(session, p.id)
    return True, 1, None, None


def create(
    session: Session,
    quotation_id: uuid.UUID,
    agent_id: uuid.UUID,
    total_value: float,
    freight_value: float,
    taxes_breakdown: dict,
    transit_time: int,
    insurance_included: bool,
    route_type: Optional[RouteType] = None,
    route_detail: Optional[str] = None,
    carrier: Optional[str] = None,
    validity: Optional[date] = None,
    incoterm: Optional[str] = None,
    extraction_status: Optional[str] = None,
    proposal_origin: Optional[str] = None,
    proposal_destination: Optional[str] = None,
    numero_oferta: Optional[str] = None,
    ptax_percentual: Optional[float] = None,
    prazo_pagamento_dias: Optional[int] = None,
    seguro_percentual: Optional[float] = None,
    seguro_minimo: Optional[float] = None,
    frequencia: Optional[str] = None,
    free_time_dias: Optional[int] = None,
    observations: Optional[str] = None,
    carga_perigosa: Optional[str] = None,
    taxes_currency_breakdown: Optional[dict] = None,
    freight_currency: Optional[str] = None,
    containers_priced: Optional[int] = None,
    offered_container_type: Optional[TipoContainer] = None,
    version: int = 1,
    is_latest: bool = True,
    parent_proposal_id: Optional[uuid.UUID] = None,
    version_diff: Optional[dict] = None,
) -> Proposal:
    proposal = Proposal(
        quotation_id=quotation_id,
        agent_id=agent_id,
        total_value=total_value,
        freight_value=freight_value,
        taxes_breakdown=taxes_breakdown,
        transit_time=transit_time,
        insurance_included=insurance_included,
        route_type=route_type,
        route_detail=route_detail,
        carrier=carrier,
        validity=validity,
        incoterm=incoterm,
        is_winner=False,
        extraction_status=extraction_status,
        proposal_origin=proposal_origin,
        proposal_destination=proposal_destination,
        numero_oferta=numero_oferta,
        ptax_percentual=ptax_percentual,
        prazo_pagamento_dias=prazo_pagamento_dias,
        seguro_percentual=seguro_percentual,
        seguro_minimo=seguro_minimo,
        frequencia=frequencia,
        free_time_dias=free_time_dias,
        observations=observations,
        carga_perigosa=carga_perigosa,
        taxes_currency_breakdown=taxes_currency_breakdown,
        freight_currency=freight_currency,
        containers_priced=containers_priced,
        offered_container_type=offered_container_type,
        version=version,
        is_latest=is_latest,
        parent_proposal_id=parent_proposal_id,
        version_diff=version_diff,
    )
    session.add(proposal)
    session.flush()
    return proposal


def get(session: Session, proposal_id: uuid.UUID) -> Optional[Proposal]:
    return session.get(Proposal, proposal_id)


def list_by_quotation(
    session: Session,
    quotation_id: uuid.UUID,
    latest_only: bool = True,
    include_deleted: bool = False,
) -> list[Proposal]:
    q = session.query(Proposal).filter(Proposal.quotation_id == quotation_id)
    if latest_only:
        q = q.filter(Proposal.is_latest == True)  # noqa: E712
    if not include_deleted:
        q = q.filter(Proposal.deleted_at.is_(None))
    return q.order_by(Proposal.received_at.asc()).all()


def list_by_quotation_ids(
    session: Session,
    quotation_ids: list[uuid.UUID],
    latest_only: bool = True,
    include_deleted: bool = False,
) -> dict[uuid.UUID, list[Proposal]]:
    """Batch version of `list_by_quotation` — fetches proposals for many
    quotations in a single query and groups them by quotation_id. Use this
    in list/kanban handlers to avoid N+1 patterns. Quotations with no
    proposals are absent from the returned dict (use `.get(qid, [])`).

    latest_only (default True) filters to is_latest=True rows only, matching
    the behaviour of list_by_quotation and the detail-view count. Pass False
    only when version history is explicitly required.
    """
    if not quotation_ids:
        return {}
    q = session.query(Proposal).filter(Proposal.quotation_id.in_(quotation_ids))
    if latest_only:
        q = q.filter(Proposal.is_latest == True)  # noqa: E712
    if not include_deleted:
        q = q.filter(Proposal.deleted_at.is_(None))
    proposals = q.order_by(Proposal.received_at.asc()).all()
    grouped: dict[uuid.UUID, list[Proposal]] = {}
    for p in proposals:
        grouped.setdefault(p.quotation_id, []).append(p)
    return grouped


def batch_fetch_max_latest_total_value(
    session: Session,
    quotation_ids: list[uuid.UUID],
    include_deleted: bool = False,
) -> dict[uuid.UUID, float]:
    """Return the highest is_latest proposal total_value per quotation.

    Single aggregated query (no proposal objects loaded) so the guard rail
    high-value trava can be evaluated in batch on the kanban/portal list without
    an N+1 scan. Quotations with no proposals are absent from the dict.
    """
    if not quotation_ids:
        return {}
    q = (
        session.query(
            Proposal.quotation_id,
            func.max(Proposal.total_value),
        )
        .filter(Proposal.quotation_id.in_(quotation_ids))
        .filter(Proposal.is_latest == True)  # noqa: E712
    )
    if not include_deleted:
        q = q.filter(Proposal.deleted_at.is_(None))
    rows = q.group_by(Proposal.quotation_id).all()
    return {quotation_id: float(max_value) for quotation_id, max_value in rows}


def count_by_quotation(
    session: Session,
    quotation_id: uuid.UUID,
    latest_only: bool = True,
    include_deleted: bool = False,
) -> int:
    """Count proposals for a quotation.

    latest_only (default True) counts only is_latest=True rows, consistent
    with list_by_quotation and the kanban/detail-view counts.
    """
    q = session.query(Proposal).filter(Proposal.quotation_id == quotation_id)
    if latest_only:
        q = q.filter(Proposal.is_latest == True)  # noqa: E712
    if not include_deleted:
        q = q.filter(Proposal.deleted_at.is_(None))
    return q.count()


def count_by_quotation_and_agent(
    session: Session,
    quotation_id: uuid.UUID,
    agent_id: uuid.UUID,
    latest_only: bool = True,
    include_deleted: bool = False,
) -> int:
    q = session.query(Proposal).filter(
        Proposal.quotation_id == quotation_id,
        Proposal.agent_id == agent_id,
    )
    if latest_only:
        q = q.filter(Proposal.is_latest == True)  # noqa: E712
    if not include_deleted:
        q = q.filter(Proposal.deleted_at.is_(None))
    return q.count()


def get_latest_for_agent(
    session: Session,
    quotation_id: uuid.UUID,
    agent_id: uuid.UUID,
    include_deleted: bool = False,
) -> Optional[Proposal]:
    q = (
        session.query(Proposal)
        .filter(
            Proposal.quotation_id == quotation_id,
            Proposal.agent_id == agent_id,
            Proposal.is_latest == True,  # noqa: E712
        )
    )
    if not include_deleted:
        q = q.filter(Proposal.deleted_at.is_(None))
    return q.first()


def list_latest_for_agent(
    session: Session,
    quotation_id: uuid.UUID,
    agent_id: uuid.UUID,
    include_deleted: bool = False,
) -> list[Proposal]:
    """Return latest proposals for an agent on a quotation.

    By the is_latest invariant (enforced in supersede_and_prepare_revision),
    this list always contains at most one element. The list return type is
    preserved for backward compatibility with get_proposal_form which checks
    `len(existing_proposals) > 0`. Prefer get_latest_for_agent for new callers.
    """
    q = (
        session.query(Proposal)
        .filter(
            Proposal.quotation_id == quotation_id,
            Proposal.agent_id == agent_id,
            Proposal.is_latest == True,  # noqa: E712
        )
    )
    if not include_deleted:
        q = q.filter(Proposal.deleted_at.is_(None))
    return q.order_by(Proposal.received_at.asc()).all()


def list_agents_for_non_winner_proposals(
    session: Session,
    quotation_id: uuid.UUID,
    include_deleted: bool = False,
) -> list[uuid.UUID]:
    """Return agent IDs of latest proposals that are not marked as winner.

    Operates on is_latest=True proposals only — one per agent — so the
    caller receives one entry per agent regardless of revision history.
    Used to build the loser notification list after a winner is selected.
    """
    return [
        p.agent_id
        for p in list_by_quotation(
            session, quotation_id, latest_only=True, include_deleted=include_deleted
        )
        if not p.is_winner
    ]


def list_versions_for_agent(
    session: Session,
    quotation_id: uuid.UUID,
    agent_id: uuid.UUID,
    include_deleted: bool = False,
) -> list[Proposal]:
    q = (
        session.query(Proposal)
        .filter(
            Proposal.quotation_id == quotation_id,
            Proposal.agent_id == agent_id,
        )
    )
    if not include_deleted:
        q = q.filter(Proposal.deleted_at.is_(None))
    return q.order_by(Proposal.version.asc()).all()


def mark_superseded(session: Session, proposal_id: uuid.UUID) -> None:
    session.query(Proposal).filter(Proposal.id == proposal_id).update(
        {"is_latest": False}, synchronize_session="fetch"
    )


def mark_deleted(session: Session, proposal_id: uuid.UUID) -> Optional[Proposal]:
    """Soft-delete a proposal by setting `deleted_at` to the current UTC time.

    Returns the updated proposal, or None if it does not exist. Idempotent:
    calling twice leaves the existing `deleted_at` value unchanged.
    """
    proposal = session.get(Proposal, proposal_id)
    if proposal is None:
        return None
    if proposal.deleted_at is None:
        proposal.deleted_at = datetime.now(timezone.utc)
        session.flush()
    return proposal


def restore(session: Session, proposal_id: uuid.UUID) -> Optional[Proposal]:
    """Undo a soft-delete by clearing `deleted_at`.

    Returns the updated proposal, or None if it does not exist.
    """
    proposal = session.get(Proposal, proposal_id)
    if proposal is None:
        return None
    proposal.deleted_at = None
    session.flush()
    return proposal


def update(
    session: Session,
    proposal_id: uuid.UUID,
    total_value: float,
    freight_value: float,
    taxes_breakdown: dict,
    transit_time: int,
    insurance_included: bool,
    route_type: Optional[RouteType] = None,
    route_detail: Optional[str] = None,
    carrier: Optional[str] = None,
    validity: Optional[date] = None,
    incoterm: Optional[str] = None,
    numero_oferta: Optional[str] = None,
    ptax_percentual: Optional[float] = None,
    prazo_pagamento_dias: Optional[int] = None,
    seguro_percentual: Optional[float] = None,
    seguro_minimo: Optional[float] = None,
    frequencia: Optional[str] = None,
    free_time_dias: Optional[int] = None,
    observations: Optional[str] = None,
    taxes_currency_breakdown: Optional[dict] = None,
    freight_currency: Optional[str] = None,
    containers_priced: Optional[int] = None,
    offered_container_type: Optional[TipoContainer] = None,
) -> Optional[Proposal]:
    proposal = session.get(Proposal, proposal_id)
    if proposal is None:
        return None
    proposal.total_value = total_value
    proposal.freight_value = freight_value
    proposal.taxes_breakdown = taxes_breakdown
    proposal.transit_time = transit_time
    proposal.insurance_included = insurance_included
    proposal.route_type = route_type
    proposal.route_detail = route_detail
    proposal.carrier = carrier
    proposal.validity = validity
    proposal.incoterm = incoterm
    proposal.numero_oferta = numero_oferta
    proposal.ptax_percentual = ptax_percentual
    proposal.prazo_pagamento_dias = prazo_pagamento_dias
    proposal.seguro_percentual = seguro_percentual
    proposal.seguro_minimo = seguro_minimo
    proposal.frequencia = frequencia
    proposal.free_time_dias = free_time_dias
    proposal.observations = observations
    proposal.taxes_currency_breakdown = taxes_currency_breakdown
    proposal.freight_currency = freight_currency
    proposal.containers_priced = containers_priced
    proposal.offered_container_type = offered_container_type
    session.flush()
    return proposal


def get_winner(session: Session, quotation_id: uuid.UUID) -> Optional[Proposal]:
    """Return the winning (is_winner=True, is_latest=True) non-deleted proposal for a quotation."""
    return (
        session.query(Proposal)
        .filter(
            Proposal.quotation_id == quotation_id,
            Proposal.is_winner == True,  # noqa: E712
            Proposal.is_latest == True,  # noqa: E712
            Proposal.deleted_at.is_(None),
        )
        .first()
    )


def set_winner(
    session: Session,
    quotation_id: uuid.UUID,
    proposal_id: uuid.UUID,
) -> Optional[Proposal]:
    """Mark proposal_id as winner, clear is_winner on all other proposals for the quotation.

    Returns None if the target proposal does not exist, belongs to another
    quotation, or has been soft-deleted.
    """
    session.query(Proposal).filter(
        Proposal.quotation_id == quotation_id,
    ).update({"is_winner": False}, synchronize_session="fetch")

    proposal = session.get(Proposal, proposal_id)
    if proposal is None or proposal.quotation_id != quotation_id:
        return None
    if proposal.deleted_at is not None:
        return None
    proposal.is_winner = True
    session.flush()
    return proposal


def clear_winner(session: Session, quotation_id: uuid.UUID) -> None:
    """Clear is_winner on every proposal of a quotation.

    Used whenever a transition needs to drop the current winner selection:
    a guard-rail block returning ENVIADA_CLIENTE (ARB-2449), or a FECHADA ->
    COTANDO reopen — both call this via quotation_state_machine._clear_winner
    so no stale winner survives the re-pick.
    """
    session.query(Proposal).filter(
        Proposal.quotation_id == quotation_id,
    ).update({"is_winner": False}, synchronize_session="fetch")
    session.flush()


def update_extraction(
    session: Session,
    proposal_id: uuid.UUID,
    extracted_fields: dict,
    confidence_scores: dict,
    extraction_model: str,
) -> Optional[Proposal]:
    """Apply AI-extracted fields to a proposal.

    Only overwrites fields where the extracted value is not None.
    """
    proposal = session.get(Proposal, proposal_id)
    if proposal is None:
        return None

    for field_name, cast_fn in _EXTRACTION_FIELD_SETTERS.items():
        value = extracted_fields.get(field_name)
        if value is not None:
            setattr(proposal, field_name, cast_fn(value))

    validity = extracted_fields.get("validity")
    if validity is not None:
        try:
            proposal.validity = parse_date(validity)
        except ValueError:
            logger.warning(
                "Invalid validity date extracted from proposal ignored",
                extra={"proposal_id": str(proposal_id), "validity": validity},
            )

    route_type = extracted_fields.get("route_type")
    if route_type is not None:
        try:
            proposal.route_type = RouteType(route_type)
        except ValueError:
            logger.warning(
                "Invalid route_type extracted from proposal ignored",
                extra={"proposal_id": str(proposal_id), "route_type": route_type},
            )
            pass

    taxes = extracted_fields.get("taxes_breakdown")
    if taxes and isinstance(taxes, dict):
        proposal.taxes_breakdown = coerce_taxes_breakdown(taxes)

    taxes_currency = extracted_fields.get("taxes_currency_breakdown")
    if taxes_currency and isinstance(taxes_currency, dict):
        proposal.taxes_currency_breakdown = taxes_currency

    proposal.confidence_scores = confidence_scores
    proposal.extraction_status = ExtractionStatus.COMPLETED
    proposal.extraction_model = extraction_model
    proposal.extracted_at = datetime.now(timezone.utc)

    session.flush()
    return proposal


def update_attachment(
    session: Session,
    proposal_id: uuid.UUID,
    original_email_s3_key: Optional[str] = None,
    attachment_entry: Optional[dict] = None,
) -> Optional[Proposal]:
    """Update attachment fields on a proposal.

    Args:
        original_email_s3_key: S3 key for the original .msg email.
        attachment_entry: Dict {filename: s3_key} to merge into attachments_s3_keys.
    """
    proposal = session.get(Proposal, proposal_id)
    if proposal is None:
        return None
    if original_email_s3_key is not None:
        proposal.original_email_s3_key = original_email_s3_key
    if attachment_entry is not None:
        current = dict(proposal.attachments_s3_keys or {})
        current.update(attachment_entry)
        proposal.attachments_s3_keys = current
    session.flush()
    return proposal
