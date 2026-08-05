"""get_my_preferences — GET /portal/preferences

HANDLER NOVO DO PROTÓTIPO — não existe no Centrix, onde o perfil da operação é o
DNA do Cliente e só o analista o edita.

Devolve o que o CLIENTE declarou sobre a própria operação (tela "Minhas
Preferências") mais a lista de agentes que ele pausou (tela "Meus Agentes" — é a
mesma coluna, ver migração 094).

Cliente sem linha na tabela é o caso normal, não erro: responde 200 com todos os
campos nulos e `paused_agent_ids: []`. Um 404 aqui obrigaria a tela a tratar
"nunca editei nada" como falha.

Preferências de NOTIFICAÇÃO não estão aqui de propósito: o feed de alertas do
portal é ilustrativo e montado no frontend, então as quatro chaves continuam em
localStorage, compartilhadas entre Meus Embarques > Alertas e esta tela. Criar
coluna para elas daria ao cliente a impressão de que a Freitas passa a disparar
e-mail/push a partir dessa escolha, o que não acontece.

Status codes:
    200 — { preferences: {...} }
    401 — JWT ausente
    403 — não é usuário de portal
    500 — erro interno
"""

from shared.database.connection import get_session
from shared.database.repositories import portal_client_preferences_repository
from shared.lambda_helpers import build_response
from shared.observability import logger, tracer
from shared.portal_agent_helpers import serialize_preferences_for_portal
from shared.portal_helpers import get_portal_client_id


@tracer.capture_lambda_handler
@logger.inject_lambda_context(correlation_id_path="requestContext.requestId")
def lambda_handler(event, context):
    try:
        with get_session() as session:
            client_id, err = get_portal_client_id(event, session)
            if err:
                return err

            prefs = portal_client_preferences_repository.get_by_client(
                session, client_id
            )
            paused = portal_client_preferences_repository.resolve_paused_agent_ids(
                prefs
            )
            payload = serialize_preferences_for_portal(prefs, paused)

        return build_response(200, {"preferences": payload})

    except Exception:
        logger.exception("Unhandled error in get_my_preferences")
        return build_response(500, {"error": "Internal server error"})
