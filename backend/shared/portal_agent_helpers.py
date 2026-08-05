"""Serializers do portal para agentes de frete e preferências do cliente.

ARQUIVO NOVO DO PROTÓTIPO — não existe no Centrix. Segue a mesma ideia do
`portal_shipment_helpers.py`: projeção REDUZIDA, decidida aqui e não no handler.

O que fica de fora de `serialize_agent_for_portal`, e por quê:

  - `reliability_score`, `total_quotations`, `error_count` — o portal NUNCA
    expõe score de agente ao cliente. A metodologia do score está em correção
    (contador cumulativo -> taxa de erro em janela móvel) e o dashboard
    Inteligência > Agentes já usa rótulo qualitativo justamente por isso. Não é
    só "não renderizar": o número não sai do backend.
  - `email` e `preferred_channel` — canal de contato do agente com a Freitas.
    O cliente não fala com o agente direto; a RFQ sai pela Freitas.

`serialize_freight_agent` (o do analista) devolve tudo isso e continua servindo
`GET /portal/quotations/{id}/agents`, que é uma rota copiada do Centrix — não
mexa nela por aqui.
"""

from typing import Optional


def serialize_agent_for_portal(agent, paused: bool) -> dict:
    """Agente pré-aprovado, como o cliente o vê em "Meus Agentes"."""
    return {
        "id": str(agent.id),
        "name": agent.name,
        "modal_regions": (
            [r.value for r in agent.modal_regions] if agent.modal_regions else None
        ),
        "certificacao_oea": agent.certificacao_oea,
        "carga_imo": agent.carga_imo,
        # Escolha do cliente, não atributo do agente: se ele participa das
        # próximas solicitações de cotação deste cliente.
        "active": not paused,
    }


def serialize_preferences_for_portal(prefs, paused_agent_ids: list[str]) -> dict:
    """Preferências do cliente. Sem linha no banco ainda -> tudo nulo/vazio, que
    é o estado normal de quem nunca editou nada (não é erro, não é 404).
    """
    return {
        "paused_agent_ids": paused_agent_ids,
        "preferred_port": _attr(prefs, "preferred_port"),
        "default_incoterm": _attr(prefs, "default_incoterm"),
        "uses_insurance": _attr(prefs, "uses_insurance"),
        "cargo_particularities": _attr(prefs, "cargo_particularities"),
        "updated_at": (
            prefs.updated_at.isoformat()
            if prefs is not None and prefs.updated_at
            else None
        ),
    }


def _attr(prefs, name: str) -> Optional[object]:
    return getattr(prefs, name, None) if prefs is not None else None
