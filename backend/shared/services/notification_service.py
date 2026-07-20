"""Operator notification helpers for internal Centrix events.

Provides lightweight, non-blocking notification dispatch for system events
that require human attention (e.g. a new proposal arriving from an agent).

All functions are designed to be called in a fire-and-forget pattern: callers
should catch any exception from these functions and log it without propagating,
so that a notification failure never aborts the primary business operation.

Environment variables consumed:
    SLACK_BOT_TOKEN      — Slack bot OAuth token (xoxb-...)
    SLACK_CHANNEL_ID     — Slack channel ID where notifications are posted
    APP_BASE_URL         — Frontend base URL for deep links (e.g. https://centrix.freitas.com.br)
"""

import datetime
import json
import os
import urllib.request

from sqlalchemy.orm import Session

from shared.database.repositories import slack_daily_thread_repository as thread_repo


def _post_slack_api(token: str, payload: dict) -> dict:
    """POST to chat.postMessage and return the parsed JSON response.

    Raises RuntimeError on HTTP errors or Slack API errors.
    """
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        "https://slack.com/api/chat.postMessage",
        data=data,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=5) as resp:
        body = json.loads(resp.read().decode("utf-8"))

    if not body.get("ok"):
        raise RuntimeError(f"Slack API error: {body.get('error', 'unknown')}")

    return body


def notify_operator_proposal_received(
    token: str,
    mailbox_user: str,
    quotation,
    agent_name: str,
    proposal_id: str,
    send_mail_fn,
    is_revision: bool = False,
    db_session: Session | None = None,
) -> None:
    """Notify the ops team that a proposal has been received or revised for a quotation.

    Dispatches both a Slack message (if bot token is configured) and an email
    to the ops mailbox. Both are best-effort: failures are raised for the caller
    to catch and log.

    Args:
        token: Microsoft Graph access token.
        mailbox_user: UPN of the sending/receiving mailbox.
        quotation: Quotation ORM instance.
        agent_name: Display name of the agent who submitted the proposal.
        proposal_id: UUID string of the new proposal.
        send_mail_fn: Callable matching microsoft_graph_service.send_mail signature.
        is_revision: True when the agent is resubmitting a revised proposal.
        db_session: Active SQLAlchemy session used to track daily Slack threads.
    """
    app_base_url = os.environ.get("APP_BASE_URL", "")
    quotation_url = f"{app_base_url}/cotacao/{quotation.id}" if app_base_url else ""

    _notify_slack(quotation, agent_name, quotation_url, is_revision=is_revision, db_session=db_session)
    _notify_email(token, mailbox_user, quotation, agent_name, quotation_url, send_mail_fn, is_revision=is_revision)


def _post_threaded_message(text: str, db_session: Session | None) -> None:
    """Post a message into today's daily ops thread (top-level if no thread available).

    No-op when Slack is not configured.
    """
    bot_token = os.environ.get("SLACK_BOT_TOKEN")
    channel_id = os.environ.get("SLACK_CHANNEL_ID")
    if not bot_token or not channel_id:
        return

    today = datetime.date.today()
    thread_ts = _get_or_create_daily_thread(bot_token, channel_id, today, db_session)

    payload: dict = {"channel": channel_id, "text": text}
    if thread_ts:
        payload["thread_ts"] = thread_ts

    _post_slack_api(bot_token, payload)


def _notify_slack(
    quotation,
    agent_name: str,
    quotation_url: str,
    is_revision: bool = False,
    db_session: Session | None = None,
) -> None:
    reference = quotation.reference or "—"
    link_text = f"<{quotation_url}|{reference}>" if quotation_url else reference

    if is_revision:
        text = (
            f":arrows_counterclockwise: Proposta revisada para {link_text} "
            f"— agente: *{agent_name}*"
        )
    else:
        text = (
            f":incoming_envelope: Nova proposta recebida para {link_text} "
            f"— agente: *{agent_name}*"
        )

    _post_threaded_message(text, db_session)


def _get_or_create_daily_thread(
    bot_token: str,
    channel_id: str,
    today: datetime.date,
    db_session: Session | None,
) -> str | None:
    """Return the thread_ts for today's daily thread, creating it if needed.

    Returns None if no DB session is available (falls back to top-level messages).
    """
    if db_session is None:
        return None

    thread_ts = thread_repo.get_thread_ts(db_session, today, channel_id)
    if thread_ts:
        return thread_ts

    formatted_date = today.strftime("%d/%m/%Y")
    parent_text = f":bell: Notificações de propostas — {formatted_date}"
    body = _post_slack_api(bot_token, {"channel": channel_id, "text": parent_text})

    thread_ts = body["ts"]
    thread_repo.save_thread_ts(db_session, today, channel_id, thread_ts)
    return thread_ts


def notify_operator_client_approved(
    token: str,
    mailbox_user: str,
    quotation_reference: str,
    quotation_url: str,
    agent_name: str,
    send_mail_fn,
    db_session: Session | None = None,
) -> None:
    """Notify the ops team that a client approved a proposal via the portal link.

    Does not auto-close the quotation — the analyst must confirm closure manually.
    Both Slack and email are best-effort; failures are raised for the caller to catch.
    """
    _notify_slack_client_approved(quotation_reference, quotation_url, agent_name, db_session=db_session)
    _notify_email_client_approved(token, mailbox_user, quotation_reference, quotation_url, agent_name, send_mail_fn)


def _notify_slack_client_approved(
    quotation_reference: str,
    quotation_url: str,
    agent_name: str,
    db_session: Session | None = None,
) -> None:
    link_text = f"<{quotation_url}|{quotation_reference}>" if quotation_url else quotation_reference
    text = f":white_check_mark: Cliente aprovou proposta — {link_text} — agente: *{agent_name}*"
    _post_threaded_message(text, db_session)


def _ops_table_rows_html(rows: list[tuple[str, str]]) -> str:
    """Render `<tr>` rows for the ops-notification table: row 0 shaded + 180px label."""
    parts = []
    for i, (label, value) in enumerate(rows):
        tr_style = ' style="background-color:#f5f5f5;"' if i % 2 == 0 else ""
        td_style = ' style="width:180px;"' if i == 0 else ""
        parts.append(
            f'    <tr{tr_style}>\n'
            f'      <td{td_style}><b>{label}</b></td>\n'
            f'      <td>{value}</td>\n'
            f'    </tr>'
        )
    return "\n".join(parts)


def _build_ops_email_html(intro_block_html: str, rows: list[tuple[str, str]], quotation_url: str) -> str:
    """Render the standard ops email: intro block + 2-col table + optional CTA + footer."""
    cta = (
        '<br><p><a href="' + quotation_url + '" style="display:inline-block;padding:8px 16px;'
        'background-color:#1d4ed8;color:#fff;text-decoration:none;border-radius:4px;">Ver cotacao</a></p>'
        if quotation_url else ''
    )
    return f"""
<html>
<body style="font-family: Arial, sans-serif; font-size: 14px; color: #333;">
  {intro_block_html}
  <table border="0" cellpadding="4" cellspacing="0"
         style="border-collapse: collapse; width: 100%; max-width: 500px;">
{_ops_table_rows_html(rows)}
  </table>
  {cta}
  <p style="color:#666;font-size:12px;">Centrix — Freitas COMEX</p>
</body>
</html>
"""


def _notify_email_client_approved(
    token: str,
    mailbox_user: str,
    quotation_reference: str,
    quotation_url: str,
    agent_name: str,
    send_mail_fn,
) -> None:
    link_html = (
        f'<a href="{quotation_url}">{quotation_reference}</a>'
        if quotation_url
        else quotation_reference
    )

    subject = f"[Centrix] Cliente aprovou cotacao — {quotation_reference}"
    rows = [("Cotacao", quotation_reference), ("Agente selecionado", agent_name)]

    intro_html = (
        f"<p>O cliente aprovou a proposta da cotacao <b>{link_html}</b>.</p>\n"
        f"  <p>Acesse o sistema para confirmar o fechamento.</p>"
    )

    send_mail_fn(
        token=token,
        sender_user_id=mailbox_user,
        to_addresses=[mailbox_user],
        subject=subject,
        body_html=_build_ops_email_html(intro_html, rows, quotation_url),
        reply_to=mailbox_user,
    )


def _notify_email(
    token: str,
    mailbox_user: str,
    quotation,
    agent_name: str,
    quotation_url: str,
    send_mail_fn,
    is_revision: bool = False,
) -> None:
    reference = quotation.reference or "—"
    link_html = (
        f'<a href="{quotation_url}">{reference}</a>'
        if quotation_url
        else reference
    )

    if is_revision:
        subject = f"[Centrix] Proposta revisada — {reference}"
        intro_html = f"Uma proposta revisada foi recebida para a cotacao <b>{link_html}</b>."
    else:
        subject = f"[Centrix] Nova proposta recebida — {reference}"
        intro_html = f"Uma nova proposta foi recebida para a cotacao <b>{link_html}</b>."

    rows = [("Cotacao", reference), ("Agente", agent_name)]

    send_mail_fn(
        token=token,
        sender_user_id=mailbox_user,
        to_addresses=[mailbox_user],
        subject=subject,
        body_html=_build_ops_email_html(f"<p>{intro_html}</p>", rows, quotation_url),
        reply_to=mailbox_user,
    )
