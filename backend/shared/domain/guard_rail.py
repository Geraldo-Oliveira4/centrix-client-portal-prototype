"""Guard rail engine — portal-flow safety net (ARB-2449).

Temporary safety net while the autonomous portal flow (Epico 1) is validated.
MVP = two independent travas, both configured in code (no screen, no criteria
table — the final criteria are not yet closed):

  Trava 1 — global toggle (feature flag): env GUARD_RAIL_ENABLED (default "true",
    same convention as the AUDIT_M*_ACTIVE flags). While true, every portal
    quotation is held for Freitas review. Exit condition: 30 consecutive days
    without an adjustment request -> set it to "false" -> autonomous flow (spec 4.2).

  Trava 2 — high-value trigger: independent of the toggle. If any is_latest
    proposal's total_value exceeds GUARD_RAIL_HIGH_VALUE_THRESHOLD_USD (default
    50000), the guard rail engages even with the toggle off.

Scope: portal-origin quotations only. Internal analyst flow is never affected.

A persisted human decision (Quotation.guard_rail_decision) overrides the computed
travas: RELEASED unlocks client approval, BLOCKED keeps it locked. This module is
pure (no DB access) so both travas and the decision precedence are unit-testable;
callers pass the already-resolved inputs (is_portal_origin, max_proposal_value,
decision).
"""

import os

import uuid

from sqlalchemy.orm import Session

from shared.database.models.quotation.enums import GuardRailDecision, QuotationState
from shared.database.repositories import proposal_repository, quotation_repository

# The guard rail reviews the client's *selection* (ARB-2449). The client picks
# and approves a proposal freely in ENVIADA_CLIENTE; that approval advances the
# quotation to APROVADA_PELO_CLIENTE, where Freitas reviews the choice before the
# quotation closes. So the guard rail engages only in APROVADA_PELO_CLIENTE —
# earlier in the lifecycle (and back in ENVIADA_CLIENTE after a block) it stays
# dormant: no kanban tag, no "em revisao" banner.
GUARD_RAIL_STATES = {QuotationState.APROVADA_PELO_CLIENTE}

# Reason type identifiers surfaced to the kanban/portal payloads.
# Cross-language duplication: these codes and the GuardRailDecision values are
# re-declared on the frontend as string-literal unions in
# frontend/types/quotation.ts (GuardRailReason.type, GuardRailDecision) and
# branched on in frontend/app/cotacao/kanban/components/guard-rail-control.tsx
# (reasonLabel). A new reason type must be added on both sides.
REASON_VALIDATION_PERIOD = "validation_period"
REASON_HIGH_VALUE = "high_value"

# Client-approval gate contract (ARB-2449). Shared by both approve gates and
# mirrored on the frontend, which switches on `code`
# (frontend/app/portal/cotacao/[id]/page.tsx). Keep the three in sync.
GUARD_RAIL_BLOCKED_CODE = "guard_rail_active"
GUARD_RAIL_BLOCKED_MESSAGE = "Esta proposta esta em revisao pela Freitas."
CLIENT_APPROVAL_BLOCKED_LOG = "client_approval_blocked_by_guard_rail"

_ENABLED_DEFAULT = "true"
_DEFAULT_HIGH_VALUE_THRESHOLD_USD = 50000.0


def is_toggle_enabled() -> bool:
    """Trava 1 — global feature flag. Defaults to true (validation phase)."""
    return os.environ.get("GUARD_RAIL_ENABLED", _ENABLED_DEFAULT).lower() == "true"


def high_value_threshold_usd() -> float:
    """Trava 2 threshold in USD. Falls back to the default on unset/invalid input."""
    raw = os.environ.get("GUARD_RAIL_HIGH_VALUE_THRESHOLD_USD")
    if raw is None or raw.strip() == "":
        return _DEFAULT_HIGH_VALUE_THRESHOLD_USD
    try:
        return float(raw)
    except ValueError:
        return _DEFAULT_HIGH_VALUE_THRESHOLD_USD


def _max_latest_proposal_value(proposals) -> float | None:
    """Highest total_value across is_latest proposals in an already-loaded list.

    Filters is_latest defensively (not trusting the caller's fetch options) so it
    matches proposal_repository.batch_fetch_max_latest_total_value used by the DB
    gate — even if a caller passes a list that included superseded versions.
    """
    values = [
        float(p.total_value)
        for p in proposals
        if getattr(p, "is_latest", True) and p.total_value is not None
    ]
    return max(values) if values else None


def _compute_reasons(max_proposal_value: float | None) -> list[dict]:
    """Which travas currently trigger, independent of any human decision.

    Kept separate from `active` so the UI can always explain *why* the guard rail
    would engage, even after an analyst releases it.
    """
    reasons: list[dict] = []
    if is_toggle_enabled():
        reasons.append({"type": REASON_VALIDATION_PERIOD})
    threshold = high_value_threshold_usd()
    if max_proposal_value is not None and float(max_proposal_value) > threshold:
        reasons.append({
            "type": REASON_HIGH_VALUE,
            "value": float(max_proposal_value),
            "threshold": threshold,
        })
    return reasons


def evaluate_guard_rail(
    *,
    is_portal_origin: bool,
    max_proposal_value: float | None,
    decision: GuardRailDecision | None = None,
) -> dict:
    """Return {"active": bool, "reasons": list[dict]} for a quotation.

    - Non-portal quotations are never held: {"active": False, "reasons": []}.
    - `reasons` reflects the computed travas regardless of the decision.
    - `active` respects the persisted decision precedence:
        RELEASED -> False (unlocked), BLOCKED -> True (locked),
        None     -> True iff at least one trava triggers.

    When active is True, the client's selection is held in APROVADA_PELO_CLIENTE
    for Freitas review: an analyst either releases it (the close flow proceeds) or
    blocks it (the quotation returns to ENVIADA_CLIENTE for the client to re-pick).
    """
    if not is_portal_origin:
        return {"active": False, "reasons": []}

    reasons = _compute_reasons(max_proposal_value)

    if decision == GuardRailDecision.RELEASED:
        active = False
    elif decision == GuardRailDecision.BLOCKED:
        active = True
    else:
        active = len(reasons) > 0

    return {"active": active, "reasons": reasons}


def build_guard_rail_fields(
    quotation,
    *,
    is_portal_origin: bool,
    max_proposal_value: float | None,
) -> dict:
    """Serialize the full guard-rail block for an internal (analyst) payload.

    Single source of truth for the guard-rail keys added to the kanban card and
    the portal payloads, so the computed evaluation and the persisted decision
    never drift between read paths. Reads the persisted decision straight off the
    quotation ORM object.
    """
    decision = quotation.guard_rail_decision
    if quotation.state in GUARD_RAIL_STATES:
        evaluation = evaluate_guard_rail(
            is_portal_origin=is_portal_origin,
            max_proposal_value=max_proposal_value,
            decision=decision,
        )
    else:
        # Dormant outside the client-approval window — no tag, no reasons.
        evaluation = {"active": False, "reasons": []}
    reviewed_at = quotation.guard_rail_reviewed_at
    return {
        "guard_rail_active": evaluation["active"],
        "guard_rail_reasons": evaluation["reasons"],
        "guard_rail_decision": decision.value if decision else None,
        "guard_rail_block_reason": quotation.guard_rail_block_reason,
        "guard_rail_reviewed_by": quotation.guard_rail_reviewed_by,
        "guard_rail_reviewed_at": reviewed_at.isoformat() if reviewed_at else None,
    }


def active_from_proposals(quotation, *, is_portal_origin: bool, proposals) -> bool:
    """Read-path boolean: is the guard rail active, given already-loaded proposals?

    The portal read handlers (get_my_quotation, list_my_quotations) have the
    proposal list in hand, so this avoids re-querying. Owns the is_latest rule in
    one place so those handlers never re-implement the max/evaluate wiring.
    """
    if quotation.state not in GUARD_RAIL_STATES:
        return False
    return evaluate_guard_rail(
        is_portal_origin=is_portal_origin,
        max_proposal_value=_max_latest_proposal_value(proposals),
        decision=quotation.guard_rail_decision,
    )["active"]


def is_active(session: Session, quotation) -> bool:
    """Resolve whether the guard rail currently holds this quotation.

    Gathers the two DB-backed inputs (portal origin + top is_latest proposal
    value) and applies evaluate_guard_rail with the persisted decision. Single
    entry point for the client-approval gate, so approve_proposal (portal) and
    approve_client_proposal (token) never diverge on when to return 423.
    """
    quotation_id: uuid.UUID = quotation.id
    if quotation.state not in GUARD_RAIL_STATES:
        return False
    is_portal_origin = quotation_repository.was_created_by_portal(session, quotation_id)
    if not is_portal_origin:
        return False
    max_value_by_id = proposal_repository.batch_fetch_max_latest_total_value(
        session, [quotation_id]
    )
    evaluation = evaluate_guard_rail(
        is_portal_origin=True,
        max_proposal_value=max_value_by_id.get(quotation_id),
        decision=quotation.guard_rail_decision,
    )
    return evaluation["active"]


def build_guard_rail_fields_from_db(session: Session, quotation) -> dict:
    """Session-aware sibling of build_guard_rail_fields.

    Gathers the two DB inputs itself (mirroring is_active's convention) and
    delegates to the pure builder. Used by the analyst action handlers
    (release/block); the batch kanban path keeps calling build_guard_rail_fields
    directly with its already-batch-fetched values.
    """
    is_portal_origin = quotation_repository.was_created_by_portal(session, quotation.id)
    max_value_by_id = proposal_repository.batch_fetch_max_latest_total_value(
        session, [quotation.id]
    )
    return build_guard_rail_fields(
        quotation,
        is_portal_origin=is_portal_origin,
        max_proposal_value=max_value_by_id.get(quotation.id),
    )


def blocked_response_body() -> dict:
    """Body for the 423 returned by both client-approval gates when the guard
    rail is active. Centralizes the user message + machine `code` contract."""
    return {"error": GUARD_RAIL_BLOCKED_MESSAGE, "code": GUARD_RAIL_BLOCKED_CODE}
