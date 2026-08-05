"""update_my_preferences — PUT /portal/preferences

HANDLER NOVO DO PROTÓTIPO — não existe no Centrix (ver `get_my_preferences`).

Grava o que o cliente edita em "Minhas Preferências" e o toggle ativo/pausado de
"Meus Agentes". PATCH semântico: só as chaves presentes no corpo são gravadas,
para a tela de agentes não zerar o porto preferido salvo na outra tela.

REGRA QUE SUSTENTA O TOGGLE: um id em `paused_agent_ids` só é aceito se estiver
na lista pré-aprovada pela Freitas (`default_agents` do DNA). Sem isso o cliente
poderia pausar qualquer UUID e a lista viraria um cadastro de agente pelas
costas — justamente o que a REGRA GERAL 2 proíbe. Id fora da lista -> 400.

O que este handler NÃO aceita, por decisão de escopo: contatos internos da
Freitas, acordos comerciais e restrições contratuais. Esses campos do DNA
continuam exclusivos do lado do analista e sequer aparecem no corpo aceito aqui.

Body (todas as chaves opcionais):
    {
        "paused_agent_ids": ["<uuid>", ...],
        "preferred_port": "<str|null, max 255>",
        "default_incoterm": "<str|null, max 32>",
        "uses_insurance": true | false | null,
        "cargo_particularities": "<str|null, max 2000>"
    }

Status codes:
    200 — { preferences: {...} }
    400 — corpo inválido, campo longo demais ou agente fora da lista pré-aprovada
    401 — JWT ausente
    403 — não é usuário de portal
    500 — erro interno
"""

from shared.database.connection import get_session
from shared.database.repositories import (
    client_dna_repository,
    portal_client_preferences_repository,
)
from shared.domain.portal_rfq import resolve_eligible_agent_ids
from shared.lambda_helpers import build_response, parse_body
from shared.observability import logger, tracer
from shared.portal_agent_helpers import serialize_preferences_for_portal
from shared.portal_helpers import get_portal_client_id

_MAX_PORT = 255
_MAX_INCOTERM = 32
_MAX_PARTICULARITIES = 2000

_TEXT_FIELDS = (
    ("preferred_port", _MAX_PORT),
    ("default_incoterm", _MAX_INCOTERM),
    ("cargo_particularities", _MAX_PARTICULARITIES),
)


@tracer.capture_lambda_handler
@logger.inject_lambda_context(correlation_id_path="requestContext.requestId")
def lambda_handler(event, context):
    try:
        body, err = parse_body(event)
        if err:
            return err

        with get_session() as session:
            client_id, err = get_portal_client_id(event, session)
            if err:
                return err

            fields, err = _collect_fields(session, client_id, body)
            if err:
                return err

            prefs = portal_client_preferences_repository.upsert_for_client(
                session, client_id, **fields
            )
            paused = portal_client_preferences_repository.resolve_paused_agent_ids(
                prefs
            )
            payload = serialize_preferences_for_portal(prefs, paused)

        return build_response(200, {"preferences": payload})

    except Exception:
        logger.exception("Unhandled error in update_my_preferences")
        return build_response(500, {"error": "Internal server error"})


def _collect_fields(session, client_id, body: dict):
    """Valida o corpo e devolve (fields_a_gravar, erro_ou_None)."""
    fields: dict = {}

    for name, max_len in _TEXT_FIELDS:
        if name not in body:
            continue
        raw = body[name]
        if raw is None:
            fields[name] = None
            continue
        if not isinstance(raw, str):
            return None, build_response(
                400, {"error": f"Field '{name}' must be a string or null"}
            )
        value = raw.strip()
        if len(value) > max_len:
            return None, build_response(
                400, {"error": f"Field '{name}' exceeds {max_len} characters"}
            )
        # String vazia vira NULL: o frontend manda '' para campo limpo, e ''
        # gravado leria como "o cliente declarou vazio".
        fields[name] = value or None

    if "uses_insurance" in body:
        raw = body["uses_insurance"]
        if raw is not None and not isinstance(raw, bool):
            return None, build_response(
                400, {"error": "Field 'uses_insurance' must be a boolean or null"}
            )
        fields["uses_insurance"] = raw

    if "paused_agent_ids" in body:
        paused, err = _validate_paused_agents(session, client_id, body["paused_agent_ids"])
        if err:
            return None, err
        fields["paused_agent_ids"] = paused

    return fields, None


def _validate_paused_agents(session, client_id, raw):
    """Só agentes da lista pré-aprovada podem ser pausados (ver docstring)."""
    if raw is None:
        return [], None
    if not isinstance(raw, list):
        return None, build_response(
            400, {"error": "Field 'paused_agent_ids' must be a list"}
        )

    eligible: set[str] = set()
    for dna in client_dna_repository.get_all_by_client(session, client_id):
        eligible.update(resolve_eligible_agent_ids(dna))

    seen: set[str] = set()
    normalised: list[str] = []
    for value in raw:
        key = str(value).strip()
        if not key or key in seen:
            continue
        if key not in eligible:
            return None, build_response(
                400,
                {"error": "Agent is not in the list pre-approved for this client"},
            )
        seen.add(key)
        normalised.append(key)

    return normalised, None
