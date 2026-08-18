"""Origem da cotação aberta pelo portal — de onde veio o clique.

Por que existe
--------------
O Radar de Preços (Inteligência > Radar de Preços) foi modelado com dado
simulado para validar o VALOR da proposta com dois ou três clientes antes de
puxar dado real do Data Lake. Validar exige contar: "quantas cotações este
cliente abriu porque o Radar mostrou uma janela?". Até aqui o CTA "Cotar agora"
pré-preenchia o formulário e não deixava rastro nenhum — a cotação nascia
idêntica a uma digitada do zero, e a pergunta acima não teria resposta um mês
depois.

Duas dimensões, não uma
-----------------------
"Veio do portal" já existe e continua intocado: é o log
`quotation_created_by_portal`, que `batch_fetch_created_by_portal` lê e que vira
a tag "Portal" no Kanban do analista. Este módulo acrescenta uma SEGUNDA
dimensão — "veio especificamente do Radar" — sem substituir a primeira. Uma
cotação de Radar é portal E radar, e nenhuma consulta existente muda de
resultado por causa dela.

Por que log e não coluna
------------------------
Origem é fato do momento da criação, não atributo mutável da cotação — mesma
natureza de `quotation_created_by_portal`, que também é log e não coluna. Seguir
o idioma que já existe traz três coisas de graça: nenhuma migração, agregação
por SQL comum sobre `centrix_quotation_logs` (contável e filtrável por período,
por cliente e por rota — era o pedido de "não fechar a porta") e a garantia de
que ninguém sobrescreve a origem depois, porque log não é reescrito.

Por que em `app/` e não no handler
----------------------------------
`create_my_quotation` é copiado do Centrix (ver CLAUDE.md). O router chama este
módulo num segundo passo, o mesmo arranjo de `app/quotation_exporter.py`.

Por que `portal_origin` e não `origin`
--------------------------------------
`origin` JÁ É campo de cotação no Centrix: o local de coleta ("Shanghai,
China"). Aceitar `origin: "radar_precos"` no mesmo payload colidiria com um
campo de negócio existente.
"""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.event_shim import DEMO_SUB
from shared.database.connection import get_session
from shared.database.models.quotation.quotation_log import QuotationLog
from shared.database.repositories import quotation_repository
from shared.observability import logger

# Ação do log. Nome próprio, não reaproveita `quotation_created_by_portal`:
# reaproveitar faria `batch_fetch_created_by_portal` contar a cotação duas vezes.
ACTION_QUOTATION_PORTAL_ORIGIN = "quotation_portal_origin"

# Lista FECHADA de origens. Mesma disciplina de `update_my_preferences`: o valor
# vem do corpo da requisição, que é público, e origem desconhecida é ignorada em
# silêncio em vez de virar uma categoria nova no relatório de amanhã.
ORIGIN_RADAR = "radar_precos"
PORTAL_ORIGINS = frozenset({ORIGIN_RADAR})

# A rota é rótulo livre vindo do cliente ("Gênova → Santos"). Guardada como
# etiqueta opaca, só para responder "qual rota gerou o clique" — nunca é lida de
# volta como par de portos, que continua sendo os campos de porto da cotação.
_MAX_ROUTE_LEN = 120


def record_origin(
    quotation_id: str, origin: str | None, route: str | None = None
) -> dict | None:
    """Registra a origem da cotação recém-criada. Devolve o que foi gravado.

    Devolve None — sem levantar — quando não há o que gravar: origem ausente ou
    fora da lista fechada, id malformado, cotação inexistente, ou origem já
    registrada. A cotação já foi criada com sucesso nesse ponto, e um rastro de
    origem que falha não pode transformar um 201 em erro.
    """
    if origin not in PORTAL_ORIGINS:
        return None

    try:
        qid = uuid.UUID(quotation_id)
    except (ValueError, AttributeError, TypeError):
        logger.warning("portal_origin_invalid_uuid")
        return None

    label = route.strip()[:_MAX_ROUTE_LEN] if isinstance(route, str) else None

    with get_session() as session:
        if quotation_repository.get(session, qid) is None:
            return None

        # Idempotente: a origem é do nascimento da cotação e só pode ser dita uma
        # vez. Um retry do cliente não pode dobrar a contagem do relatório.
        if fetch_origins(session, [qid]):
            return None

        quotation_repository.append_log(
            session,
            quotation_id=qid,
            action=ACTION_QUOTATION_PORTAL_ORIGIN,
            user_id=DEMO_SUB,
            details={"origin": origin, "route": label},
        )

    logger.info("quotation_portal_origin_recorded", extra={"origin": origin})
    return {"origin": origin, "route": label}


def fetch_origins(
    session: Session, quotation_ids: list[uuid.UUID]
) -> dict[uuid.UUID, dict]:
    """Origem de cada cotação da lista que tenha uma. Sem entrada = sem origem.

    Contrapartida de `batch_fetch_created_by_portal` — é esta a consulta que o
    serializer do Kanban precisa do lado do Centrix para acender o indicador do
    card, e é ela que um relatório de "cotações por origem" agrega.
    """
    if not quotation_ids:
        return {}
    rows = session.execute(
        select(QuotationLog.quotation_id, QuotationLog.details)
        .where(QuotationLog.quotation_id.in_(quotation_ids))
        .where(QuotationLog.action == ACTION_QUOTATION_PORTAL_ORIGIN)
        .order_by(QuotationLog.created_at)
    ).all()
    return {
        qid: {"origin": (details or {}).get("origin"), "route": (details or {}).get("route")}
        for qid, details in rows
        if (details or {}).get("origin") in PORTAL_ORIGINS
    }


def annotate(quotations: list[dict]) -> None:
    """Anota `portal_origin` / `portal_origin_route` nos dicts de cotação, in-place.

    Campo ADITIVO: quem não tem origem sai exatamente como saía antes, sem chave
    nova. É o que mantém a resposta do portal idêntica para as outras nove
    cotações e evita que "sem origem" precise de um valor para significar nada.
    """
    ids: dict[uuid.UUID, list[dict]] = {}
    for item in quotations:
        try:
            qid = uuid.UUID(str(item.get("id")))
        except (ValueError, AttributeError, TypeError):
            continue
        ids.setdefault(qid, []).append(item)

    if not ids:
        return

    with get_session() as session:
        origins = fetch_origins(session, list(ids))

    for qid, entry in origins.items():
        for item in ids.get(qid, []):
            item["portal_origin"] = entry["origin"]
            if entry["route"]:
                item["portal_origin_route"] = entry["route"]
