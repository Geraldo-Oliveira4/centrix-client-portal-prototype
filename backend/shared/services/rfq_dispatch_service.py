"""Shared RFQ dispatch mechanics.

Encapsulates everything that happens between "the RFQ is saved" and "the
quotation is in COTANDO": agent resolution, OEA compliance, Moment-1 audit,
per-agent token generation, concurrent email dispatch, timestamp stamping,
audit logging, and the COTANDO transition.

Both the internal analyst handler (`lambdas/quotation/dispatch_rfq`) and the
client-portal handler (`lambdas/client_portal/dispatch_quotation_rfq`) call
`execute_rfq_dispatch`. Keeping the mechanics here prevents the two entry points
from drifting — the email format, audit behaviour and state transition are
guaranteed identical (a hard requirement of ARB-2450).
"""

import os
import secrets
import uuid
from datetime import datetime, timezone
from typing import Optional

from shared.database.models.quotation.enums import (
    AuditAcaoTomada,
    AuditResultado,
    QuotationState,
)
from shared.database.repositories import (
    cotacao_auditoria_repository,
    freight_agent_repository,
    quotation_equipment_repository,
    quotation_repository,
    quotation_volume_repository,
    rfq_agent_token_repository,
    rfq_repository,
    user_repository,
)
from shared.domain import quotation_audit_engine
from shared.domain.oea_compliance import check_oea_compliance
from shared.domain.quotation_state_machine import (
    COTANDO_ELIGIBLE_STATES,
    transition,
)
from shared.lambda_helpers import serialize_rfq
from shared.observability import logger
from shared.query_helpers import resolve_dna_and_exporter
from shared.services.microsoft_graph_service import (
    MicrosoftGraphError,
    get_access_token,
    send_mail,
)
from shared.services.rfq_email_builder import (
    build_cancellation_email,
    build_closing_cancelled_email,
    build_rfq_subject,
    dispatch_rfq_emails,
    get_rfq_target_emails,
)


def resolve_targeted_agents(session, agents_targeted: list) -> tuple[list, list[str]]:
    """Resolve agent UUIDs to FreightAgent records.

    Returns (agents, missing_ids). IDs that are malformed or no longer exist are
    collected in `missing_ids` and skipped.
    """
    agents = []
    missing_ids: list[str] = []
    for raw_id in agents_targeted or []:
        try:
            agent_uuid = uuid.UUID(str(raw_id))
        except (ValueError, TypeError):
            missing_ids.append(str(raw_id))
            continue
        agent = freight_agent_repository.get(session, agent_uuid)
        if agent is None:
            missing_ids.append(str(raw_id))
        else:
            agents.append(agent)
    return agents, missing_ids


def _run_moment_1_audit(session, quotation, rfq, quotation_uuid, audit_m1_active):
    """Run the Moment-1 pre-dispatch audit and persist the result.

    Returns a 422 body dict when the dispatch must abort (only when
    AUDIT_M1_ACTIVE and a strict divergence is present), otherwise None.
    """
    dna, exporter = resolve_dna_and_exporter(session, quotation)
    divergencias = quotation_audit_engine.audit_momento_1(quotation, rfq, dna, exporter)

    has_strict_block = any(d.get("tipo_validacao") == "strict" for d in divergencias)
    if divergencias:
        resultado = (
            AuditResultado.BLOQUEADO
            if (has_strict_block and audit_m1_active)
            else AuditResultado.DIVERGENTE
        )
    else:
        resultado = AuditResultado.APROVADO

    if audit_m1_active and divergencias:
        acao_tomada = (
            AuditAcaoTomada.BLOQUEIO if has_strict_block else AuditAcaoTomada.ALERTA
        )
    else:
        acao_tomada = AuditAcaoTomada.PASSIVO

    cotacao_auditoria_repository.create(
        session,
        cotacao_id=quotation_uuid,
        momento=1,
        resultado=resultado,
        acao_tomada=acao_tomada,
        divergencias=divergencias,
    )

    if audit_m1_active and has_strict_block:
        logger.warning(
            "Moment 1 audit blocked RFQ dispatch",
            extra={"divergencias_count": len(divergencias)},
        )
        return {
            "error": "Divergencias criticas impedem o disparo da RFQ. Resolva as pendencias antes de prosseguir.",
            "audit_divergencias": divergencias,
        }
    return None


def build_cc_addresses(session, actor_id: str) -> list[str]:
    """Standard CC list for an RFQ dispatch: logistics inbox plus the acting
    internal user when one is resolvable. Portal callers pass a portal `sub`
    that does not resolve to an internal user, so only logistics is CC'd.
    """
    cc_addresses = ["logistica@freitascomex.com.br"]
    user = user_repository.get(session, actor_id)
    if user and user.email:
        cc_addresses.append(user.email)
    return cc_addresses


def execute_rfq_dispatch(
    session,
    *,
    quotation,
    rfq,
    actor_id: str,
    mailbox_user: str,
    app_base_url: str,
    log_action: str = "state_transition",
    cc_addresses: Optional[list[str]] = None,
):
    """Run the full dispatch pipeline for an already-saved RFQ.

    Returns (status_code, body_dict) ready for build_response. Both entry points
    (internal + portal) share this so the email format, audit and COTANDO
    transition stay identical.

    `actor_id` is the acting user — an internal Cognito sub for the analyst flow
    or the portal client id for the portal flow. `log_action` names the audit-log
    action for the transition ("state_transition" for the analyst flow, a
    portal-specific value for the portal flow).
    """
    quotation_uuid = quotation.id

    is_redispatch = rfq.dispatched_at is not None
    if is_redispatch:
        deleted_count = rfq_agent_token_repository.delete_all_tokens_for_rfq(
            session, rfq.id
        )
        logger.info(
            "RFQ re-dispatch: deleted existing tokens",
            extra={"rfq_id": str(rfq.id), "deleted_count": deleted_count},
        )

    agents_targeted = rfq.agents_targeted or []
    if not agents_targeted:
        return 422, {"error": "No agents targeted in this RFQ"}

    agents, missing_ids = resolve_targeted_agents(session, agents_targeted)
    if missing_ids:
        logger.warning(
            "Some agents in agents_targeted could not be resolved",
            extra={"missing_ids": missing_ids},
        )
    if not agents:
        return 422, {
            "error": "None of the targeted agents could be resolved",
            "missing_ids": missing_ids,
        }

    oea_block = check_oea_compliance(
        session, quotation, agents, quotation_uuid, actor_id, logger=logger
    )
    if oea_block:
        return 422, oea_block

    audit_m1_active = os.environ.get("AUDIT_M1_ACTIVE", "false").lower() == "true"
    block = _run_moment_1_audit(
        session, quotation, rfq, quotation_uuid, audit_m1_active
    )
    if block is not None:
        return 422, block

    agent_tokens: dict[str, str] = {}
    for agent in agents:
        raw_token = secrets.token_urlsafe(32)
        rfq_agent_token_repository.create(session, rfq.id, agent.id, raw_token)
        agent_tokens[str(agent.id)] = raw_token

    try:
        token = get_access_token()
    except MicrosoftGraphError as exc:
        logger.exception("Failed to obtain Graph access token")
        return 502, {"error": f"Email authentication failed: {exc}"}

    equipments = quotation_equipment_repository.list_by_quotation(
        session, quotation_uuid
    )
    volumes = quotation_volume_repository.list_by_quotation(session, quotation_uuid)

    if cc_addresses is None:
        cc_addresses = build_cc_addresses(session, actor_id)

    subject = build_rfq_subject(quotation, rfq)

    agent_results = dispatch_rfq_emails(
        session=session,
        token=token,
        mailbox_user=mailbox_user,
        agents=agents,
        quotation=quotation,
        rfq=rfq,
        subject=subject,
        agent_tokens=agent_tokens,
        app_base_url=app_base_url,
        equipments=equipments,
        volumes=volumes,
        cc_addresses=cc_addresses,
    )

    now = datetime.now(timezone.utc)
    rfq_repository.update(session, rfq, dispatched_at=now)

    sent_names = [r["name"] for r in agent_results if r["status"] == "sent"]
    failed_names = [r["name"] for r in agent_results if r["status"] == "failed"]

    quotation_repository.append_log(
        session,
        quotation_id=quotation_uuid,
        action="rfq_redispatched" if is_redispatch else "rfq_dispatched",
        user_id=actor_id,
        details={
            "agents_sent": sent_names,
            "agents_failed": failed_names,
            "total_targeted": len(agents),
            "missing_agent_ids": missing_ids,
            "is_redispatch": is_redispatch,
        },
    )

    state_transition_result = _attempt_cotando_transition(
        session, quotation, actor_id, log_action
    )

    status_code = 200 if not failed_names else 207
    return status_code, {
        "dispatched_at": now.isoformat(),
        "rfq": serialize_rfq(rfq),
        "agents": agent_results,
        "state_transition": state_transition_result,
        "partial_failure": bool(failed_names),
        "agents_sent_count": len(sent_names),
        "agents_failed_count": len(failed_names),
    }


def _attempt_cotando_transition(session, quotation, user_id: str, log_action: str) -> dict:
    """Try to advance the quotation to COTANDO. Non-blocking — never raises."""
    if quotation.state not in COTANDO_ELIGIBLE_STATES:
        return {
            "success": False,
            "state": quotation.state.value,
            "blocked_by": [
                f"State {quotation.state.value} does not allow transition to COTANDO"
            ],
        }
    return transition(
        session, quotation, QuotationState.COTANDO, user_id, action=log_action
    )


# ---------------------------------------------------------------------------
# Cancellation notification — shared by the analyst transition handler and the
# client-portal cancel handler so both send the identical "cotacao CANCELADA"
# email to every agent that was targeted by the RFQ (ARB — cancel feature).
# ---------------------------------------------------------------------------


def _send_notification_email(
    session, token: str, mailbox_user: str, agent, quotation, *,
    subject: str, build_email, error_log_message: str,
) -> dict:
    """Send a single one-off notification email to an agent. Never raises.

    Shared by every best-effort per-agent notification (cancellation,
    closing-cancelled) so the send/error handling and NotificationResult shape
    only exist in one place. `build_email(agent_name, quotation)` must return
    html_body.
    """
    agent_id = str(agent.id)
    target_emails: list[str] = []
    try:
        target_emails = get_rfq_target_emails(session, agent, quotation)
        html_body = build_email(agent.name, quotation)
        send_mail(
            token=token,
            sender_user_id=mailbox_user,
            to_addresses=target_emails,
            subject=subject,
            body_html=html_body,
        )
        return {"id": agent_id, "name": agent.name, "emails": target_emails, "status": "sent"}
    except MicrosoftGraphError as exc:
        logger.error(
            error_log_message,
            extra={"agent_id": agent_id, "agent_emails": target_emails, "error": str(exc)},
        )
        return {
            "id": agent_id,
            "name": agent.name,
            "emails": target_emails,
            "status": "failed",
            "error": str(exc),
        }


def _send_cancellation_email(session, token: str, mailbox_user: str, agent, quotation) -> dict:
    """Send a single cancellation email to one agent. Never raises."""
    return _send_notification_email(
        session, token, mailbox_user, agent, quotation,
        subject=f"[CANCELADO] Cotacao {quotation.reference}",
        build_email=build_cancellation_email,
        error_log_message="Failed to send cancellation email to agent",
    )


def notify_agents_of_cancellation(session, quotation) -> list[dict]:
    """Notify every RFQ-targeted agent that the quotation was cancelled.

    Returns a per-agent result list ({id, name, emails, status}). Returns an
    empty list when there is no RFQ or no targeted agents, and a single-item
    error list when email is not configured or authentication fails — the caller
    treats notification as best-effort and never fails the cancel because of it.
    """
    rfq = rfq_repository.get_by_quotation(session, quotation.id)
    if not rfq or not (rfq.agents_targeted or []):
        return []

    agents = []
    for raw_id in rfq.agents_targeted:
        try:
            agent = freight_agent_repository.get(session, uuid.UUID(raw_id))
        except (ValueError, TypeError):
            continue
        if agent:
            agents.append(agent)

    if not agents:
        return []

    mailbox_user = os.environ.get("MS_GRAPH_MAILBOX_USER")
    if not mailbox_user:
        logger.error("MS_GRAPH_MAILBOX_USER env var not set")
        return [_notification_config_error(agent, "Email sender not configured") for agent in agents]

    try:
        token = get_access_token()
    except MicrosoftGraphError as exc:
        logger.exception("Failed to obtain Graph access token for cancellation")
        error = f"Email authentication failed: {exc}"
        return [_notification_config_error(agent, error) for agent in agents]

    return [
        _send_cancellation_email(session, token, mailbox_user, agent, quotation)
        for agent in agents
    ]


def _notification_config_error(agent, error: str) -> dict:
    """Shape a pre-send failure (missing mailbox config, auth failure) as a full
    NotificationResult so the frontend's status filter (which only recognizes
    'sent'/'failed') actually surfaces it instead of silently dropping it."""
    return {"id": str(agent.id), "name": agent.name, "emails": [], "status": "failed", "error": error}


def notify_agent_closing_cancelled(session, quotation, agent_id: uuid.UUID) -> Optional[dict]:
    """Notify the agent that had won a closing which was just reversed (FECHADA -> COTANDO).

    Best-effort — mirrors notify_agents_of_cancellation's failure handling so a
    broken mailbox config or Graph outage never blocks the reopen itself.
    Returns None when the agent cannot be resolved (nothing to notify).
    """
    agent = freight_agent_repository.get(session, agent_id)
    if not agent:
        return None

    mailbox_user = os.environ.get("MS_GRAPH_MAILBOX_USER")
    if not mailbox_user:
        logger.error("MS_GRAPH_MAILBOX_USER env var not set")
        return _notification_config_error(agent, "Email sender not configured")

    try:
        token = get_access_token()
    except MicrosoftGraphError as exc:
        logger.exception("Failed to obtain Graph access token for closing-cancelled notice")
        return _notification_config_error(agent, f"Email authentication failed: {exc}")

    return _send_notification_email(
        session, token, mailbox_user, agent, quotation,
        subject=f"[FECHAMENTO CANCELADO] Cotacao {quotation.reference}",
        build_email=build_closing_cancelled_email,
        error_log_message="Failed to send closing-cancelled email to agent",
    )
