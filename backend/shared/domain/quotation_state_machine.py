"""Quotation state machine — transition rules, guards, and execution.

All state transitions flow through this module. Handlers and system triggers
call `transition()` to move a quotation between states. The Kanban frontend
calls `check_all_transitions()` to know which drag targets are valid.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from shared.database.models.quotation.audit_flag import AuditFlag
from shared.database.models.quotation.enums import (
    DeclineReason,
    Modal,
    QuotationState,
    Severity,
    SIStatus,
    TipoEmbarque,
)
from shared.database.models.quotation.proposal import Proposal
from shared.database.models.quotation.quotation import Quotation
from shared.database.repositories import (
    freight_agent_repository,
    proposal_repository,
    quotation_repository,
    rfq_repository,
    shipment_instruction_repository,
)
from shared.database.repositories.quotation_repository import COTANDO_REQUIRED_FIELDS
from shared.domain import shipment_service
from shared.lambda_helpers import resolve_agent_name, validate_enum_field
from shared.observability import logger

# ---------------------------------------------------------------------------
# Transition graph
# ---------------------------------------------------------------------------

ALLOWED_TRANSITIONS: dict[QuotationState, list[QuotationState]] = {
    QuotationState.TRIAGEM_IA: [
        QuotationState.AGUARDANDO_DADOS,
        QuotationState.COTANDO,
        QuotationState.CANCELADO,
    ],
    QuotationState.AGUARDANDO_DADOS: [
        QuotationState.TRIAGEM_IA,
        QuotationState.COTANDO,
        QuotationState.CANCELADO,
    ],
    QuotationState.COTANDO: [
        QuotationState.PARA_ANALISE,
        QuotationState.CANCELADO,
    ],
    QuotationState.PARA_ANALISE: [
        QuotationState.REVISAO_AGENTE,
        QuotationState.ENVIADA_CLIENTE,
        QuotationState.FECHADA,
        QuotationState.CANCELADO,
    ],
    QuotationState.REVISAO_AGENTE: [
        QuotationState.PARA_ANALISE,
        QuotationState.ENVIADA_CLIENTE,
        QuotationState.FECHADA,
        QuotationState.CANCELADO,
    ],
    QuotationState.ENVIADA_CLIENTE: [
        QuotationState.APROVADA_PELO_CLIENTE,
        QuotationState.FECHADA,
        QuotationState.DECLINADA,
        QuotationState.CANCELADO,
    ],
    QuotationState.APROVADA_PELO_CLIENTE: [
        # Guard rail (ARB-2449): an analyst can send the client's selection back
        # to ENVIADA_CLIENTE (blocked with a reason) so they pick another proposal.
        QuotationState.ENVIADA_CLIENTE,
        QuotationState.FECHADA,
        QuotationState.CANCELADO,
    ],
    QuotationState.FECHADA: [
        QuotationState.COTANDO,
        QuotationState.DECLINADA,
    ],
    QuotationState.DECLINADA: [],
    QuotationState.CANCELADO: [],
}

# Single source of truth mapping a state to the durable timestamp column stamped
# on entry into it. Drives both the stamp in transition() and the kanban
# column-vs-log fallback. Add a state here and both runtime paths pick it up —
# do not hardcode the pairing anywhere else (the migration/serializer enumerate
# the columns literally by necessity, but no runtime logic should).
STATE_TIMESTAMP_COLUMNS: dict[QuotationState, str] = {
    QuotationState.ENVIADA_CLIENTE: "sent_at",
    QuotationState.FECHADA: "closed_at",
    QuotationState.DECLINADA: "declined_at",
}

_BLOCKING_SEVERITIES = {Severity.HIGH, Severity.CRITICAL}

# States from which a quotation may advance to COTANDO on RFQ dispatch. Single
# authority — the RFQ dispatch service imports this instead of redefining it.
COTANDO_ELIGIBLE_STATES = {QuotationState.TRIAGEM_IA, QuotationState.AGUARDANDO_DADOS}

# ---------------------------------------------------------------------------
# Private query helpers — only latest proposals are relevant for guards
# ---------------------------------------------------------------------------


def _count_blocking_flags(session: Session, quotation_id) -> int:
    """Count unresolved HIGH/CRITICAL flags on the latest proposals.

    Superseded proposals (is_latest=False) are excluded — their flags
    no longer represent the current state of the quotation.
    """
    return (
        session.query(func.count(AuditFlag.id))
        .join(Proposal, Proposal.id == AuditFlag.proposal_id)
        .filter(
            Proposal.quotation_id == quotation_id,
            Proposal.is_latest == True,  # noqa: E712
            AuditFlag.resolved == False,  # noqa: E712
            AuditFlag.severity.in_(_BLOCKING_SEVERITIES),
        )
        .scalar()
    )


# ---------------------------------------------------------------------------
# Guard functions — return list[str] of blocking reasons (empty = pass)
# ---------------------------------------------------------------------------


def _guard_to_cotando(session: Session, quotation: Quotation, **context) -> list[str]:
    # COTANDO must only be reached as a side effect of actually dispatching the
    # RFQ to agents (rfq_dispatch_service._attempt_cotando_transition stamps
    # rfq.dispatched_at before calling transition()) — never via a bare manual
    # move. Otherwise an analyst can drag/flip the card to COTANDO without any
    # agent ever being contacted, leaving the quotation silently stuck.
    rfq = rfq_repository.get_by_quotation(session, quotation.id)
    reasons = []
    if rfq is None or rfq.dispatched_at is None:
        reasons.append("A RFQ ainda nao foi enviada aos agentes")

    required = list(COTANDO_REQUIRED_FIELDS)
    if quotation.agente_define_local_coleta or quotation.incoterm == "FOB":
        required = [f for f in required if f != "origin"]
    if quotation.tipo_embarque in (TipoEmbarque.FCL, TipoEmbarque.LCL) or quotation.modal == Modal.AEREO:
        required = [f for f in required if f != "stackability"]
    missing = [field for field in required if getattr(quotation, field, None) is None]
    reasons += [f"Missing required field: {field}" for field in missing]
    return reasons


def _guard_to_enviada_cliente(
    session: Session, quotation: Quotation, **context
) -> list[str]:
    # Audit flags are informational — they do not block sending to client.
    # Analysts are expected to review flags before proceeding; the system
    # does not enforce this as a hard gate.
    return []


def _guard_to_aprovada_pelo_cliente(
    session: Session, quotation: Quotation, **context
) -> list[str]:
    reasons = []
    if not context.get("winning_agent_id"):
        reasons.append("Missing required field: winning_agent_id")
    if context.get("quoted_value_usd") is None:
        reasons.append("Missing required field: quoted_value_usd")
    return reasons


def _guard_to_fechada(session: Session, quotation: Quotation, **context) -> list[str]:
    # When coming from APROVADA_PELO_CLIENTE, winning_agent_id is already set on
    # the quotation (persisted during that transition), so context fields are optional.
    if quotation.state == QuotationState.APROVADA_PELO_CLIENTE:
        return []
    reasons = []
    if not context.get("winning_agent_id"):
        reasons.append("Missing required field: winning_agent_id")
    if context.get("quoted_value_usd") is None:
        reasons.append("Missing required field: quoted_value_usd")
    return reasons


def _guard_to_declinada(session: Session, quotation: Quotation, **context) -> list[str]:
    raw = context.get("decline_reason")
    if not raw:
        return ["Missing required field: decline_reason"]
    _, err_msg = validate_enum_field("decline_reason", raw, DeclineReason)
    if err_msg:
        return [err_msg]
    return []


_GUARDS: dict[QuotationState, callable] = {
    QuotationState.COTANDO: _guard_to_cotando,
    QuotationState.ENVIADA_CLIENTE: _guard_to_enviada_cliente,
    QuotationState.APROVADA_PELO_CLIENTE: _guard_to_aprovada_pelo_cliente,
    QuotationState.FECHADA: _guard_to_fechada,
    QuotationState.DECLINADA: _guard_to_declinada,
}

# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def check_transition(
    session: Session,
    quotation: Quotation,
    target_state: QuotationState,
    **context,
) -> dict:
    """Validate whether a transition is allowed without executing it.

    Returns {"allowed": bool, "blocked_by": list[str]}.
    """
    allowed_targets = ALLOWED_TRANSITIONS.get(quotation.state, [])
    if target_state not in allowed_targets:
        return {
            "allowed": False,
            "blocked_by": [
                f"Transition from {quotation.state.value} to {target_state.value} is not allowed"
            ],
        }

    guard = _GUARDS.get(target_state)
    if guard:
        reasons = guard(session, quotation, **context)
        if reasons:
            return {"allowed": False, "blocked_by": reasons}

    return {"allowed": True, "blocked_by": []}


# Guards that require user-supplied context — skip during check_all_transitions
# since the data will only be available at execution time.
_CONTEXT_DEPENDENT_GUARDS = {
    QuotationState.APROVADA_PELO_CLIENTE,
    QuotationState.FECHADA,
    QuotationState.DECLINADA,
}


def check_all_transitions(
    session: Session,
    quotation: Quotation,
) -> dict[str, dict]:
    """For each reachable target state, return whether the transition is allowed.

    Used by GET /allowed-transitions for Kanban drag targets.
    Guards that depend on user-supplied context (FECHADA, DECLINADA) are skipped
    here — they will be enforced when the transition is actually executed.
    """
    targets = ALLOWED_TRANSITIONS.get(quotation.state, [])
    result = {}
    for target in targets:
        if target in _CONTEXT_DEPENDENT_GUARDS:
            # Only check graph validity, skip the guard
            result[target.value] = {"allowed": True, "blocked_by": []}
        else:
            result[target.value] = check_transition(session, quotation, target)
    return result


def _clear_winner(session: Session, quotation: Quotation) -> None:
    """Drop the quotation-level winner fields and proposal.is_winner together.

    Shared by every edge that discards a previous winner selection (guard-rail
    return to ENVIADA_CLIENTE, FECHADA -> COTANDO reopen) so the two levels
    can never be left half-cleared (ARB-2449).
    """
    quotation.winning_agent_id = None
    quotation.quoted_value_usd = None
    proposal_repository.clear_winner(session, quotation.id)


def _apply_transition_side_effects(
    session: Session,
    quotation: Quotation,
    previous_state: QuotationState,
    target_state: QuotationState,
    context: dict,
) -> None:
    """Persist the per-state side effects of a transition (winner + decline data).

    Isolated from transition() so each state's effect is named in one place and
    the winner fields are not touched inline across the main flow.
    """
    if target_state == QuotationState.DECLINADA:
        quotation.decline_reason = DeclineReason(context["decline_reason"])
        quotation.decline_note = context.get("decline_note")

    elif target_state == QuotationState.APROVADA_PELO_CLIENTE:
        quotation.winning_agent_id = uuid.UUID(context["winning_agent_id"])
        quotation.quoted_value_usd = context["quoted_value_usd"]

    elif (
        target_state == QuotationState.ENVIADA_CLIENTE
        and previous_state == QuotationState.APROVADA_PELO_CLIENTE
    ):
        # Guard-rail block sends the selection back to the client: drop the winner
        # the quotation carried in APROVADA_PELO_CLIENTE so a fresh pick starts clean.
        _clear_winner(session, quotation)

    elif (
        target_state == QuotationState.FECHADA
        and previous_state != QuotationState.APROVADA_PELO_CLIENTE
    ):
        # winning_agent_id and quoted_value_usd are already set when coming from
        # APROVADA_PELO_CLIENTE; only overwrite when closing from other states.
        quotation.winning_agent_id = uuid.UUID(context["winning_agent_id"])
        quotation.quoted_value_usd = context["quoted_value_usd"]

    elif target_state == QuotationState.COTANDO and previous_state == QuotationState.FECHADA:
        # Reopening a closed quotation to switch to a different agent: drop the
        # stale winner so the next FECHADA cycle starts clean, then cancel any SI
        # already generated for the old closing so create_shipment_instruction
        # issues a fresh draft for the new agent instead of silently returning
        # the stale one (its lookup is idempotent by quotation_id and has no
        # other way to tell the two closings apart).
        _clear_winner(session, quotation)
        existing_si = shipment_instruction_repository.get_by_quotation(session, quotation.id)
        if existing_si and existing_si.status != SIStatus.CANCELADA:
            shipment_instruction_repository.cancel(session, existing_si)

    if target_state == QuotationState.FECHADA:
        # GE provisioning is an automatic side effect of closing a quotation.
        # All four close paths (send_shipment_instruction, select_winner,
        # notify_winner auto-close, drag-and-drop Kanban) flow through here,
        # so Processo + Embarque creation cannot be forgotten by a caller.
        if quotation.client_id is None:
            logger.warning(
                "Skipping GE provisioning: quotation has no client_id",
                extra={"quotation_id": str(quotation.id)},
            )
        else:
            shipment_service.provision_processo_from_quotation(session, quotation)


def approve_client_selection(
    session: Session,
    quotation: Quotation,
    proposal: Proposal,
    actor_id: str,
    *,
    extra_context: Optional[dict] = None,
) -> tuple[dict, str]:
    """Register a client's proposal approval (ARB-2449).

    Single source of truth for "what client approval does", shared by the
    authenticated portal and the shared-link handlers: advance to
    APROVADA_PELO_CLIENTE for Freitas review, then — only once that transition
    is confirmed valid — mark the winner and reset any prior guard-rail
    decision so a re-pick after a block is reviewed fresh.

    The transition is validated first and the winner is only persisted on
    success so a rejected approval (invalid state, race with another
    approval) never leaves a stale is_winner flag behind: get_session()
    commits on any normal `with`-block exit, including an early `return` from
    a 409 handler, so a write made before the guard check would survive even
    though the caller treats the approval as failed.

    Returns (transition_result, agent_name). Callers MUST honor
    transition_result["success"] before proceeding.
    """
    agent = freight_agent_repository.get(session, proposal.agent_id)
    agent_name = resolve_agent_name(agent)

    context = {
        "winning_agent_id": str(proposal.agent_id),
        "quoted_value_usd": float(proposal.total_value),
        "proposal_id": str(proposal.id),
        "agent_name": agent_name,
        **(extra_context or {}),
    }
    result = transition(
        session,
        quotation,
        QuotationState.APROVADA_PELO_CLIENTE,
        actor_id,
        action="client_approved_proposal",
        **context,
    )
    if result["success"]:
        proposal_repository.set_winner(session, quotation.id, proposal.id)
        quotation_repository.reset_guard_rail_decision(session, quotation)
    return result, agent_name


def transition(
    session: Session,
    quotation: Quotation,
    target_state: QuotationState,
    user_id: str,
    action: str = "state_transition",
    **context,
) -> dict:
    """Execute a state transition. Validates, updates state, writes audit log.

    The `action` parameter customizes the audit log entry. Defaults to
    "state_transition" for system/analyst flows; portal-driven flows pass
    custom values like "client_approved_proposal" so the timeline and UI
    can distinguish client decisions from internal ones.

    Returns {"success": bool, "state": str|None, "blocked_by": list[str]}.
    """
    check = check_transition(session, quotation, target_state, **context)
    if not check["allowed"]:
        return {"success": False, "state": None, "blocked_by": check["blocked_by"]}

    previous_state = quotation.state
    quotation.state = target_state
    now = datetime.now(timezone.utc)
    quotation.updated_at = now

    # Durable transition timestamps (authoritative source for kanban card dates).
    # Overwrite on re-entry so the column always reflects the most recent
    # transition into that state, matching the historical max(created_at) semantics.
    timestamp_column = STATE_TIMESTAMP_COLUMNS.get(target_state)
    if timestamp_column:
        setattr(quotation, timestamp_column, now)

    _apply_transition_side_effects(session, quotation, previous_state, target_state, context)

    quotation_repository.append_log(
        session,
        quotation_id=quotation.id,
        action=action,
        user_id=user_id,
        previous_state=previous_state.value,
        new_state=target_state.value,
        details=context or None,
    )

    session.flush()
    return {"success": True, "state": target_state.value, "blocked_by": []}


def apply_post_proposal_transitions(
    session: Session,
    quotation: Quotation,
    actor_id: str,
    flag_dicts: list[dict],
) -> None:
    """Fire state transitions that must occur after every proposal creation.

    Centralises the two-conditional transition sequence shared by all
    proposal-creation paths (create_proposal, submit_proposal, extract_proposal_data).
    Callers must not duplicate this logic — extend this function instead.

    Transitions fired:
      - COTANDO → PARA_ANALISE when the first proposal arrives.
      - PARA_ANALISE → REVISAO_AGENTE when the proposal has at least one CRITICAL flag.
    """
    has_critical = any(f["severity"] == Severity.CRITICAL for f in flag_dicts)

    if quotation.state == QuotationState.COTANDO:
        latest_count = (
            session.query(func.count(Proposal.id))
            .filter(
                Proposal.quotation_id == quotation.id,
                Proposal.is_latest == True,  # noqa: E712
            )
            .scalar()
        )
        if latest_count >= 3:
            transition(
                session, quotation, QuotationState.PARA_ANALISE, actor_id,
                proposals_received=True,
            )

    if has_critical and quotation.state == QuotationState.PARA_ANALISE:
        transition(
            session, quotation, QuotationState.REVISAO_AGENTE, actor_id,
        )


# Actor recorded on system-driven portal transitions (no human clicks "send").
PORTAL_AUTO_ACTOR = "system:portal-auto"

# Portal-driven advance path toward the client decision point. Excludes
# REVISAO_AGENTE deliberately: a critical audit flag must be resolved before the
# quotation reaches the client, so we never auto-advance out of that state.
_PORTAL_ADVANCE_CHAIN = [
    (QuotationState.COTANDO, QuotationState.PARA_ANALISE),
    (QuotationState.PARA_ANALISE, QuotationState.ENVIADA_CLIENTE),
]


def auto_advance_portal_to_client(
    session: Session, quotation: Quotation, actor_id: str = PORTAL_AUTO_ACTOR
) -> Optional[str]:
    """Advance a portal-origin quotation toward ENVIADA_CLIENTE without an analyst.

    The portal has no manual "Enviar ao Cliente" step: once enough proposals
    have arrived and the recommendation is ready, the quotation must reach the
    client decision point on its own (ARB-2451). Advances COTANDO -> PARA_ANALISE
    -> ENVIADA_CLIENTE as far as the guards allow, returning the final state value
    reached (or None if no transition fired).

    The caller is responsible for restricting this to portal-origin quotations
    (via quotation_repository.was_created_by_portal); internal analyst quotations
    must never reach this path so their manual send step is preserved.
    """
    final_state: Optional[str] = None
    for from_state, to_state in _PORTAL_ADVANCE_CHAIN:
        if quotation.state != from_state:
            continue
        result = transition(
            session, quotation, to_state, actor_id, action="portal_auto_advanced"
        )
        if not result["success"]:
            break
        final_state = result["state"]
    return final_state


def is_ready_to_send(session: Session, quotation: Quotation) -> bool:
    """Check the readiness indicator for sending to client.

    True when there are no unresolved HIGH/CRITICAL audit flags on any
    latest proposal belonging to this quotation.
    """
    return _count_blocking_flags(session, quotation.id) == 0
