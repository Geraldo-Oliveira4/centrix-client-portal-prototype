"""Audit motor — deterministic rules across 5 categories.

Executes automatically after a proposal is registered (T07b / RF-COT-040).
Returns a list of flag dicts (not persisted here — the caller persists via
audit_flag_repository.create_bulk). The caller is also responsible for
post-audit side effects (reliability score, state transitions).

Rule categories:
  S  — Insurance (S1-S2)
  R  — Route / Destination (R1-R4)
  C  — Incomplete quotation (C1-C2, C4-C6)
  P  — Particularities ignored (P1-P3, heuristic — no LLM in v1)
  D  — DNA Compliance (D1-D2, CRITICAL: OEA and Anvisa restrictions)
"""

import re
from datetime import date, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from shared.database.models.quotation.enums import AuditCategory, InsuranceResponsibility, Modal, Severity, TipoEmbarque
from shared.database.repositories import quotation_equipment_repository, transit_time_reference_repository
from shared.domain.oea_compliance import agent_has_valid_oea


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _flag(category: AuditCategory, rule_name: str, severity: Severity, description: str) -> dict:
    return {
        "rule_category": category,
        "rule_name": rule_name,
        "severity": severity,
        "description": description,
    }


def _contains(text: Optional[str], substring: str) -> bool:
    if not text:
        return False
    return substring.lower() in text.lower()


def _extract_location_tokens(s: str) -> set:
    """Extract alphabetic tokens of length >= 4 from a location string for fuzzy matching."""
    return {t.lower() for t in re.findall(r'[A-Za-z]{4,}', s)}


def _destinations_match(dest_a: str, dest_b: str) -> bool:
    """Return True if two destination strings refer to the same place.

    Handles port codes (NVT), parenthetical suffixes (BRNVI), and
    different name formats (Navegantes, BR vs Navegantes, Brazil).
    Extracts significant tokens (>= 4 chars, alpha) and checks for overlap.
    """
    if _extract_location_tokens(dest_a) & _extract_location_tokens(dest_b):
        return True
    a_lower = dest_a.lower()
    b_lower = dest_b.lower()
    return a_lower in b_lower or b_lower in a_lower


# ---------------------------------------------------------------------------
# Category S — Insurance
# ---------------------------------------------------------------------------

def _check_insurance(proposal, rfq, dna) -> list[dict]:
    flags = []

    if dna is None or dna.insurance_responsibility is None:
        return flags

    dna_requires_agent_insurance = dna.insurance_responsibility == InsuranceResponsibility.AGENTE_DE_CARGAS

    # S1 — Insurance omitted (agent should include insurance but didn't)
    if dna_requires_agent_insurance and not proposal.insurance_included:
        flags.append(_flag(
            AuditCategory.SEGURO,
            "S1_insurance_omitted",
            Severity.CRITICAL,
            (
                f"O DNA do cliente exige que o agente inclua seguro "
                f"(insurance_responsibility={dna.insurance_responsibility.value}), "
                "mas a proposta nao inclui seguro."
            ),
        ))

    # S2 — Insurance included when not required by agent (soft: does not block, but warrants review)
    if not dna_requires_agent_insurance and proposal.insurance_included:
        flags.append(_flag(
            AuditCategory.SEGURO,
            "S2_insurance_unexpected",
            Severity.MEDIUM,
            (
                f"O DNA do cliente indica que o seguro nao e responsabilidade do agente "
                f"(insurance_responsibility={dna.insurance_responsibility.value}), "
                "mas a proposta inclui seguro."
            ),
        ))

    return flags


# ---------------------------------------------------------------------------
# Category R — Route / Destination
# ---------------------------------------------------------------------------

def _check_route(session: Session, proposal, quotation) -> list[dict]:
    flags = []

    # R1 — Destination matches quotation (compared against proposal_destination field)
    # destination was split into porto_destino / aeroporto_destino (arrays) in migration 025
    if quotation.modal == Modal.AEREO:
        dest_list = quotation.aeroporto_destino or []
    else:
        dest_list = quotation.porto_destino or []
    quotation_destination = ", ".join(dest_list) if dest_list else None

    if quotation_destination and proposal.proposal_destination:
        if not _destinations_match(proposal.proposal_destination, quotation_destination):
            flags.append(_flag(
                AuditCategory.ROTA_DESTINO,
                "R1_destination_mismatch",
                Severity.CRITICAL,
                (
                    f"Destino informado pelo agente '{proposal.proposal_destination}' "
                    f"nao corresponde ao destino da cotacao '{quotation_destination}'."
                ),
            ))

    # R2 — Origin matches quotation (compared against proposal_origin field)
    if quotation.origin and proposal.proposal_origin:
        if not _destinations_match(proposal.proposal_origin, quotation.origin):
            flags.append(_flag(
                AuditCategory.ROTA_DESTINO,
                "R2_origin_mismatch",
                Severity.CRITICAL,
                (
                    f"Origem informada pelo agente '{proposal.proposal_origin}' "
                    f"nao corresponde a origem da cotacao '{quotation.origin}'."
                ),
            ))

    # TODO: R1/R2 LLM — use an LLM to semantically compare proposal.route_detail against
    # quotation.origin and quotation_destination to detect routing inconsistencies.
    # Current heuristic (string match on dedicated fields) does not catch cases where the
    # agent confirms origin/destination correctly but the route_detail describes a different path.

    # R3 / R4 — Transit time reference checks
    if quotation.modal and quotation.origin:
        # Extract country from origin string (assume last token after comma, or full string)
        origin_parts = quotation.origin.split(",")
        origin_country = origin_parts[-1].strip() if len(origin_parts) > 1 else quotation.origin.strip()

        ref = transit_time_reference_repository.get_by_modal_and_origin(
            session, quotation.modal, origin_country
        )
        if ref and ref.avg_days:
            tolerance = float(ref.tolerance_pct) / 100.0
            lower = ref.avg_days * (1.0 - tolerance)
            upper = ref.avg_days * (1.0 + tolerance)

            # R4 — Transit time out of expected range
            if proposal.transit_time < lower or proposal.transit_time > upper:
                flags.append(_flag(
                    AuditCategory.ROTA_DESTINO,
                    "R4_transit_time_implausible",
                    Severity.CRITICAL,
                    (
                        f"Transit time de {proposal.transit_time} dias esta fora do intervalo esperado "
                        f"[{lower:.0f}–{upper:.0f}] dias para {quotation.modal.value} "
                        f"com origem em {origin_country} (media de referencia: {ref.avg_days} dias, "
                        f"tolerancia: {ref.tolerance_pct}%)."
                    ),
                ))

            # R3 — Transit time exceeds upper bound and no transshipment declared
            if proposal.transit_time > upper:
                has_transshipment = _contains(proposal.route_detail, "transbordo") or _contains(proposal.route_detail, "transshipment")
                if not has_transshipment:
                    flags.append(_flag(
                        AuditCategory.ROTA_DESTINO,
                        "R3_undeclared_transshipment",
                        Severity.CRITICAL,
                        (
                            f"Transit time de {proposal.transit_time} dias excede "
                            f"o limite superior esperado de {upper:.0f} dias, mas "
                            "nenhum transbordo e declarado no detalhe de rota."
                        ),
                    ))

    # R5 — FCL container quantity mismatch
    # The audit motor provides defense-in-depth: submit_proposal already hard-blocks
    # this at submission time, but proposals created via other paths (internal upload,
    # manual creation) still go through the audit motor.
    if quotation.tipo_embarque == TipoEmbarque.FCL:
        containers_priced = getattr(proposal, "containers_priced", None)
        equipments = quotation_equipment_repository.list_by_quotation(session, quotation.id)
        total_requested = sum(int(e.quantity) for e in equipments)
        if total_requested > 0:
            if containers_priced is None:
                flags.append(_flag(
                    AuditCategory.ROTA_DESTINO,
                    "R5_fcl_containers_not_declared",
                    Severity.CRITICAL,
                    (
                        f"Embarque FCL: a cotacao solicita {total_requested} container(es), "
                        "mas a proposta nao declara a quantidade precificada (containers_priced ausente)."
                    ),
                ))
            elif int(containers_priced) != total_requested:
                flags.append(_flag(
                    AuditCategory.ROTA_DESTINO,
                    "R5_fcl_container_quantity_mismatch",
                    Severity.CRITICAL,
                    (
                        f"Quantidade de containers diverge: cotacao solicita {total_requested} "
                        f"container(es), proposta declara {containers_priced}. "
                        "Verificar se o agente precificou todos os equipamentos solicitados."
                    ),
                ))

    return flags


# ---------------------------------------------------------------------------
# Category C — Incomplete quotation
# ---------------------------------------------------------------------------

def _check_completeness(proposal, quotation) -> list[dict]:
    flags = []

    # C1 — Taxes breakdown has at least one entry
    if not proposal.taxes_breakdown or len(proposal.taxes_breakdown) == 0:
        flags.append(_flag(
            AuditCategory.COTACAO_INCOMPLETA,
            "C1_taxes_breakdown_empty",
            Severity.HIGH,
            "A composicao de custos esta vazia. Esperado ao menos um componente de taxa ou sobretaxa.",
        ))

    # C2 — Freight value present and positive
    if proposal.freight_value is None or float(proposal.freight_value) <= 0:
        flags.append(_flag(
            AuditCategory.COTACAO_INCOMPLETA,
            "C2_freight_value_missing",
            Severity.HIGH,
            "O valor do frete internacional esta ausente ou zerado.",
        ))

    # C3 — Quotation cargo data referenced in proposal
    # Deferred: quotation.weight was removed in migration 024 (cargo data now lives in
    # quotation_equipment / quotation_volume child tables). Full C3 implementation requires
    # passing pre-loaded equipment/volume lists into _check_completeness — tracked separately.

    # C4 — Incoterm matches quotation
    if quotation.incoterm and proposal.incoterm:
        if proposal.incoterm.upper() != quotation.incoterm.upper():
            flags.append(_flag(
                AuditCategory.COTACAO_INCOMPLETA,
                "C4_incoterm_mismatch",
                Severity.HIGH,
                (
                    f"O incoterm da proposta '{proposal.incoterm}' nao corresponde "
                    f"ao incoterm da cotacao '{quotation.incoterm}'."
                ),
            ))
    elif quotation.incoterm and not proposal.incoterm:
        flags.append(_flag(
            AuditCategory.COTACAO_INCOMPLETA,
            "C4_incoterm_missing",
            Severity.HIGH,
            f"A proposta nao informa o incoterm. A cotacao exige '{quotation.incoterm}'.",
        ))

    if quotation.carga_perigosa and quotation.carga_perigosa.value != "NAO":
        if not proposal.carga_perigosa or proposal.carga_perigosa == "NAO":
            flags.append(_flag(
                AuditCategory.COTACAO_INCOMPLETA,
                "C5_carga_perigosa_mismatch",
                Severity.CRITICAL,
                (
                    f"A cotacao exige carga perigosa ({quotation.carga_perigosa.value}), "
                    "mas a proposta nao declara carga perigosa."
                ),
            ))
        elif proposal.carga_perigosa != quotation.carga_perigosa.value:
            flags.append(_flag(
                AuditCategory.COTACAO_INCOMPLETA,
                "C5_carga_perigosa_mismatch",
                Severity.HIGH,
                (
                    f"Classificacao de carga perigosa diverge: "
                    f"cotacao '{quotation.carga_perigosa.value}' vs proposta '{proposal.carga_perigosa}'."
                ),
            ))

    # C6 — Currency mismatch: DISABLED (false positives on every import quotation).
    # declared_value_currency is the cargo value currency (BRL for Brazilian imports),
    # not the agreed freight payment currency (USD, standard for international freight).
    # Requires a dedicated quotation.freight_currency field to enforce correctly.

    # C7 — Proposal validity expired or expiring very soon (within 2 business days).
    if proposal.validity is not None:
        today = date.today()
        validity_date = proposal.validity if isinstance(proposal.validity, date) else proposal.validity.date()
        if validity_date < today:
            flags.append(_flag(
                AuditCategory.COTACAO_INCOMPLETA,
                "C7_proposal_validity_expired",
                Severity.HIGH,
                f"A validade da proposta ({validity_date.isoformat()}) ja esta expirada.",
            ))
        elif validity_date <= today + timedelta(days=2):
            flags.append(_flag(
                AuditCategory.COTACAO_INCOMPLETA,
                "C7_proposal_validity_expiring_soon",
                Severity.MEDIUM,
                (
                    f"A validade da proposta expira em {validity_date.isoformat()} "
                    f"({(validity_date - today).days} dia(s)). Confirmar com o agente antes de enviar ao cliente."
                ),
            ))

    return flags


# ---------------------------------------------------------------------------
# Category P — Particularities ignored (heuristic, no LLM in v1)
# ---------------------------------------------------------------------------

def _check_particularities(proposal, rfq) -> list[dict]:
    flags = []

    if rfq is None:
        return flags

    # P1 — DNA particularities referenced in proposal
    if rfq.particularities and rfq.particularities.strip():
        # Heuristic: check route_detail acknowledges particularities via keywords
        # Full LLM-based comparison is deferred to a future iteration
        particularities_lower = rfq.particularities.lower()
        route_lower = (proposal.route_detail or "").lower()
        # Only flag if there are explicit requirements (contains "atenção", "obrigatório",
        # "required", "attention", "dangerous") and route_detail is completely empty
        has_requirements = any(
            kw in particularities_lower
            for kw in ["required", "mandatory", "obrigat", "aten", "dangerous", "perigosa"]
        )
        if has_requirements and not route_lower:
            flags.append(_flag(
                AuditCategory.PARTICULARIDADES_IGNORADAS,
                "P1_particularities_not_addressed",
                Severity.MEDIUM,
                (
                    "O RFQ possui particularidades com requisitos obrigatorios, "
                    "mas o detalhe de rota da proposta esta vazio — nao e possivel confirmar conformidade. "
                    f"Particularidades: {rfq.particularities[:200]}"
                ),
            ))

    # P2 — Special procedures from RFQ template_data
    special_procedures = (rfq.template_data or {}).get("special_procedures")
    if special_procedures:
        route_lower = (proposal.route_detail or "").lower()
        if not route_lower:
            flags.append(_flag(
                AuditCategory.PARTICULARIDADES_IGNORADAS,
                "P2_special_procedures_not_addressed",
                Severity.HIGH,
                (
                    f"O RFQ especifica procedimentos especiais ({special_procedures!r}), "
                    "mas a proposta nao fornece detalhe de rota para confirmar conformidade."
                ),
            ))

    # P3 — Requested options from RFQ template_data
    requested_options = (rfq.template_data or {}).get("requested_options")
    if requested_options:
        route_lower = (proposal.route_detail or "").lower()
        if not route_lower:
            flags.append(_flag(
                AuditCategory.PARTICULARIDADES_IGNORADAS,
                "P3_requested_options_missing",
                Severity.MEDIUM,
                (
                    f"O RFQ solicita opcoes especificas ({requested_options!r}), "
                    "mas a proposta nao fornece detalhe de rota para confirmar que estao cobertas."
                ),
            ))

    return flags


# ---------------------------------------------------------------------------
# Category D — DNA Compliance (CRITICAL hard-blocks)
# ---------------------------------------------------------------------------


def _check_dna_compliance(proposal, agent, dna) -> list[dict]:
    """Check DNA compliance rules (OEA and Anvisa restrictions).

    These are CRITICAL hard-blocks that prevent proposal acceptance.
    """
    flags = []

    if dna is None:
        return flags

    # D1 — Client requires OEA but agent lacks valid certification
    if dna.exige_oea and agent:
        if not agent_has_valid_oea(agent):
            expires_text = ""
            if agent and agent.data_validade_oea:
                expires_text = f" (validade: {agent.data_validade_oea})"
            flags.append(_flag(
                AuditCategory.DNA_COMPLIANCE,
                "D1_dna_exige_oea_but_agent_lacks",
                Severity.CRITICAL,
                (
                    f"O DNA do cliente exige certificacao OEA (exige_oea=True), "
                    f"mas o agente '{agent.name if agent else 'N/A'}' nao possui "
                    f"certificacao OEA valida.{expires_text}"
                ),
            ))

    # D2 — Anvisa restrictions violated
    if dna.anvisa_restrictions and agent:
        restrictions = dna.anvisa_restrictions
        requires_anvisa_agent = restrictions.get("requires_anvisa_agent", False)
        restricted_product_types = restrictions.get("restricted_product_types", [])

        if requires_anvisa_agent and not agent.carga_imo:
            flags.append(_flag(
                AuditCategory.DNA_COMPLIANCE,
                "D2_dna_anvisa_restriction_violated",
                Severity.CRITICAL,
                (
                    f"O DNA do cliente possui restricoes ANVISA que exigem "
                    f"agente certificado para Carga IMO, mas o agente '{agent.name}' nao possui "
                    f"certificacao de Carga IMO. Restricoes: {restricted_product_types}"
                ),
            ))

    return flags


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def run_audit(
    session: Session,
    proposal,
    quotation,
    rfq=None,
    dna=None,
    agent=None,
) -> list[dict]:
    """Run all 20 audit rules against a proposal.

    Args:
        session: Active SQLAlchemy session (used for transit time lookups).
        proposal: Proposal ORM instance (already flushed, has an id).
        quotation: Quotation ORM instance.
        rfq: RFQ ORM instance for this quotation, or None.
        dna: QuotationClientDna ORM instance, or None.
        agent: FreightAgent ORM instance for the proposal's agent, or None.

    Returns:
        List of flag dicts with keys: rule_category, rule_name, severity, description.
        The caller is responsible for persisting these via audit_flag_repository.create_bulk.
    """
    flags = []
    flags.extend(_check_insurance(proposal, rfq, dna))
    flags.extend(_check_route(session, proposal, quotation))
    flags.extend(_check_completeness(proposal, quotation))
    flags.extend(_check_particularities(proposal, rfq))
    flags.extend(_check_dna_compliance(proposal, agent, dna))
    return flags


def update_agent_reliability(agent, flags: list[dict]) -> None:
    """Update FreightAgent.error_count and reliability_score after audit.

    Each CRITICAL flag counts as 2 errors; HIGH as 1; MEDIUM/LOW as 0.
    Reliability score = max(0, 100 - (error_count * 5)), capped at 100.

    The caller must flush/commit the session after calling this.
    """
    critical_count = sum(1 for f in flags if f["severity"] == Severity.CRITICAL)
    high_count = sum(1 for f in flags if f["severity"] == Severity.HIGH)

    new_errors = (critical_count * 2) + high_count
    agent.total_quotations = (agent.total_quotations or 0) + 1
    agent.error_count = (agent.error_count or 0) + new_errors

    raw_score = 100.0 - (agent.error_count * 5.0)
    agent.reliability_score = max(0.0, min(100.0, raw_score))
