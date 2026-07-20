"""RFQ field validation service.

Implements RF-COT-019: hard block / soft warning logic for RFQ submission.

Hard blocks prevent the RFQ from being created (422 from create_rfq).
Soft warnings notify the analyst but allow proceeding.

Severity mapping (per "Regras de Validacao - Cotacao.pdf"):
  - Hard block  = "trava dura"  — field is mandatory, RFQ cannot be dispatched without it
  - Soft warning = "alerta suave" — field is recommended; analyst may proceed knowing the risk

Base field checks (always required unless the agent is responsible for defining the value):
  - Origem, Destino (porto/aeroporto), Incoterm, Produto, Modal, Prazo, Stackability (non-FCL),
    Valor declarado (CIF/CIP/Aéreo), Endereço entrega (DAP/DPU/DDP), Carga perigosa (IMO/RA),
    Temperatura min + max (when one is provided, both required)

Incoterm conditionals — fields that become mandatory based on incoterm:
  - CIF / CIP          : declared_value required (insurance calculation)
  - DAP / DPU / DDP    : endereco_entrega_final required (door / unloading address)
  - DPU                : necessidade_descarga required (unloading responsibility must be explicit)
  - DDP                : ncm required (customs declaration and duty calculation)
  - FAS / FOB / CFR /
    CIF / CIP          : porto_embarque (maritime) or aeroporto_embarque (air) required

Modal conditionals:
  - LCL / Aéreo : stackability required (co-loaded cargo)
  - Aéreo       : declared_value required (ad-valorem fee)
  - Marítimo    : porto_destino required (unless agent defines it)
  - Aéreo       : aeroporto_destino required (unless agent defines it)
  - FCL         : at least one equipment row required (soft — container type unknown otherwise)

Dangerous cargo:
  - IMO : imo_class + un_number required (hard)
  - RA  : un_number required (hard)
  - DNA flag (dangerous_cargo_shipper) without an explicit carga_perigosa: soft prompt only
"""

from typing import Optional

from shared.database.models.quotation.enums import CargaPerigosa, Modal, TipoEmbarque
from shared.domain.dangerous_cargo import resolve_dangerous_cargo_flags

_INCOTERMS_REQUIRING_INSURANCE_VALUE = {"CIF", "CIP"}
_INCOTERMS_REQUIRING_DELIVERY_ADDRESS = {"DAP", "DPU", "DDP"}
# Incoterms where the port/airport of loading must be explicitly named.
# FAS and FOB are maritime-only by Incoterms 2020; CFR, CIF, CIP apply to any mode.
_INCOTERMS_REQUIRING_PORT_OF_LOADING = {"FAS", "FOB", "CFR", "CIF", "CIP"}

# Human-readable labels for each validated field
_FIELD_LABELS = {
    "client_id": "Cliente (DNA)",
    "origin": "Local de coleta (origem)",
    "incoterm": "Incoterm",
    "include_insurance": "Seguro (sim/não)",
    "product": "Produto / mercadoria",
    "stackability": "Empilhável / tombável",
    "declared_value": "Valor declarado da carga",
    "imo_class": "Classe IMO (carga perigosa)",
    "un_number": "Número ONU (carga perigosa)",
    "carga_perigosa": "Classificação de carga perigosa",
    "modal": "Modal / rota",
    "validity": "Prazo desejado (deadline)",
    "endereco_entrega_final": "Endereço de entrega final",
    "porto_destino": "Porto de destino",
    "aeroporto_destino": "Aeroporto de destino",
    "porto_embarque": "Porto de embarque",
    "aeroporto_embarque": "Aeroporto de embarque",
    "temperatura_min": "Temperatura mínima (carga refrigerada)",
    "temperatura_max": "Temperatura máxima (carga refrigerada)",
    "tipo_container_fcl": "Tipo de container (FCL)",
    "necessidade_descarga": "Necessidade de descarga (DPU)",
    "ncm": "NCM (Nomenclatura Comum do Mercosul)",
}


def validate_rfq_fields(
    quotation,
    dna: Optional[object],
    equipments: Optional[list] = None,
    exporter: Optional[object] = None,
) -> dict:
    """Return validation result for an RFQ based on the quotation and client DNA.

    Args:
        quotation: Quotation ORM instance.
        dna: QuotationClientDna ORM instance, or None if the client has no DNA.
        equipments: List of QuotationEquipment ORM instances for this quotation, or None
            if the caller did not load them (FCL soft warning will be skipped).

    Returns:
        {
            "hard_blocks": [{"field": str, "label": str, "reason": str}, ...],
            "soft_warnings": [{"field": str, "label": str, "reason": str}, ...],
        }
    """
    hard_blocks = []
    soft_warnings = []

    def hard(field: str, reason: str) -> None:
        hard_blocks.append({
            "field": field,
            "label": _FIELD_LABELS.get(field, field),
            "reason": reason,
        })

    def soft(field: str, reason: str) -> None:
        soft_warnings.append({
            "field": field,
            "label": _FIELD_LABELS.get(field, field),
            "reason": reason,
        })

    incoterm = (quotation.incoterm or "").upper()
    is_fcl = quotation.tipo_embarque == TipoEmbarque.FCL
    is_aereo = quotation.modal == Modal.AEREO
    is_maritimo = quotation.modal == Modal.MARITIMO

    # --- Hard blocks (trava dura) ---

    # Origin: not required when agent defines collection point or when incoterm is FOB
    # (for FOB the exporter delivers to the port; no pickup address needed).
    if not quotation.origin and not quotation.agente_define_local_coleta and incoterm != "FOB":
        hard("origin", "Local de coleta (origem) não informado.")

    if not quotation.incoterm:
        hard("incoterm", "Incoterm não informado.")

    if not quotation.product:
        hard("product", "Produto / mercadoria não informado.")

    if not quotation.modal:
        hard("modal", "Modal / rota não informado.")

    if not quotation.desired_deadline:
        hard("validity", "Prazo desejado (deadline) não informado.")

    # Destination: always required unless the agent is responsible for defining it.
    if is_maritimo:
        if not quotation.agente_define_porto_destino and not quotation.porto_destino:
            hard("porto_destino", "Porto de destino não informado.")
    elif is_aereo:
        if not quotation.agente_define_aeroporto_destino and not quotation.aeroporto_destino:
            hard("aeroporto_destino", "Aeroporto de destino não informado.")

    # Port/airport of loading: required for incoterms where the seller must name
    # the point of handover to the carrier (FAS, FOB, CFR, CIF, CIP).
    if incoterm in _INCOTERMS_REQUIRING_PORT_OF_LOADING:
        if is_maritimo:
            if not quotation.agente_define_porto_embarque and not quotation.porto_embarque:
                hard(
                    "porto_embarque",
                    f"Porto de embarque obrigatório para incoterm {incoterm}.",
                )
        elif is_aereo:
            if not quotation.agente_define_aeroporto_embarque and not quotation.aeroporto_embarque:
                hard(
                    "aeroporto_embarque",
                    f"Aeroporto de embarque obrigatório para incoterm {incoterm}.",
                )

    # Stackability: FCL is exempt (exclusive container — stacking is not relevant).
    # LCL and air cargo are co-loaded; stackability directly impacts cost and safety.
    if quotation.stackability is None and not is_fcl:
        hard("stackability", "Campo empilhável / tombável não informado.")

    # Declared value: always required for CIF/CIP (insurance calculation) and for
    # air cargo (ad-valorem fee). Soft reminder for all other cases.
    if quotation.declared_value is None:
        if incoterm in _INCOTERMS_REQUIRING_INSURANCE_VALUE:
            hard(
                "declared_value",
                f"Valor declarado da carga obrigatório para incoterm {incoterm} "
                "(necessário para cálculo do seguro).",
            )
        elif is_aereo:
            hard(
                "declared_value",
                "Valor declarado da carga obrigatório para modal aéreo "
                "(impacta seguro e taxa ad valorem).",
            )
        else:
            soft("declared_value", "Valor declarado da carga não informado.")

    # Incoterm conditionals — delivery address required for door-delivery incoterms
    if incoterm in _INCOTERMS_REQUIRING_DELIVERY_ADDRESS:
        if not getattr(quotation, "endereco_entrega_final", None):
            hard(
                "endereco_entrega_final",
                f"Endereço de entrega final obrigatório para incoterm {incoterm}.",
            )

    if incoterm == "DPU":
        if getattr(quotation, "necessidade_descarga", None) is None:
            hard(
                "necessidade_descarga",
                "Necessidade de descarga obrigatória para incoterm DPU "
                "(vendedor é responsável pelo descarregamento no destino).",
            )

    if incoterm == "DDP":
        if not getattr(quotation, "ncm", None):
            hard(
                "ncm",
                "NCM obrigatório para incoterm DDP "
                "(necessário para desembaraço aduaneiro e cálculo de impostos).",
            )

    # Dangerous cargo: validate based on the quotation's own carga_perigosa field,
    # not on the DNA flag. The DNA flag is a general client-level attribute and
    # must not block individual shipments that are not actually hazmat.
    if quotation.carga_perigosa in (CargaPerigosa.IMO, CargaPerigosa.RA):
        if not quotation.un_number:
            hard(
                "un_number",
                "Número ONU não informado para carga perigosa IMO/RA.",
            )
    if quotation.carga_perigosa == CargaPerigosa.IMO:
        if not quotation.imo_class:
            hard(
                "imo_class",
                "Classe IMO não informada para carga perigosa IMO.",
            )

    # Refrigerated cargo: when either temperature bound is provided, both are required.
    has_min = quotation.temperatura_min is not None
    has_max = quotation.temperatura_max is not None
    if has_min and not has_max:
        hard("temperatura_max", "Temperatura máxima obrigatória quando temperatura mínima é informada.")
    elif has_max and not has_min:
        hard("temperatura_min", "Temperatura mínima obrigatória quando temperatura máxima é informada.")

    # --- Soft warnings (alerta suave) ---

    # FCL without any equipment row: container type is unknown and agents cannot price accurately.
    # Skipped when equipments is None (caller did not load them — avoids false negatives).
    if is_fcl and equipments is not None and len(equipments) == 0:
        soft(
            "tipo_container_fcl",
            "Nenhum equipamento (container) informado para embarque FCL. "
            "Informe o tipo e quantidade de containers para que os agentes possam cotar corretamente.",
        )

    if quotation.insurance_required is None:
        soft("include_insurance", "Responsabilidade pelo seguro não definida (sim ou não).")

    # DNA/exporter flag: suggest confirming hazmat classification when the client or
    # the linked exporter is a known dangerous-goods shipper but the current
    # quotation has no carga_perigosa set. The two signals are additive (ARB-2443).
    dna_flags_dangerous, exporter_flags_dangerous = resolve_dangerous_cargo_flags(dna, exporter)
    if (dna_flags_dangerous or exporter_flags_dangerous) and not quotation.carga_perigosa:
        soft(
            "carga_perigosa",
            "Cliente e/ou exportador vinculado indicam embarcador de carga perigosa. "
            "Confirme se esta carga requer classificação IMO/RA.",
        )

    return {"hard_blocks": hard_blocks, "soft_warnings": soft_warnings}


def build_particularities_from_dna(dna) -> Optional[str]:
    """Concatenate DNA fields into a single particularities string for the RFQ.

    Args:
        dna: QuotationClientDna ORM instance.

    Returns:
        A combined string, or None if all source fields are empty.
    """
    parts = []

    if dna.quotation_particularities:
        parts.append(dna.quotation_particularities.strip())

    if dna.dangerous_cargo_shipper:
        parts.append("ATENÇÃO: Cliente embarcador de carga perigosa. Classe IMO obrigatória.")

    if dna.price_or_performance:
        label = "Foco em preço" if dna.price_or_performance.value == "PRECO" else "Foco em performance"
        parts.append(f"Preferência do cliente: {label}.")

    return "\n".join(parts) if parts else None
