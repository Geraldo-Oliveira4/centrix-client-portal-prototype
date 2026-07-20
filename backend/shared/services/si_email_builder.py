"""Shipment Instruction email builder.

Replicates the KeeperQuotes SI email format with structured fields replacing
free-text flags. The legal notice is a fixed template that cannot be removed
(RN-05).
"""

from typing import Optional

from shared.domain.recommendation_service import (
    _resolve_negotiated_ptax,
    normalize_proposal_cost_to_brl,
)

_LEGAL_NOTICE = (
    "AVISO LEGAL: A Freitas Comex atua como intermediária na negociação "
    "e não se responsabiliza solidariamente por obrigações financeiras, "
    "tributárias ou aduaneiras decorrentes desta operação. "
    "As informações contidas neste documento são de responsabilidade "
    "exclusiva das partes envolvidas na transação comercial."
)


def build_si_subject(
    si_reference: str,
    quotation_reference: str,
    client_reference: Optional[str],
    origin: Optional[str],
    destination: Optional[str],
) -> str:
    """Build the SI email subject line matching the KeeperQuotes format."""
    ref_parts = [quotation_reference]
    if client_reference:
        ref_parts.append(client_reference)
    route = f"[{origin} x {destination}]" if origin and destination else ""
    ref_str = " - ".join(ref_parts)
    parts = [f"Instruções de embarque {si_reference}", f"Ref. {ref_str}"]
    if route:
        parts.append(route)
    return " - ".join(parts)


def _party_block(label: str, party: Optional[dict]) -> str:
    if not party:
        return f"<tr><td><strong>{label}:</strong></td><td><em>(não informado)</em></td></tr>"
    # Free-text mode: render the raw text as-is (newlines → <br>)
    if party.get("texto_livre"):
        content = party["texto_livre"].replace("\n", "<br>")
        return f"<tr><td valign='top'><strong>{label}:</strong></td><td>{content}</td></tr>"
    lines = []
    if party.get("nome"):
        lines.append(party["nome"])
    if party.get("cnpj"):
        lines.append(f"CNPJ: {party['cnpj']}")
    if party.get("endereco"):
        lines.append(party["endereco"])
    if party.get("pic"):
        lines.append(f"Contato: {party['pic']}")
    if party.get("tel"):
        lines.append(f"Tel: {party['tel']}")
    if party.get("email"):
        lines.append(f"E-mail: {party['email']}")
    return f"<tr><td valign='top'><strong>{label}:</strong></td><td>{'<br>'.join(lines)}</td></tr>"


def _build_flag_lines(si) -> list:
    """Return structured flag lines shared by both HTML and plain-text builders."""
    lines = []
    if si.ptax_tipo == "negociado" and si.ptax_valor:
        lines.append(f"PTAX: {si.ptax_valor} (negociado)")
    else:
        lines.append("PTAX: padrão")
    lines.append("Seguro: incluir" if si.incluir_seguro else "Seguro: não incluir")
    if si.solicitar_agente_origem:
        lines.append(
            "SOLICITAR DADOS DO AGENTE DE ORIGEM: Por favor, informar o agente local "
            "que realizará a coleta junto ao exportador."
        )
    if si.prontidao_prevista:
        lines.append(f"Prontidão prevista da carga: {si.prontidao_prevista.strftime('%d/%m/%Y')}")
    return lines


def _flags_text(si) -> str:
    return "<br>".join(_build_flag_lines(si))


def _yes_no(value) -> str:
    if value is True:
        return "Sim"
    if value is False:
        return "Não"
    return "—"


def _cargo_rows(quotation) -> str:
    """Build HTML table rows for cargo details derived from the quotation."""
    rows = []
    origin = (
        getattr(quotation, "porto_embarque", None)
        or getattr(quotation, "aeroporto_embarque", None)
    )
    if origin:
        rows.append(f"<tr><td><strong>Local de coleta:</strong></td><td>{origin}</td></tr>")

    destinos = (
        getattr(quotation, "porto_destino", None)
        or getattr(quotation, "aeroporto_destino", None)
    )
    if destinos:
        dest_str = ", ".join(destinos) if isinstance(destinos, list) else str(destinos)
        rows.append(f"<tr><td><strong>Destino:</strong></td><td>{dest_str}</td></tr>")

    stackability = getattr(quotation, "stackability", None)
    if stackability is not None:
        rows.append(f"<tr><td><strong>Empilhável:</strong></td><td>{_yes_no(stackability)}</td></tr>")

    tombavel = getattr(quotation, "carga_tombavel", None)
    if tombavel is not None:
        rows.append(f"<tr><td><strong>Tombável:</strong></td><td>{_yes_no(tombavel)}</td></tr>")

    declared_value = getattr(quotation, "declared_value", None)
    declared_currency = getattr(quotation, "declared_value_currency", None)
    if declared_value is not None:
        currency_str = declared_currency.value if declared_currency else ""
        rows.append(
            f"<tr><td><strong>Valor da carga:</strong></td>"
            f"<td>{currency_str} {float(declared_value):,.2f}</td></tr>"
        )

    return "\n".join(rows)


def build_si_body_html(
    si,
    quotation,
    proposal,
    agent_name: str,
) -> str:
    """Build the full HTML body for a Shipment Instruction email."""
    incoterm_display = si.incoterm_aprovado or si.incoterm_cotado or ""
    incoterm_alert = ""
    if (
        si.incoterm_cotado
        and si.incoterm_aprovado
        and si.incoterm_cotado.upper() != si.incoterm_aprovado.upper()
    ):
        incoterm_alert = (
            f"<p style='color:#c0392b;font-weight:bold'>"
            f"ATENÇÃO: Incoterm alterado de {si.incoterm_cotado} (cotado) "
            f"para {si.incoterm_aprovado} (aprovado pelo cliente).</p>"
        )

    instrucoes_block = ""
    if si.instrucoes_livres:
        instrucoes_block = (
            f"<p style='font-weight:bold;text-transform:uppercase'>"
            f"{si.instrucoes_livres}</p><hr>"
        )

    flags_text = _flags_text(si)
    cargo_rows = _cargo_rows(quotation)

    # total_value is in the proposal's freight_currency (USD by default), so it
    # must be normalized to BRL at the quotation's negotiated PTAX (when set) or
    # the proposal's own PTAX before labeling it "BRL".
    # Previously total_value was shown verbatim under a "BRL" label, mislabeling a
    # USD amount as Reais in an outgoing Shipment Instruction email.
    ptax_override = _resolve_negotiated_ptax(quotation)
    total_brl = (
        normalize_proposal_cost_to_brl(proposal, ptax_override=ptax_override)
        if proposal is not None
        else None
    )
    total_brl_str = f"BRL {total_brl:,.2f}" if total_brl else "—"
    transit_time = getattr(proposal, "transit_time", None)
    transit_str = f"{transit_time} dias" if transit_time else "—"
    validity = getattr(proposal, "validity", None)
    validity_str = validity.strftime("%d/%m/%Y") if validity else "—"
    carrier = getattr(proposal, "carrier", None) or "—"
    modal = getattr(quotation, "modal", None)
    modal_str = modal.value if modal else "—"
    service_type = getattr(quotation, "service_type", None)
    direction_str = service_type.value if service_type else "—"

    return f"""
<html>
<body style="font-family:Arial,sans-serif;font-size:14px;color:#222">
  {instrucoes_block}
  {incoterm_alert}

  <h3 style="color:#1a3c6e">Instrução de Embarque — {si.reference}</h3>
  <p>Referência: <strong>{quotation.reference}</strong></p>

  <h4>Partes</h4>
  <table cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%">
    {_party_block("Exportador", si.exportador)}
    {_party_block("Consignatário", si.consignatario)}
    {_party_block("Notificado", si.notificado)}
  </table>

  <h4>Dados do Embarque</h4>
  <table cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%">
    <tr><td><strong>Modal:</strong></td><td>{modal_str}</td></tr>
    <tr><td><strong>Direção:</strong></td><td>{direction_str}</td></tr>
    <tr><td><strong>Incoterm:</strong></td><td>{incoterm_display}</td></tr>
    {cargo_rows}
  </table>

  <h4>Cotação Aprovada</h4>
  <table cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%">
    <tr><td><strong>Agente:</strong></td><td>{agent_name}</td></tr>
    <tr><td><strong>Armador:</strong></td><td>{carrier}</td></tr>
    <tr><td><strong>Validade:</strong></td><td>{validity_str}</td></tr>
    <tr><td><strong>Transit time:</strong></td><td>{transit_str}</td></tr>
    <tr><td><strong>Total:</strong></td><td>{total_brl_str}</td></tr>
  </table>

  <h4>Instruções Adicionais</h4>
  <p>{flags_text}</p>

  <hr>
  <p style="font-size:12px;color:#555">{_LEGAL_NOTICE}</p>

  <p>Atenciosamente,<br>
  <strong>Setor de Logística Internacional — Freitas Comex</strong></p>
</body>
</html>
"""


def get_si_recipient_emails(session, agent, quotation) -> list[str]:
    """Return the TO addresses for the SI — the winning agent's contact emails.

    Delegates to rfq_email_builder which prefers modal/service-type-specific
    contacts and falls back to the agent's primary email.
    """
    # Deferred import: top-level import creates a circular dependency with rfq_email_builder.
    from shared.services.rfq_email_builder import get_rfq_target_emails
    return get_rfq_target_emails(session, agent, quotation)
