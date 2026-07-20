"""Quotation audit engine — Moment 1 pre-dispatch cross-checks.

Executes before dispatching the RFQ to freight agents (Moment 1).
Compares quotation and RFQ fields against the client DNA to detect
configuration mismatches before they propagate to agent responses.

Rule coverage:
  Active  (flag + block when AUDIT_M1_ACTIVE=true): 1.1, 1.2, 1.4, 1.5, 1.7
  Passive (record only, no block):                  1.3, 1.6

Rule 1.1 — Agent in preferred list (strict)
  rfq.agents_targeted must be a subset of dna.default_agents.
Rule 1.2 — Destination yard (flexible, impo)
  rfq.destination_yard must match the DNA yard for quotation.modal/tipo_embarque
  (dna.destination_yard_aereo / _maritimo_fcl / _maritimo_lcl) when both are set.
Rule 1.3 — Preferred export loading point (flexible) — PASSIVE
  dna.preferred_embarque_local exists; no corresponding RFQ field yet for expo.
Rule 1.4 — Insurance responsibility (strict)
  rfq.include_insurance must align with dna.insurance_responsibility.
Rule 1.5 — Collection particularities (flexible) — ACTIVE (ARB-2443)
  Fires when quotation.exporter_id is linked and the exporter's
  particularidades are not reflected in rfq.particularities.
Rule 1.6 — Collection address for EXW/FCA (strict) — PASSIVE (DA-001, partial)
  Exporter entity now exists and carries an address (ARB-2443), but neither
  Quotation nor RFQ has a free-text collection-address field to diff it
  against — cross-check remains deferred until that field is added.
Rule 1.7 — Dangerous cargo coherence (strict)
  Fires if EITHER dna.dangerous_cargo_shipper=True OR the linked exporter's
  cargo_profile=PERIGOSA, and quotation.carga_perigosa == NAO/None. The two
  signals are additive (ARB-2443): the exporter-level flag is not yet a
  replacement for the client-level one, only an extra source that can also
  trigger the same divergence.
"""

from shared.database.models.quotation.enums import (
    CargaPerigosa,
    InsuranceResponsibility,
    Modal,
    TipoEmbarque,
)
from shared.domain.dangerous_cargo import resolve_dangerous_cargo_flags


# ---------------------------------------------------------------------------
# Divergence record builder
# ---------------------------------------------------------------------------

def _divergence(
    tipo: str,
    campo: str,
    tipo_validacao: str,
    esperado,
    recebido,
    fonte_esperado: str,
    severidade: str,
    mensagem: str,
    sugestao=None,
) -> dict:
    return {
        "tipo": tipo,
        "campo": campo,
        "tipo_validacao": tipo_validacao,
        "esperado": esperado,
        "recebido": recebido,
        "fonte_esperado": fonte_esperado,
        "sugestao": sugestao,
        "severidade": severidade,
        "mensagem": mensagem,
    }


# ---------------------------------------------------------------------------
# DNA normalisation helpers
# ---------------------------------------------------------------------------

def _normalize_default_agents(default_agents) -> list[str]:
    """Normalise dna.default_agents (list or dict) to a flat list of UUID strings.

    Handles two storage formats observed in the codebase:
      - list  : ["uuid-1", "uuid-2"]
      - dict  : {"agents": ["uuid-1", "uuid-2"]} or {"uuid-1": ..., "uuid-2": ...}
    """
    if not default_agents:
        return []
    if isinstance(default_agents, list):
        flat = []
        for item in default_agents:
            if isinstance(item, list):
                flat.extend(str(i) for i in item)
            else:
                flat.append(str(item))
        return flat
    if isinstance(default_agents, dict):
        flat = []
        for value in default_agents.values():
            if isinstance(value, list):
                flat.extend(str(i) for i in value)
            else:
                flat.append(str(value))
        return flat
    return []


# ---------------------------------------------------------------------------
# Rule implementations
# ---------------------------------------------------------------------------

def _check_1_1_agente_preferencia(rfq, dna) -> list[dict]:
    """Rule 1.1 — All targeted agents must be in the client's preferred list (strict)."""
    if dna is None or not dna.default_agents:
        return []

    preferred_ids = _normalize_default_agents(dna.default_agents)
    if not preferred_ids:
        return []

    targeted_ids = rfq.agents_targeted or []
    preferred_set = {s.lower() for s in preferred_ids}
    out_of_preference = [a for a in targeted_ids if str(a).lower() not in preferred_set]

    if not out_of_preference:
        return []

    return [_divergence(
        tipo="agente_fora_preferencia",
        campo="rfq.agents_targeted",
        tipo_validacao="strict",
        esperado=preferred_ids,
        recebido=out_of_preference,
        fonte_esperado="dna_cliente",
        severidade="critico",
        mensagem=(
            f"{len(out_of_preference)} agente(s) acionado(s) fora da lista de preferencia do cliente. "
            "Utilize apenas agentes da lista preferida ou justifique a excecao."
        ),
    )]


def _resolve_dna_yard_for_modal(dna, modal, tipo_embarque):
    """Picks the DNA yard column matching the quotation's modal/sub-type.

    BREAK_BULK has no dedicated column (low volume, ARB-2384 scope decision)
    and falls through to None — rule 1.2 simply does not fire for that case.
    """
    if modal == Modal.AEREO:
        return dna.destination_yard_aereo
    if modal == Modal.MARITIMO and tipo_embarque == TipoEmbarque.LCL:
        return dna.destination_yard_maritimo_lcl
    if modal == Modal.MARITIMO and tipo_embarque == TipoEmbarque.FCL:
        return dna.destination_yard_maritimo_fcl
    return None


def _check_1_2_destination_yard(rfq, dna, quotation) -> list[dict]:
    """Rule 1.2 — RFQ destination yard must match the client's modal-specific yard (flexible, impo)."""
    if dna is None:
        return []

    dna_yard = _resolve_dna_yard_for_modal(dna, quotation.modal, quotation.tipo_embarque)
    if not dna_yard:
        return []

    rfq_yard = getattr(rfq, "destination_yard", None)
    if not rfq_yard:
        return []

    if rfq_yard.strip().lower() == dna_yard.strip().lower():
        return []

    return [_divergence(
        tipo="recinto_destino_divergente",
        campo="rfq.destination_yard",
        tipo_validacao="flexible",
        esperado=dna_yard,
        recebido=rfq_yard,
        fonte_esperado="dna_cliente",
        severidade="medio",
        mensagem=(
            f"Recinto de destino '{rfq_yard}' difere do preferido pelo cliente "
            f"'{dna_yard}'. Confirme se a excecao e justificada."
        ),
        sugestao=dna_yard,
    )]


def _check_1_3_embarque_local_passive(rfq, dna, quotation) -> list[dict]:
    """Rule 1.3 — Preferred export loading point (passive — no RFQ field for expo yet).

    dna.preferred_embarque_local exists but the RFQ model has no corresponding
    field for export quotations. Active enforcement is deferred until the field
    is added to the RFQ model.
    """
    return []


def _check_1_4_insurance(rfq, dna, quotation) -> list[dict]:
    """Rule 1.4 — Insurance responsibility in the RFQ must align with DNA preference (strict)."""
    if dna is None or dna.insurance_responsibility is None:
        return []

    dna_requires_agent = dna.insurance_responsibility == InsuranceResponsibility.AGENTE_DE_CARGAS
    rfq_includes = getattr(rfq, "include_insurance", None)

    if dna_requires_agent and rfq_includes is False:
        return [_divergence(
            tipo="seguro_omitido_na_rfq",
            campo="rfq.include_insurance",
            tipo_validacao="strict",
            esperado=True,
            recebido=False,
            fonte_esperado="dna_cliente",
            severidade="critico",
            mensagem=(
                "DNA do cliente exige que o agente inclua seguro "
                f"(insurance_responsibility={dna.insurance_responsibility.value}), "
                "mas a RFQ nao solicita cobertura de seguro."
            ),
        )]

    if not dna_requires_agent and rfq_includes is True:
        return [_divergence(
            tipo="seguro_inesperado_na_rfq",
            campo="rfq.include_insurance",
            tipo_validacao="flexible",
            esperado=False,
            recebido=True,
            fonte_esperado="dna_cliente",
            severidade="medio",
            mensagem=(
                f"DNA do cliente indica que o seguro nao e responsabilidade do agente "
                f"(insurance_responsibility={dna.insurance_responsibility.value}), "
                "mas a RFQ solicita cobertura de seguro."
            ),
        )]

    return []


def _check_1_5_particularidades(rfq, exporter) -> list[dict]:
    """Rule 1.5 — Collection particularities from exporter (flexible).

    Active now that the Exporter entity exists (ARB-2443). Fires when the
    linked exporter has known collection particularities that are not
    reflected in the RFQ's particularities free text.
    """
    if exporter is None or not exporter.particularidades:
        return []

    exporter_note = exporter.particularidades.strip()
    if not exporter_note:
        return []

    rfq_particularities = (rfq.particularities or "").strip().lower()
    if exporter_note.lower() in rfq_particularities:
        return []

    return [_divergence(
        tipo="particularidades_exportador_ausentes",
        campo="rfq.particularities",
        tipo_validacao="flexible",
        esperado=exporter_note,
        recebido=rfq.particularities,
        fonte_esperado="exportador",
        severidade="medio",
        mensagem=(
            "O exportador vinculado tem particularidades de coleta cadastradas que nao "
            f"aparecem no texto da RFQ: '{exporter_note}'. Confirme se foram consideradas."
        ),
        sugestao=exporter_note,
    )]


def _check_1_6_coleta_endereco_passive(rfq, dna, quotation, exporter) -> list[dict]:
    """Rule 1.6 — Collection address vs exporter record for EXW/FCA (passive).

    The Exporter entity now carries an address (ARB-2443), but neither
    Quotation nor RFQ has a free-text collection-address field to diff it
    against. Active enforcement is deferred until that field is added.
    """
    return []


def _check_1_7_carga_perigosa(rfq, dna, quotation, exporter) -> list[dict]:
    """Rule 1.7 — Dangerous cargo flag must be coherent with the quotation (strict).

    Fires if either the client DNA or the linked exporter flags dangerous
    cargo (additive — see module docstring, ARB-2443) but the quotation does
    not declare it.
    """
    dna_flags_dangerous, exporter_flags_dangerous = resolve_dangerous_cargo_flags(dna, exporter)
    if not dna_flags_dangerous and not exporter_flags_dangerous:
        return []

    carga = quotation.carga_perigosa
    if carga is None or carga == CargaPerigosa.NAO:
        if dna_flags_dangerous and exporter_flags_dangerous:
            fonte = "dna_cliente+exportador"
        elif dna_flags_dangerous:
            fonte = "dna_cliente"
        else:
            fonte = "exportador"
        return [_divergence(
            tipo="carga_perigosa_incoerente",
            campo="quotation.carga_perigosa",
            tipo_validacao="strict",
            esperado="IMO ou RA",
            recebido=carga.value if carga else None,
            fonte_esperado=fonte,
            severidade="critico",
            mensagem=(
                "Cliente e/ou exportador vinculado indicam embarcador de carga perigosa, "
                "mas a cotacao nao declara carga perigosa. "
                "Confirme a classificacao IMO/RA antes de disparar a RFQ."
            ),
        )]

    return []


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def audit_momento_1(quotation, rfq, dna, exporter=None) -> list[dict]:
    """Run all Moment 1 rules and return a list of divergence dicts.

    Args:
        quotation: Quotation ORM instance.
        rfq: RFQ ORM instance for this quotation.
        dna: QuotationClientDna ORM instance, or None if the client has no DNA.
        exporter: Exporter ORM instance linked via quotation.exporter_id, or
            None if no exporter is linked (ARB-2443).

    Returns:
        List of divergence dicts following the cotacao_auditoria JSONB schema.
        An empty list means no divergencias were detected.
    """
    divergencias = []
    divergencias.extend(_check_1_1_agente_preferencia(rfq, dna))
    divergencias.extend(_check_1_2_destination_yard(rfq, dna, quotation))
    divergencias.extend(_check_1_3_embarque_local_passive(rfq, dna, quotation))
    divergencias.extend(_check_1_4_insurance(rfq, dna, quotation))
    divergencias.extend(_check_1_5_particularidades(rfq, exporter))
    divergencias.extend(_check_1_6_coleta_endereco_passive(rfq, dna, quotation, exporter))
    divergencias.extend(_check_1_7_carga_perigosa(rfq, dna, quotation, exporter))
    return divergencias
