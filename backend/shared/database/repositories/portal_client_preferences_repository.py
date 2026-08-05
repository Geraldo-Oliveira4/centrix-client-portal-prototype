"""Preferências do cliente no portal — leitura e upsert escopados ao cliente.

ARQUIVO NOVO DO PROTÓTIPO — não existe no Centrix (ver migração 094 e o model
`PortalClientPreferences`).

Como no `portal_exporter_repository`, o predicado de posse (`client_id`) mora em
toda função daqui, não no chamador: o portal nunca consegue ler ou escrever a
preferência de outro cliente por esquecimento no handler.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from shared.database.models.quotation.portal_client_preferences import (
    PortalClientPreferences,
)


def get_by_client(
    session: Session, client_id: uuid.UUID
) -> Optional[PortalClientPreferences]:
    """A linha deste cliente, ou None. None é o estado normal de quem nunca
    mexeu em nada — não é erro e não deve virar 404 no handler.
    """
    return (
        session.query(PortalClientPreferences)
        .filter(PortalClientPreferences.client_id == client_id)
        .one_or_none()
    )


def resolve_paused_agent_ids(prefs) -> list[str]:
    """Normaliza `paused_agent_ids` numa lista de UUIDs em texto, sem repetição.

    Aceita None (sem linha ou sem nada pausado) e ignora entradas vazias. Espelha
    `resolve_eligible_agent_ids` de `shared/domain/portal_rfq.py`, para as duas
    listas serem comparáveis sem conversão no meio do caminho.
    """
    if prefs is None or not prefs.paused_agent_ids:
        return []
    raw = prefs.paused_agent_ids
    if not isinstance(raw, list):
        return []

    seen: set[str] = set()
    result: list[str] = []
    for value in raw:
        key = str(value).strip()
        if key and key not in seen:
            seen.add(key)
            result.append(key)
    return result


def upsert_for_client(
    session: Session, client_id: uuid.UUID, **fields
) -> PortalClientPreferences:
    """Cria ou atualiza a linha do cliente com os campos informados.

    Só grava as chaves presentes em `fields`: um PATCH que traz apenas
    `paused_agent_ids` não pode zerar o porto preferido que o cliente salvou
    numa outra tela. Chave desconhecida é ignorada em silêncio — o handler já
    valida o corpo, e um typo aqui não deve virar AttributeError em produção.
    """
    prefs = get_by_client(session, client_id)
    if prefs is None:
        prefs = PortalClientPreferences(client_id=client_id)
        session.add(prefs)

    allowed = {
        "paused_agent_ids",
        "preferred_port",
        "default_incoterm",
        "uses_insurance",
        "cargo_particularities",
    }
    for key, value in fields.items():
        if key in allowed:
            setattr(prefs, key, value)

    prefs.updated_at = datetime.now(timezone.utc)
    session.flush()
    return prefs
