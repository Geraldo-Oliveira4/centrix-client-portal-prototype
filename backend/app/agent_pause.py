"""Aplicação do toggle ativo/pausado de "Meus Agentes" na montagem da RFQ.

POR QUE VIVE EM `app/`: `lambdas/client_portal/list_quotation_agents` é copiado
do Centrix, onde a elegibilidade vem só do `default_agents` do DNA — o Centrix
não tem tela de agentes para o cliente, então não tem o conceito de "pausado".
Editar aquele handler seria divergir de código copiado; o filtro entra depois
dele, no router, como `prototype_flow` e `quotation_exporter` já fazem.

O QUE ESTE FILTRO GARANTE: o toggle não é decorativo. Um agente pausado some da
lista que o cliente escolhe ao montar a RFQ, e é assim que "não participa das
próximas solicitações de cotação" vira verdade. A validação do dispatch continua
sendo a do handler original (contra o `default_agents`), então nada aqui afrouxa
a regra — só estreita a oferta.

O QUE ELE NÃO FAZ, DE PROPÓSITO: não remove agente já selecionado numa RFQ
existente (`selected_agent_ids`). Pausar é uma escolha sobre as PRÓXIMAS
cotações; reescrever uma RFQ já montada faria a tela perder uma seleção que o
cliente fez antes, sem ele pedir. "Próximas" está no texto da tela e aqui.
"""

import json

from fastapi import Request, Response

from shared.database.connection import get_session
from shared.database.repositories import portal_client_preferences_repository
from shared.observability import logger
from shared.portal_helpers import get_portal_client_id


def filter_paused_agents(request: Request, response: Response) -> Response:
    """Remove da resposta de `list_quotation_agents` os agentes pausados.

    Erro ao pós-processar não derruba a rota: a lista sem filtro (o
    comportamento do Centrix) é degradação aceitável; uma tela de RFQ quebrada
    não é.
    """
    if response.status_code != 200:
        return response

    try:
        payload = json.loads(response.body)
    except (ValueError, TypeError):
        return response

    agents = payload.get("agents")
    if not isinstance(agents, list):
        return response

    paused = _paused_ids_for_request(request)
    if not paused:
        return response

    keep = {str(a) for a in (payload.get("selected_agent_ids") or [])}
    payload["agents"] = [
        a
        for a in agents
        if str(a.get("id")) not in paused or str(a.get("id")) in keep
    ]

    return Response(
        content=json.dumps(payload, default=str),
        status_code=200,
        media_type="application/json",
    )


def _paused_ids_for_request(request: Request) -> set[str]:
    try:
        # `get_portal_client_id` lê o `sub` do evento API Gateway; o shim já o
        # injeta em toda requisição do portal (auto-login do protótipo).
        from app.event_shim import build_event

        event = build_event(request, {}, None)
        with get_session() as session:
            client_id, err = get_portal_client_id(event, session)
            if err or client_id is None:
                return set()
            prefs = portal_client_preferences_repository.get_by_client(
                session, client_id
            )
            return set(
                portal_client_preferences_repository.resolve_paused_agent_ids(prefs)
            )
    except Exception:
        logger.exception("Failed to resolve paused agents; returning unfiltered list")
        return set()
