"""Shared email composition logic for RFQ dispatch flows.

Used by dispatch_rfq and add_rfq_agents.
"""

import dataclasses
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from zoneinfo import ZoneInfo

from shared.database.repositories import freight_agent_contact_repository
from shared.domain.currency_utils import apply_ptax_markup, parse_negotiated_ptax_percent
from shared.observability import logger
from shared.services import bacen_ptax_service
from shared.services.microsoft_graph_service import MicrosoftGraphError, send_mail

@dataclasses.dataclass(slots=True)
class RFQEmailContext:
    """All pre-formatted display values needed to render an RFQ email.

    Computed once in build_rfq_body and passed to _build_html_body,
    eliminating the 29-parameter signature that function previously had.
    Future agente_define_* fields only require a change in build_rfq_body
    (where origin_display/embarque_display are derived) — the builder
    signature stays unchanged.
    """
    agent_name: str
    portal_link: str
    reference: str
    modal: str
    tipo_embarque: str
    tipo_cotacao: str
    data_cotacao: str
    deadline: str
    client_ref: str
    service_type: str
    price_or_performance: str
    incoterm: str
    origin_display: str
    embarque_display: str
    destination: str
    incluir_entrega: str
    incluir_entrega_flag: bool
    endereco_entrega: str
    mercadoria: str
    carga_perigosa: str
    temperatura: str
    insurance: str
    declared: str
    stackable: str
    tiltable: str
    is_air: bool
    dest_yard: str
    ptax: str
    ncm: str
    observations: str
    extra_lines_html: str
    cargo_section_html: str


# Graph mailbox concurrency limit — keep at 2 to avoid MailboxConcurrency throttle.
_MAX_RFQ_DISPATCH_WORKERS = 2
_MAX_RETRIES = 3
_BASE_RETRY_DELAY_SECONDS = 2
_GRAPH_RATE_LIMIT_DELAY_SECONDS = 0.5

_BRT = ZoneInfo("America/Sao_Paulo")
# Format used in all user-visible datetime strings in emails (BRT local time).
_DISPLAY_DATETIME_FMT = "%Y-%m-%d %H:%M"


def _fmt_date(value) -> str:
    return value.strftime("%Y-%m-%d") if value else "N/A"


def _fmt_datetime(value) -> str:
    if not value:
        return "N/A"
    return value.astimezone(_BRT).strftime(_DISPLAY_DATETIME_FMT)


def _format_ptax_negociada(quotation) -> str:
    """Format ptax_negociada for display, appending the effective rate when available.

    Example outputs: "N/A", "1%", "1% (USD 5.1183)".
    """
    raw = getattr(quotation, "ptax_negociada", None)
    if not raw:
        return "N/A"

    percent = parse_negotiated_ptax_percent(raw)
    if percent is None:
        return raw

    daily = bacen_ptax_service.get_daily_ptax("USD")
    if daily is None:
        return raw

    effective = apply_ptax_markup(daily, percent)
    return f"{raw} (USD {effective:.4f})"


def _format_quotation_summary(quotation) -> tuple[str, str, str]:
    """Return (modal, origin, destination) as display strings.

    Single source of truth for the three fields that appear in every
    outbound RFQ email variant (initial dispatch, update, cancellation, etc.).
    """
    modal = quotation.modal.value if quotation.modal else "N/A"
    origin = quotation.origin or "N/A"
    destination = (
        ", ".join(quotation.porto_destino)
        if quotation.porto_destino
        else ", ".join(quotation.aeroporto_destino)
        if quotation.aeroporto_destino
        else "N/A"
    )
    return modal, origin, destination


def _summary_table_html(
    reference: str,
    modal: str,
    origin: str,
    destination: str,
    *,
    reference_label: str = "Referência",
    extra_rows_html: str = "",
) -> str:
    """Render the Referência/Modal/Origem/Destino summary table shared by outbound RFQ emails.

    `reference_label` varies by template (accented "Referência" vs plain "Referencia").
    `extra_rows_html` is appended right after the Destino row (winner detail rows,
    cancellation has none, reminder appends the deadline, etc.).
    """
    return f"""  <table border="0" cellpadding="4" cellspacing="0"
         style="border-collapse: collapse; width: 100%; max-width: 600px;">
    <tr style="background-color:#f5f5f5;">
      <td style="width:200px;"><b>{reference_label}</b></td>
      <td>{reference}</td>
    </tr>
    <tr>
      <td><b>Modal</b></td>
      <td>{modal}</td>
    </tr>
    <tr style="background-color:#f5f5f5;">
      <td><b>Origem</b></td>
      <td>{origin}</td>
    </tr>
    <tr>
      <td><b>Destino</b></td>
      <td>{destination}</td>
    </tr>{extra_rows_html}
  </table>"""


_CONTAINER_LABELS: dict[str, str] = {
    "STANDARD_20": "20' Standard",
    "STANDARD_40": "40' Standard",
    "HIGH_CUBE_40": "40' High Cube",
    "NOR_40": "40' NOR",
    "HARDTOP_20": "20' Hard Top",
    "HARDTOP_40": "40' Hard Top",
    "HARDTOP_HIGH_CUBE_40": "40' Hard Top High Cube",
    "OPEN_TOP_20": "20' Open Top",
    "OPEN_TOP_40": "40' Open Top",
    "OPEN_TOP_HIGH_CUBE_40": "40' Open Top High Cube",
    "FLATRACK_20": "20' Flat Rack",
    "FLATRACK_40": "40' Flat Rack",
    "PLATFORM_20": "20' Platform",
    "PLATFORM_40": "40' Platform",
    "REFRIGERATED_20": "20' Refrigerated",
    "REFRIGERATED_40": "40' Refrigerated",
    "BULK_20": "20' Bulk",
    "TANK_20": "20' Tank",
}


def build_rfq_subject(quotation, rfq) -> str:
    modal, origin, destination = _format_quotation_summary(quotation)
    return f"[RFQ] {quotation.reference} — {origin} → {destination} | {modal}"


def build_rfq_body(
    agent_name: str,
    quotation,
    rfq,
    portal_link: str,
    equipments: list | None = None,
    volumes: list | None = None,
) -> str:
    """Return html_body for the given agent."""
    modal, origin, destination = _format_quotation_summary(quotation)
    is_air = quotation.modal and quotation.modal.value == "AEREO"
    is_maritime = quotation.modal and quotation.modal.value == "MARITIMO"

    tipo_cotacao_value = getattr(quotation, "tipo_cotacao", None)
    tipo_cotacao = tipo_cotacao_value.value if tipo_cotacao_value else "N/A"
    service_type_value = getattr(quotation, "service_type", None)
    service_type = service_type_value.value if service_type_value else "N/A"
    data_cotacao_value = getattr(quotation, "data_cotacao", None)
    data_cotacao = _fmt_date(data_cotacao_value)
    deadline = _fmt_datetime(quotation.desired_deadline)
    client_ref = getattr(quotation, "client_reference", None) or "N/A"
    price_or_performance = _format_price_or_performance(quotation)

    embarque = "N/A"
    if is_air and getattr(quotation, "aeroporto_embarque", None):
        embarque = quotation.aeroporto_embarque
    elif is_maritime and getattr(quotation, "porto_embarque", None):
        embarque = quotation.porto_embarque

    incluir_entrega = _bool_label(getattr(quotation, "incluir_entrega_destino_final", None))
    endereco_entrega = getattr(quotation, "endereco_entrega_final", None) or "N/A"

    carga_perigosa = _format_carga_perigosa(quotation)
    temperatura = _format_temperatura(quotation)
    insurance = _bool_label(getattr(rfq, "include_insurance", None))

    declared_currency = (
        quotation.declared_value_currency.value
        if quotation.declared_value_currency
        else "USD"
    )
    declared = (
        f"{declared_currency} {float(quotation.declared_value):,.2f}"
        if quotation.declared_value
        else "N/A"
    )

    stackable = _bool_label(getattr(quotation, "stackability", None))
    tiltable = _bool_label(getattr(quotation, "carga_tombavel", None))

    tipo_embarque = ""
    tipo_embarque_value = getattr(quotation, "tipo_embarque", None)
    if is_maritime and tipo_embarque_value:
        tipo_embarque = tipo_embarque_value.value

    # destination_yard is a quotation-level field edited by the analyst on the
    # quotation (the RFQ form never exposes it; rfq.destination_yard is only a
    # snapshot taken at RFQ creation). The quotation is therefore the source of
    # truth: when the analyst clears it on the quotation, the email must drop it,
    # even though the RFQ snapshot still holds the old value. An empty value means
    # the field was removed on purpose, so the row is omitted entirely.
    dest_yard = (quotation.destination_yard or "").strip()
    ptax = _format_ptax_negociada(quotation)

    # NCM is required and shown only for DDP (customs declaration owned by
    # the shipper) — mirrors the showNcm visibility rule in
    # frontend/utils/quotation-fields.ts and the hard block in rfq_validation.py.
    ncm = (getattr(quotation, "ncm", None) or "N/A") if quotation.incoterm == "DDP" else ""

    agente_define_local_coleta = getattr(quotation, "agente_define_local_coleta", None)
    agente_define_aeroporto_embarque = getattr(quotation, "agente_define_aeroporto_embarque", None)
    agente_define_porto_embarque = getattr(quotation, "agente_define_porto_embarque", None)

    extra_lines_html = ""
    for key, value in (rfq.template_data or {}).items():
        if value not in (None, ""):
            label = key.replace("_", " ").title()
            extra_lines_html += f"<tr><td><b>{label}</b></td><td>{value}</td></tr>\n"

    cargo_section_html = build_rfq_cargo_section(
        [] if is_air else (equipments or []), volumes or []
    )

    ctx = RFQEmailContext(
        agent_name=agent_name,
        portal_link=portal_link,
        reference=quotation.reference,
        modal=modal,
        tipo_embarque=tipo_embarque,
        tipo_cotacao=tipo_cotacao,
        data_cotacao=data_cotacao,
        deadline=deadline,
        client_ref=client_ref,
        service_type=service_type,
        price_or_performance=price_or_performance,
        incoterm=quotation.incoterm or "N/A",
        origin_display=_format_origin_display(quotation.origin, agente_define_local_coleta),
        embarque_display=_format_embarque_display(embarque, agente_define_aeroporto_embarque, agente_define_porto_embarque),
        destination=destination,
        incluir_entrega=incluir_entrega,
        incluir_entrega_flag=bool(getattr(quotation, "incluir_entrega_destino_final", False)),
        endereco_entrega=endereco_entrega,
        mercadoria=quotation.product or "N/A",
        carga_perigosa=carga_perigosa,
        temperatura=temperatura,
        insurance=insurance,
        declared=declared,
        stackable=stackable,
        tiltable=tiltable,
        is_air=is_air,
        dest_yard=dest_yard,
        ptax=ptax,
        ncm=ncm,
        observations=quotation.observations or "N/A",
        extra_lines_html=extra_lines_html,
        cargo_section_html=cargo_section_html,
    )

    return _build_html_body(ctx)


def _format_price_or_performance(quotation) -> str:
    value = getattr(quotation, "price_or_performance", None)
    if not value:
        return ""
    return "Preço" if value.value == "PRECO" else "Performance"


def _format_carga_perigosa(quotation) -> str:
    carga_perigosa_value = getattr(quotation, "carga_perigosa", None)
    if not carga_perigosa_value or carga_perigosa_value.value == "NAO":
        return ""

    result = carga_perigosa_value.value
    un_number = getattr(quotation, "un_number", None)
    if un_number:
        result += f" (UN: {un_number})"
    imo_class = getattr(quotation, "imo_class", None)
    if imo_class:
        result += f" (IMO: {imo_class})"
    return result


def _format_temperatura(quotation) -> str:
    temperatura_min = getattr(quotation, "temperatura_min", None)
    temperatura_max = getattr(quotation, "temperatura_max", None)

    if temperatura_min is None and temperatura_max is None:
        return ""

    temp_parts = []
    if temperatura_min is not None:
        temp_parts.append(f"min {float(temperatura_min):.1f}°C")
    if temperatura_max is not None:
        temp_parts.append(f"max {float(temperatura_max):.1f}°C")
    return " / ".join(temp_parts)


def _format_origin_display(origin: str | None, agente_define_local_coleta: bool | None) -> str:
    if origin:
        return origin
    if agente_define_local_coleta:
        return "A definir pelo agente"
    return "N/A"


def _format_embarque_display(
    embarque: str,
    agente_define_aeroporto_embarque: bool | None,
    agente_define_porto_embarque: bool | None,
) -> str:
    if embarque and embarque != "N/A":
        return embarque
    if agente_define_aeroporto_embarque or agente_define_porto_embarque:
        return "A definir pelo agente"
    return embarque


def _build_html_body(ctx: RFQEmailContext) -> str:
    html_rows = f"""
    <tr style="background-color:#f5f5f5;">
      <td style="width:200px;"><b>Referência</b></td>
      <td>{ctx.reference}</td>
    </tr>
    <tr>
      <td><b>Modal</b></td>
      <td>{ctx.modal}</td>
    </tr>
"""

    if ctx.tipo_embarque:
        html_rows += f"""
    <tr style="background-color:#f5f5f5;">
      <td><b>Tipo de Embarque</b></td>
      <td>{ctx.tipo_embarque}</td>
    </tr>
"""

    html_rows += f"""
    <tr style="background-color:#f5f5f5;">
      <td><b>Tipo de Cotação</b></td>
      <td>{ctx.tipo_cotacao}</td>
    </tr>
    <tr>
      <td><b>Data da Cotação</b></td>
      <td>{ctx.data_cotacao}</td>
    </tr>
    <tr style="background-color:#f5f5f5;">
      <td><b>Prazo de Retorno</b></td>
      <td>{ctx.deadline}</td>
    </tr>
    <tr>
      <td><b>Ref. Cliente</b></td>
      <td>{ctx.client_ref}</td>
    </tr>
    <tr style="background-color:#f5f5f5;">
      <td><b>Direção</b></td>
      <td>{ctx.service_type}</td>
    </tr>
"""

    if ctx.price_or_performance:
        html_rows += f"""
    <tr>
      <td><b>Critério de Escolha</b></td>
      <td>{ctx.price_or_performance}</td>
    </tr>
"""

    html_rows += f"""
    <tr style="background-color:#f5f5f5;">
      <td><b>Incoterm</b></td>
      <td>{ctx.incoterm}</td>
    </tr>
    <tr style="background-color:#f5f5f5;">
      <td><b>Origem</b></td>
      <td>{ctx.origin_display}</td>
    </tr>
    <tr>
      <td><b>Embarque</b></td>
      <td>{ctx.embarque_display}</td>
    </tr>
    <tr style="background-color:#f5f5f5;">
      <td><b>Destino</b></td>
      <td>{ctx.destination}</td>
    </tr>
    <tr>
      <td><b>Entrega Final</b></td>
      <td>{ctx.incluir_entrega}</td>
    </tr>
"""

    if ctx.incluir_entrega_flag:
        html_rows += f"""
    <tr style="background-color:#f5f5f5;">
      <td><b>Local de Entrega</b></td>
      <td>{ctx.endereco_entrega}</td>
    </tr>
"""

    html_rows += f"""
    <tr>
      <td><b>Mercadoria</b></td>
      <td>{ctx.mercadoria}</td>
    </tr>
"""

    if ctx.carga_perigosa:
        html_rows += f"""
    <tr style="background-color:#f5f5f5;">
      <td><b>Carga Perigosa</b></td>
      <td>{ctx.carga_perigosa}</td>
    </tr>
"""

    if ctx.temperatura:
        html_rows += f"""
    <tr>
      <td><b>Temperatura</b></td>
      <td>{ctx.temperatura}</td>
    </tr>
"""

    html_rows += f"""
    <tr style="background-color:#f5f5f5;">
      <td><b>Seguro</b></td>
      <td>{ctx.insurance}</td>
    </tr>
    <tr>
      <td><b>Valor Declarado</b></td>
      <td>{ctx.declared}</td>
    </tr>
    <tr style="background-color:#f5f5f5;">
      <td><b>Empilhável</b></td>
      <td>{ctx.stackable}</td>
    </tr>
    <tr>
      <td><b>Tombável</b></td>
      <td>{ctx.tiltable}</td>
    </tr>
"""

    if not ctx.is_air and ctx.dest_yard:
        html_rows += f"""
    <tr style="background-color:#f5f5f5;">
      <td><b>Recinto de Destino</b></td>
      <td>{ctx.dest_yard}</td>
    </tr>
"""

    html_rows += f"""
    <tr>
      <td><b>PTAX Negociada</b></td>
      <td>{ctx.ptax}</td>
    </tr>
"""

    if ctx.ncm:
        html_rows += f"""
    <tr style="background-color:#f5f5f5;">
      <td><b>NCM</b></td>
      <td>{ctx.ncm}</td>
    </tr>
"""

    html_rows += ctx.extra_lines_html

    obs_html = (
        f"<p><b>Observações:</b><br>"
        f"<span style=\"white-space:pre-wrap;\">{ctx.observations}</span></p>"
        if ctx.observations != "N/A"
        else ""
    )

    return f"""
<html>
<body style="font-family: Arial, sans-serif; font-size: 14px; color: #333;">
  <p>Prezado(a) <b>{ctx.agent_name}</b>,</p>
  <p>Solicitamos cotação de frete internacional conforme abaixo:</p>
  {obs_html}
  <table border="0" cellpadding="4" cellspacing="0"
         style="border-collapse: collapse; width: 100%; max-width: 600px;">
{html_rows}
  </table>
  {ctx.cargo_section_html}
  <br>
  <p>
    <a href="{ctx.portal_link}"
       style="display:inline-block;padding:10px 20px;background-color:#1d4ed8;color:#ffffff;
              text-decoration:none;border-radius:4px;font-weight:bold;">
      Enviar proposta pelo portal
    </a>
  </p>
  <p style="font-size:12px;color:#666;">
    Ou copie o link: {ctx.portal_link}
  </p>
  <p>Atenciosamente,<br><b>Equipe Freitas COMEX</b></p>
</body>
</html>
"""


def _aggregate_volume_totals(volumes: list) -> tuple[int, dict[str, float], float]:
    """Return (total_qty, peso_by_unit, total_m3) across all volumes.

    peso_bruto and volume_m3 are stored as line totals (not per-unit) and summed directly.
    Counterpart: frontend/utils/quotation-fields.ts::summarizeVolumes (source of truth).
    Both must stay in sync when the aggregation rule changes.
    """
    total_qty: int = 0
    peso_by_unit: dict[str, float] = {}
    total_m3: float = 0.0
    for v in volumes:
        total_qty += int(v.quantity)
        if v.peso_bruto and v.peso_unidade:
            unit = v.peso_unidade.value
            peso_by_unit[unit] = peso_by_unit.get(unit, 0.0) + float(v.peso_bruto)
        if v.volume_m3:
            total_m3 += float(v.volume_m3)
    return total_qty, peso_by_unit, total_m3


def build_rfq_cargo_section(equipments: list, volumes: list) -> str:
    if not equipments and not volumes:
        return ""

    html = '<br><p><b>Dados da Carga:</b></p>'

    # Pre-aggregate once; reused as equipment fallback and volumes totals row.
    total_qty, peso_by_unit, total_m3 = _aggregate_volume_totals(volumes)

    if equipments:
        html += (
            '<table border="0" cellpadding="4" cellspacing="0"'
            ' style="border-collapse:collapse;width:100%;max-width:600px;margin-bottom:8px;">'
            '<tr style="background-color:#e8edf5;">'
            '<th style="text-align:left;">Container</th>'
            '<th style="text-align:left;">Qtd</th>'
            '<th style="text-align:left;">Peso Bruto</th>'
            '<th style="text-align:left;">Volume (m³)</th>'
            "</tr>"
        )
        for i, eq in enumerate(equipments):
            container = _CONTAINER_LABELS.get(eq.tipo_container.value, eq.tipo_container.value)
            if eq.peso_bruto:
                peso = f"{float(eq.peso_bruto):,.3f} {eq.peso_unidade.value}"
            elif peso_by_unit:
                peso = " + ".join(
                    f"{total:,.3f} {unit}" for unit, total in peso_by_unit.items()
                )
            else:
                peso = "N/A"
            if eq.volume_m3:
                volume = f"{float(eq.volume_m3):,.3f}"
            elif total_m3 > 0:
                volume = f"{total_m3:,.3f}"
            else:
                volume = "N/A"
            bg = 'background-color:#f5f5f5;' if i % 2 else ''
            html += (
                f'<tr style="{bg}">'
                f"<td>{container}</td>"
                f"<td>{eq.quantity}</td>"
                f"<td>{peso}</td>"
                f"<td>{volume}</td>"
                f"</tr>"
            )
        html += "</table>"

    if volumes:
        html += (
            '<table border="0" cellpadding="4" cellspacing="0"'
            ' style="border-collapse:collapse;width:100%;max-width:600px;margin-bottom:8px;">'
            '<tr style="background-color:#e8edf5;">'
            '<th style="text-align:left;">Embalagem</th>'
            '<th style="text-align:left;">Qtd</th>'
            '<th style="text-align:left;">Peso Bruto</th>'
            '<th style="text-align:left;">Dimensões (C×L×A)</th>'
            '<th style="text-align:left;">Volume (m³)</th>'
            "</tr>"
        )
        total_peso_str = (
            " + ".join(f"{t:,.3f} {u}" for u, t in peso_by_unit.items())
            if peso_by_unit
            else "N/A"
        )
        total_volume_str = f"{total_m3:,.3f}" if total_m3 > 0 else "N/A"
        for i, vol in enumerate(volumes):
            emb = vol.embalagem.value.replace("_", " ").title() if vol.embalagem else "N/A"
            peso = f"{float(vol.peso_bruto):,.3f} {vol.peso_unidade.value}" if vol.peso_bruto else "N/A"
            dim_parts = [vol.comprimento, vol.largura, vol.altura]
            if all(d is not None for d in dim_parts):
                dims = (
                    f"{float(vol.comprimento):.3f}×{float(vol.largura):.3f}"
                    f"×{float(vol.altura):.3f} {vol.dimensao_unidade.value}"
                )
            else:
                dims = "N/A"
            volume_m3 = f"{float(vol.volume_m3):,.3f}" if vol.volume_m3 else "N/A"
            bg = 'background-color:#f5f5f5;' if i % 2 else ''
            html += (
                f'<tr style="{bg}">'
                f"<td>{emb}</td>"
                f"<td>{vol.quantity}</td>"
                f"<td>{peso}</td>"
                f"<td>{dims}</td>"
                f"<td>{volume_m3}</td>"
                f"</tr>"
            )
        html += (
            '<tr style="background-color:#dfe7f3;font-weight:bold;">'
            "<td>Total</td>"
            f"<td>{total_qty}</td>"
            f"<td>{total_peso_str}</td>"
            "<td>—</td>"
            f"<td>{total_volume_str}</td>"
            "</tr>"
        )
        html += "</table>"

    return html


def get_rfq_target_emails(session, agent, quotation) -> list[str]:
    """Resolve the target email addresses for an agent on a given quotation.

    Prefers modal/service-type-specific contacts, falls back to the agent's
    primary email. Never falls back to a contact tagged for a different modal,
    which would route maritime quotations to air contacts (or vice versa).
    """
    modal = quotation.modal.value if quotation.modal else None
    service_type = quotation.service_type.value if quotation.service_type else None

    if modal and service_type:
        emails = freight_agent_contact_repository.get_emails_for_quotation(
            session, agent.id, modal, service_type
        )
        if emails:
            return emails

    return [agent.email]


def build_rfq_update_notification_email(
    agent_name: str,
    quotation,
    portal_link: str,
    custom_message: str | None = None,
    changed_fields: list[str] | None = None,
) -> str:
    """Return html_body notifying an agent that the RFQ data was updated.

    Args:
        agent_name: Display name of the freight agent.
        quotation: Quotation ORM object.
        portal_link: Full URL to the agent portal for this RFQ.
        custom_message: Optional free-text note from the analyst.
        changed_fields: Sorted list of human-readable field labels that were
            updated since the last notification. Empty list or None means no
            field breakdown is shown.
    """
    modal, origin, destination = _format_quotation_summary(quotation)
    deadline = _fmt_datetime(quotation.desired_deadline)
    incluir_entrega_flag = bool(getattr(quotation, "incluir_entrega_destino_final", False))
    endereco_entrega = getattr(quotation, "endereco_entrega_final", None) or "N/A"

    note_html = (
        f"<p><b>Observação do analista:</b><br>{custom_message}</p>"
        if custom_message
        else ""
    )

    # Changed fields section
    if changed_fields:
        fields_html = (
            "<p><b>Campos alterados:</b></p>"
            "<ul style='margin:4px 0 12px 0;padding-left:20px;'>"
            + "".join(f"<li>{f}</li>" for f in changed_fields)
            + "</ul>"
        )
    else:
        fields_html = ""

    prazo_row = f"""
    <tr>
      <td><b>Prazo de Retorno</b></td>
      <td><b style="color:#dc2626;">{deadline}</b></td>
    </tr>"""

    entrega_row = (
        f"""
    <tr style="background-color:#f5f5f5;">
      <td><b>Local de Entrega</b></td>
      <td>{endereco_entrega}</td>
    </tr>"""
        if incluir_entrega_flag
        else ""
    )

    html_body = f"""
<html>
<body style="font-family: Arial, sans-serif; font-size: 14px; color: #333;">
  <p>Prezado(a) <b>{agent_name}</b>,</p>
  <p>Os dados da cotação <b>{quotation.reference}</b> foram <b>atualizados</b>.
  Por favor, acesse o portal para verificar as informações atualizadas antes de enviar sua proposta.</p>
  {fields_html}
  {note_html}
{_summary_table_html(quotation.reference, modal, origin, destination, extra_rows_html=prazo_row + entrega_row)}
  <br>
  <p>
    <a href="{portal_link}"
       style="display:inline-block;padding:10px 20px;background-color:#1d4ed8;color:#ffffff;
              text-decoration:none;border-radius:4px;font-weight:bold;">
      Acessar portal
    </a>
  </p>
  <p style="font-size:12px;color:#666;">Ou copie o link: {portal_link}</p>
  <p>Atenciosamente,<br><b>Equipe Freitas COMEX</b></p>
</body>
</html>
"""
    return html_body


def build_cancellation_email(
    agent_name: str, quotation
) -> str:
    modal, origin, destination = _format_quotation_summary(quotation)

    html_body = f"""
<html>
<body style="font-family: Arial, sans-serif; font-size: 14px; color: #333;">
  <p>Prezado(a) <b>{agent_name}</b>,</p>
  <p>Informamos que a cotacao <b>{quotation.reference}</b> foi <b style="color: #dc2626;">CANCELADA</b>.</p>
{_summary_table_html(quotation.reference, modal, origin, destination, reference_label="Referencia")}
  <br>
  <p>Nao e necessario enviar proposta para esta cotacao.</p>
  <p>Atenciosamente,<br><b>Equipe Freitas COMEX</b></p>
</body>
</html>
"""
    return html_body


def build_closing_cancelled_email(agent_name: str, quotation) -> str:
    """Notify the previously winning agent that a closing was reversed.

    Sent when an analyst reopens a FECHADA quotation (COTANDO) to pick a
    different agent — the agent that had been selected needs to know the
    closing is no longer valid before they act on it.
    """
    modal, origin, destination = _format_quotation_summary(quotation)

    html_body = f"""
<html>
<body style="font-family: Arial, sans-serif; font-size: 14px; color: #333;">
  <p>Prezado(a) <b>{agent_name}</b>,</p>
  <p>Informamos que o fechamento da cotacao <b>{quotation.reference}</b>, anteriormente
  confirmado com sua empresa, foi <b style="color: #dc2626;">CANCELADO</b>.</p>
{_summary_table_html(quotation.reference, modal, origin, destination, reference_label="Referencia")}
  <br>
  <p>A cotacao voltou para fase de analise e pode ser fechada com outro agente.
  Nenhuma acao e necessaria da sua parte neste momento.</p>
  <p>Atenciosamente,<br><b>Equipe Freitas COMEX</b></p>
</body>
</html>
"""
    return html_body


def build_not_selected_email(
    agent_name: str,
    quotation,
    custom_message: str | None = None,
    winning_value: float | None = None,
    winning_currency: str = "USD",
) -> str:
    """Return html_body for an agent not selected as winner."""
    modal, origin, destination = _format_quotation_summary(quotation)

    message = custom_message or (
        "Informamos que a proposta enviada para esta cotação não foi selecionada. "
        "Agradecemos sua participação e contamos com sua parceria em futuras oportunidades."
    )

    winning_value_str = f"{winning_currency} {winning_value:,.2f}" if winning_value is not None else None

    winning_value_row = (
        f"""
    <tr>
      <td><b>Valor Fechado</b></td>
      <td>{winning_value_str}</td>
    </tr>"""
        if winning_value_str else ""
    )

    html_body = f"""
<html>
<body style="font-family: Arial, sans-serif; font-size: 14px; color: #333;">
  <p>Prezado(a) <b>{agent_name}</b>,</p>
  <p>{message}</p>
{_summary_table_html(quotation.reference, modal, origin, destination, extra_rows_html=winning_value_row)}
  <br>
  <p>Atenciosamente,<br><b>Equipe Freitas COMEX</b></p>
</body>
</html>
"""
    return html_body


def build_winner_email(
    agent_name: str,
    quotation,
    proposal,
    custom_message: str | None = None,
) -> str:
    modal, origin, destination = _format_quotation_summary(quotation)

    carrier = proposal.carrier or "N/A"
    transit_time = f"{proposal.transit_time} dias" if proposal.transit_time else "N/A"
    frequencia = proposal.frequencia or "N/A"
    free_time = f"{proposal.free_time_dias} dias" if proposal.free_time_dias else "N/A"
    proposal_currency = proposal.freight_currency or "USD"
    total_value = f"{proposal_currency} {float(proposal.total_value):,.2f}" if proposal.total_value else "N/A"
    freight_value = f"{proposal_currency} {float(proposal.freight_value):,.2f}" if proposal.freight_value else "N/A"
    validity = _fmt_date(proposal.validity)
    incoterm = proposal.incoterm or "N/A"
    route_detail = proposal.route_detail or "N/A"

    default_message = (
        "Temos o prazer de informar que sua proposta foi aprovada para esta cotacao. "
        "Agradecemos sua parceria e continuamos a disposicao para futuras oportunidades."
    )
    message = custom_message or default_message
    message_html = message.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\n", "<br>")

    detail_rows = f"""
    <tr style="background-color:#f5f5f5;">
      <td><b>Cia/Armador</b></td>
      <td>{carrier}</td>
    </tr>
    <tr>
      <td><b>Transit Time</b></td>
      <td>{transit_time}</td>
    </tr>
    <tr style="background-color:#f5f5f5;">
      <td><b>Frequencia</b></td>
      <td>{frequencia}</td>
    </tr>
    <tr>
      <td><b>Free Time</b></td>
      <td>{free_time}</td>
    </tr>
    <tr style="background-color:#f5f5f5;">
      <td><b>Valor Total</b></td>
      <td>{total_value}</td>
    </tr>
    <tr>
      <td><b>Frete</b></td>
      <td>{freight_value}</td>
    </tr>
    <tr style="background-color:#f5f5f5;">
      <td><b>Validade</b></td>
      <td>{validity}</td>
    </tr>
    <tr>
      <td><b>Incoterm</b></td>
      <td>{incoterm}</td>
    </tr>
    <tr style="background-color:#f5f5f5;">
      <td><b>Rota</b></td>
      <td>{route_detail}</td>
    </tr>"""

    html_body = f"""
<html>
<body style="font-family: Arial, sans-serif; font-size: 14px; color: #333;">
  <p>Prezado(a) <b>{agent_name}</b>,</p>
  <p>{message_html}</p>
  <p>Detalhes da proposta aprovada:</p>
{_summary_table_html(quotation.reference, modal, origin, destination, reference_label="Referencia", extra_rows_html=detail_rows)}
  <br>
  <p>Atenciosamente,<br><b>Equipe Freitas COMEX</b></p>
</body>
</html>
"""
    return html_body


def build_reminder_email(
    agent_name: str,
    quotation,
    portal_link: str,
) -> str:
    """Return html_body reminding an agent to submit a proposal before the deadline."""
    modal, origin, destination = _format_quotation_summary(quotation)
    deadline = _fmt_datetime(quotation.desired_deadline)

    prazo_row = f"""
    <tr style="background-color:#f5f5f5;">
      <td><b>Prazo de Retorno</b></td>
      <td><b style="color:#dc2626;">{deadline}</b></td>
    </tr>"""

    html_body = f"""
<html>
<body style="font-family: Arial, sans-serif; font-size: 14px; color: #333;">
  <p>Prezado(a) <b>{agent_name}</b>,</p>
  <p>Este é um lembrete de que o prazo para envio de proposta da cotação
  <b>{quotation.reference}</b> se aproxima.</p>
{_summary_table_html(quotation.reference, modal, origin, destination, extra_rows_html=prazo_row)}
  <br>
  <p>
    <a href="{portal_link}"
       style="display:inline-block;padding:10px 20px;background-color:#1d4ed8;color:#ffffff;
              text-decoration:none;border-radius:4px;font-weight:bold;">
      Enviar proposta pelo portal
    </a>
  </p>
  <p style="font-size:12px;color:#666;">Ou copie o link: {portal_link}</p>
  <p>Atenciosamente,<br><b>Equipe Freitas COMEX</b></p>
</body>
</html>
"""
    return html_body


def _bool_label(value) -> str:
    if value is None:
        return "N/A"
    return "Sim" if value else "Não"


# ---------------------------------------------------------------------------
# Shared send + dispatch helpers (used by dispatch_rfq and add_rfq_agents)
# ---------------------------------------------------------------------------


def send_rfq_email_with_retry(
    token: str,
    mailbox_user: str,
    agent,
    quotation,
    rfq,
    portal_link: str,
    target_emails: list[str],
    subject: str,
    *,
    equipments: list | None = None,
    volumes: list | None = None,
    cc_addresses: list[str] | None = None,
) -> dict:
    agent_id = str(agent.id)
    html_body = build_rfq_body(
        agent.name, quotation, rfq, portal_link, equipments, volumes
    )

    last_error = None
    for attempt in range(_MAX_RETRIES):
        try:
            send_mail(
                token=token,
                sender_user_id=mailbox_user,
                to_addresses=target_emails,
                subject=subject,
                body_html=html_body,
                cc_addresses=cc_addresses,
            )
            if attempt > 0:
                logger.info(
                    "RFQ email sent after retry",
                    extra={"agent_id": agent_id, "attempt": attempt + 1},
                )
            return {"id": agent_id, "name": agent.name, "emails": target_emails, "status": "sent"}
        except MicrosoftGraphError as exc:
            last_error = exc
            error_msg = str(exc).lower()
            is_rate_limit = "mailboxconcurrency" in error_msg or "rate" in error_msg
            if attempt < _MAX_RETRIES - 1:
                delay = _BASE_RETRY_DELAY_SECONDS * (2 ** attempt)
                if is_rate_limit:
                    delay += _GRAPH_RATE_LIMIT_DELAY_SECONDS
                logger.warning(
                    "RFQ email failed, will retry",
                    extra={
                        "agent_id": agent_id,
                        "attempt": attempt + 1,
                        "max_retries": _MAX_RETRIES,
                        "delay_seconds": delay,
                        "error": str(exc),
                    },
                )
                time.sleep(delay)
            else:
                logger.error(
                    "Failed to send RFQ email to agent after all retries",
                    extra={"agent_id": agent_id, "agent_emails": target_emails, "error": str(exc)},
                )

    return {
        "id": agent_id,
        "name": agent.name,
        "emails": target_emails,
        "status": "failed",
        "error": str(last_error),
    }


def dispatch_rfq_emails(
    session,
    token: str,
    mailbox_user: str,
    agents: list,
    quotation,
    rfq,
    subject: str,
    agent_tokens: dict[str, str],
    app_base_url: str,
    *,
    equipments: list | None = None,
    volumes: list | None = None,
    cc_addresses: list[str] | None = None,
) -> list[dict]:
    agent_emails: dict[str, list[str]] = {
        str(agent.id): get_rfq_target_emails(session, agent, quotation)
        for agent in agents
    }

    with ThreadPoolExecutor(max_workers=min(len(agents), _MAX_RFQ_DISPATCH_WORKERS)) as pool:
        futures = {
            pool.submit(
                send_rfq_email_with_retry,
                token,
                mailbox_user,
                agent,
                quotation,
                rfq,
                f"{app_base_url}/proposta/{agent_tokens[str(agent.id)]}",
                agent_emails[str(agent.id)],
                subject,
                equipments=equipments,
                volumes=volumes,
                cc_addresses=cc_addresses,
            ): agent
            for agent in agents
        }
        results = [future.result() for future in as_completed(futures)]

    order = {str(a.id): idx for idx, a in enumerate(agents)}
    results.sort(key=lambda r: order.get(r["id"], 9999))
    return results


def build_proposal_review_email(
    agent_name: str,
    quotation,
    portal_link: str,
    review_reason: str,
    fields_to_review: list[str] | None = None,
) -> str:
    """Return html_body for an analyst-requested proposal review.

    The review reason is highlighted at the top of the email so the agent sees
    it immediately. The email also contains the portal link where the agent
    can submit a revised proposal.
    """
    fields_html = ""
    if fields_to_review:
        fields_html = (
            "<p><b>Campos para revisar:</b></p>"
            "<ul style='margin:4px 0 12px 0;padding-left:20px;'>"
            + "".join(f"<li>{f}</li>" for f in fields_to_review)
            + "</ul>"
        )

    highlight_block = (
        f'<div style="background-color:#fff3cd;border-left:4px solid #f59e0b;'
        f'padding:12px 16px;margin-bottom:16px;">'
        f'<p style="margin:0 0 4px 0;font-weight:bold;color:#92400e;">'
        f'Motivo da revisão solicitado pelo analista</p>'
        f'<p style="margin:0;color:#92400e;">{review_reason}</p>'
        f'</div>'
    )

    html_body = f"""
<html>
<body style="font-family: Arial, sans-serif; font-size: 14px; color: #333;">
  <p>Prezado(a) <b>{agent_name}</b>,</p>
  <p>Sua proposta para a cotação <b>{quotation.reference}</b> precisa de revisão.</p>
  {highlight_block}
  {fields_html}
  <p>
    <a href="{portal_link}"
       style="display:inline-block;padding:10px 20px;background-color:#1d4ed8;color:#ffffff;
              text-decoration:none;border-radius:4px;font-weight:bold;">
      Acessar portal e revisar proposta
    </a>
  </p>
  <p style="font-size:12px;color:#666;">Ou copie o link: {portal_link}</p>
  <p>Atenciosamente,<br><b>Equipe Freitas COMEX</b></p>
</body>
</html>
"""
    return html_body
