"""Serializers for the Client Portal shipment (GE) views.

New file rather than additions to `lambda_helpers.py`: the analyst serializers
there (`serialize_processo_detail`, `serialize_processo_kanban_item`) are copied
from Centrix and answer a different question — they expose everything the
operator needs, including internal fields. The portal shows a deliberately
narrower projection.

Deliberately omitted from every payload here:
  - `inova_processo_id` — the identifier of the process inside Freitas' ERP.
    Internal routing detail; same spirit as the privacy omissions the portal
    already applies to quotations and proposals.
  - `client_id` — always the caller's own client, so it carries no information.

What is NOT here, and why: there is no transition history. The database stores
only the Embarque's *current* `estado` (`centrix_shipment_embarques.estado`) —
no row is written when it changes, so an event-by-event timeline ("coletado em
12/03, embarcado em 18/03") cannot be derived from existing data. Surfacing the
current state as a progress indicator is honest; a fabricated timeline would not
be. A v2 would need a shipment transition-log table (embarque_id, from_state,
to_state, actor, timestamp) written by the GE state machine, at which point a
`serialize_shipment_history` belongs next to these functions.
"""

from typing import Any, Optional

# `_coerce` is the JSON-safety helper the copied serializers already use (UUID,
# datetime, Enum, Decimal, nested JSONB). Reused rather than reimplemented so the
# portal payloads coerce identically to every other Centrix payload.
from shared.lambda_helpers import _coerce


def serialize_shipment_for_portal(
    processo: Any, embarque: Any, agente_nome: Optional[str]
) -> dict:
    """Compact item for GET /portal/shipments.

    `id` is the Processo id (the entity the detail route loads), while
    `referencia` is the Embarque's EMB-YYYY-NNNN — the same identity split the
    analyst workspace uses.
    """
    return {
        "id": _coerce(processo.id),
        "referencia": embarque.reference,
        "estado": _coerce(embarque.estado),
        "incoterm": processo.incoterm,
        "modal": _coerce(processo.modal),
        "tipo_embarque": _coerce(processo.tipo_embarque),
        "tipo_despacho": _coerce(processo.tipo_despacho),
        "carga_urgente": processo.carga_urgente,
        "agente_nome": agente_nome,
        "quotation_id": _coerce(processo.quotation_id),
        "created_at": _coerce(processo.created_at),
        "updated_at": _coerce(embarque.updated_at or processo.updated_at),
    }


def serialize_shipment_detail_for_portal(
    processo: Any, embarque: Any, agent: Any = None
) -> dict:
    """Rich payload for GET /portal/shipments/{id}.

    Adds the fields the list omits: the nested agent, the containers JSONB and
    the free-text observation. `datas` is intentionally left out — the column is
    NULL for every process the portal provisions (the GE dates are filled in by
    the analyst workspace, which this prototype does not run), so exposing it
    would only render a row of empty ETAs.
    """
    return {
        **serialize_shipment_for_portal(
            processo, embarque, agent.name if agent else None
        ),
        "agente": {"id": _coerce(agent.id), "nome": agent.name} if agent else None,
        "containers": _coerce(processo.containers) or [],
        "observacao": processo.observacao,
    }


def count_by_estado(rows: list[tuple]) -> dict[str, int]:
    """Shipment counts per Embarque state, for the list header.

    This is the only summary the data actually supports. The GE "Torre de
    Controle" KPIs are deliberately not computed here: "SLA em Risco" has no
    deadline column to compare against (`processos.datas` is NULL) and
    "Documentos Pendentes" has no notion of which documents are required, so
    both would be invented numbers presented as facts.
    """
    counts: dict[str, int] = {}
    for _processo, embarque, *_rest in rows:
        key = _coerce(embarque.estado)
        counts[key] = counts.get(key, 0) + 1
    return counts
