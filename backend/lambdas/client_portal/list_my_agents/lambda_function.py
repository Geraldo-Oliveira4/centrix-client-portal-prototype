"""list_my_agents — GET /portal/agents

HANDLER NOVO DO PROTÓTIPO — não existe no Centrix, onde a lista de agentes
elegíveis só aparece em contexto de UMA cotação (`list_quotation_agents`).

Lista os agentes que a Freitas pré-aprovou para este cliente, com o estado
ativo/pausado que ele mesmo escolheu. O cliente NÃO cadastra agente: a lista sai
do `default_agents` do DNA (curadoria da Freitas) e ele só decide quais desses
entram nas próximas solicitações de cotação. Marketplace aberto foi descartado.

A união é sobre TODOS os DNAs do cliente (um por operação, importação e
exportação), não só o de importação: a tela é da conta, não de uma cotação, e um
cliente que só exporta veria uma lista vazia se filtrássemos por IMPORTACAO.

Uso do plano ("N de X agentes"): devolvemos apenas o N real (`active_count` /
`total_count`). NÃO existe modelo de planos no schema, então `plan_limit` e
`plan_name` saem nulos e a tela desenha "Pendente integração" no lugar do
limite — nenhum "10" nem "Plano Free" inventado aqui.

Status codes:
    200 — { items: [...], active_count, total_count, plan_limit, plan_name }
    401 — JWT ausente
    403 — não é usuário de portal
    500 — erro interno
"""

from shared.database.connection import get_session
from shared.database.repositories import (
    client_dna_repository,
    portal_client_preferences_repository,
)
from shared.domain.portal_rfq import load_eligible_agents, resolve_eligible_agent_ids
from shared.lambda_helpers import build_response
from shared.observability import logger, tracer
from shared.portal_agent_helpers import serialize_agent_for_portal
from shared.portal_helpers import get_portal_client_id


@tracer.capture_lambda_handler
@logger.inject_lambda_context(correlation_id_path="requestContext.requestId")
def lambda_handler(event, context):
    try:
        with get_session() as session:
            client_id, err = get_portal_client_id(event, session)
            if err:
                return err

            agents = _eligible_agents_for_client(session, client_id)

            prefs = portal_client_preferences_repository.get_by_client(
                session, client_id
            )
            paused = set(
                portal_client_preferences_repository.resolve_paused_agent_ids(prefs)
            )

            items = [
                serialize_agent_for_portal(a, paused=str(a.id) in paused)
                for a in agents
            ]

        active_count = sum(1 for i in items if i["active"])
        return build_response(200, {
            "items": items,
            "total_count": len(items),
            "active_count": active_count,
            # Sem model de planos no schema. Nulo é a resposta honesta; a tela
            # troca por "Pendente integração".
            "plan_limit": None,
            "plan_name": None,
        })

    except Exception:
        logger.exception("Unhandled error in list_my_agents")
        return build_response(500, {"error": "Internal server error"})


def _eligible_agents_for_client(session, client_id) -> list:
    """Agentes pré-aprovados somando os DNAs de todas as operações do cliente.

    `load_eligible_agents` recebe um DNA por vez, então a união é feita aqui —
    de-duplicada por id, preservando a ordem em que a Freitas cadastrou.
    """
    seen: set[str] = set()
    agents: list = []
    for dna in client_dna_repository.get_all_by_client(session, client_id):
        if not resolve_eligible_agent_ids(dna):
            continue
        for agent in load_eligible_agents(session, dna):
            key = str(agent.id)
            if key not in seen:
                seen.add(key)
                agents.append(agent)
    return agents
