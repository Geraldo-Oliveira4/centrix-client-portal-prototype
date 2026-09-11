"""Layout da Home do Portal do Cliente — temas e cards escolhidos pelo cliente.

ISTO E PRODUCAO desde 11/09/2026. Nasceu como experimento numa rota separada
(`/portal/home-personalizada`) e, na mesma data, a Home personalizavel
SUBSTITUIU a Home fixa: `/portal/home` le daqui, e sem linha nesta tabela o
cliente cai no onboarding em vez de ver a tela. O nome do arquivo (e o da
tabela, e o do endpoint) guarda a origem experimental — renomear os tres exigiria
migracao e uma rota nova em producao, e nao ha ganho funcional nisso.

A via de volta para a Home fixa nao passa por aqui: ela e
`frontend/app/portal/home/page.tsx.bak-1b`, com o commit anterior a troca
anotado no topo do `page.tsx` novo.

POR QUE EM `app/` E NAO EM `lambdas/client_portal/`
--------------------------------------------------
Herdado da origem, e mantido de propósito: `lambdas/client_portal/` guarda os
handlers COPIADOS do Centrix e os poucos portados que espelham handlers de la.
Este nao tem contrapartida nenhuma no Centrix — a Home do cliente e invencao
deste repo — e o resto da camada de adaptacao (`agent_pause`, `quotation_origin`,
`prototype_flow`) ja mora aqui pelo mesmo motivo.

Pela mesma razao o MODEL vive aqui e nao em `shared/database/models/`: `shared/`
espelha o Centrix e cada arquivo novo la e uma divergencia a mais para um futuro
re-sync.

O QUE ESTE ENDPOINT NAO E
-------------------------
Nao e `PUT /portal/preferences`. A tabela da migracao 094 guarda preferencia
operacional com efeito (prometido) sobre a proxima cotacao, e o handler dela tem
uma lista fechada de campos que sustenta a regra de o cliente nao editar dado
interno da Freitas. Este aqui guarda layout de tela. Nenhuma linha de codigo e
compartilhada entre os dois, de proposito — `H8` no e2e trava a fronteira.

VOCABULARIO RENOMEADO EM 11/09/2026
-----------------------------------
Os temas se chamavam `alertas` / `mapa_mundi` / `inteligencia` e passaram a
`acao` / `mapa` / `custos`. "Inteligencia" saiu porque colide com a aba de
navegacao de mesmo nome. A tabela estava VAZIA em todos os bancos quando a troca
aconteceu, entao nao houve migracao de dado; o frontend ainda assim descarta tema
desconhecido (`knownThemes`) e reabre o onboarding, porque uma linha gravada com
o vocabulario velho nao pode virar uma Home vazia sem saida.

LISTA FECHADA, MESMA DISCIPLINA DO RESTO DO PORTAL
--------------------------------------------------
Tema e card desconhecidos sao rejeitados com 400, e nao ignorados em silencio
como faz `update_my_preferences`. A diferenca e deliberada: la o silencio
protege contra o cliente escrever campo que nao e dele; aqui um card invalido
gravado viraria um `undefined` no registro do frontend e a tela quebraria no
render. O corpo vem da propria tela, entao um valor fora da lista e bug, nao
tentativa — e bug deve falhar alto.

Status codes:
    GET    200 — { layout: {...} } ou { layout: null } (nunca onboardou)
    PUT    200 — { layout: {...} }
    PUT    400 — tema/card fora da lista, nenhum tema, ou mais de tres
    DELETE 200 — { layout: null } (reset: apaga a linha e reabre o onboarding)
    401/403/500 — como em qualquer handler do portal
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from shared.database.connection import get_session
from shared.database.models.base import Base
from shared.lambda_helpers import build_response, parse_body
from shared.observability import logger
from shared.portal_helpers import get_portal_client_id

# Os tres temas do onboarding. Espelho EXATO de `PortalHomeTheme` em
# `frontend/app/portal/home/lib/home-layout.ts` — as duas listas
# tem de andar juntas, e e por isso que a checagem e2e compara as duas pontas.
THEMES = ("acao", "mapa", "custos")

# Tema -> cards. Espelho de `PORTAL_HOME_LAYOUT_CARDS` do mesmo arquivo.
#
# O backend guarda esta tabela para VALIDAR (um card so pode ser ligado se o
# tema dele foi escolhido), nao para servi-la: quem monta a tela e o registro do
# frontend, que e quem conhece os componentes.
THEME_CARDS = {
    "acao": ("acao_urgente",),
    "mapa": ("mapa_embarques",),
    "custos": ("economia", "tendencia_preco"),
}

CARDS = tuple(card for cards in THEME_CARDS.values() for card in cards)

# Ate tres, que e o numero de temas que existem hoje. A constante fica aqui e no
# frontend porque as duas pontas precisam dela; o teto e do produto, nao do
# tamanho da lista — se um quarto tema entrar, este numero nao muda sozinho.
MAX_THEMES = 3


class PortalHomeLayoutExperiment(Base):
    """Uma linha por cliente. Ausencia de linha = nunca onboardou."""

    __tablename__ = "centrix_portal_home_layout_experiment"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("centrix_quotation_clients.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    themes: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    enabled_cards: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


def _get_row(session, client_id: uuid.UUID):
    return (
        session.query(PortalHomeLayoutExperiment)
        .filter(PortalHomeLayoutExperiment.client_id == client_id)
        .one_or_none()
    )


def _serialize(row) -> Optional[dict]:
    """None vira None, e nao um layout vazio: "nunca escolheu" e "escolheu e
    desligou tudo" sao estados diferentes, e so o primeiro reabre o onboarding.
    """
    if row is None:
        return None
    return {
        "themes": list(row.themes or []),
        "enabled_cards": list(row.enabled_cards or []),
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def get_layout(event, context):
    """GET /portal/home-layout-experiment"""
    try:
        with get_session() as session:
            client_id, err = get_portal_client_id(event, session)
            if err:
                return err
            payload = _serialize(_get_row(session, client_id))
        return build_response(200, {"layout": payload})
    except Exception:
        logger.exception("Unhandled error in get_layout (home layout experiment)")
        return build_response(500, {"error": "Internal server error"})


def put_layout(event, context):
    """PUT /portal/home-layout-experiment

    Grava o layout INTEIRO, nao um delta: o onboarding e o modal "Personalizar"
    sempre mandam os dois campos juntos. Um PATCH aqui permitiria gravar um card
    cujo tema acabou de sair da lista, e o par (temas, cards) so e coerente se
    for validado de uma vez.
    """
    try:
        body, err = parse_body(event)
        if err:
            return err

        themes, err = _validate_themes(body.get("themes"))
        if err:
            return err

        cards, err = _validate_cards(body.get("enabled_cards"), themes)
        if err:
            return err

        with get_session() as session:
            client_id, err = get_portal_client_id(event, session)
            if err:
                return err

            row = _get_row(session, client_id)
            if row is None:
                row = PortalHomeLayoutExperiment(client_id=client_id)
                session.add(row)
            row.themes = themes
            row.enabled_cards = cards
            row.updated_at = datetime.now(timezone.utc)
            session.flush()
            payload = _serialize(row)

        return build_response(200, {"layout": payload})
    except Exception:
        logger.exception("Unhandled error in put_layout (home layout experiment)")
        return build_response(500, {"error": "Internal server error"})


def delete_layout(event, context):
    """DELETE /portal/home-layout-experiment — "Refazer personalizacao do zero".

    APAGA A LINHA, nao zera os campos. Uma linha com `themes: []` continuaria
    dizendo "este cliente ja onboardou", e o onboarding nunca mais abriria — que
    e exatamente o que o botao de reset promete fazer.
    """
    try:
        with get_session() as session:
            client_id, err = get_portal_client_id(event, session)
            if err:
                return err
            row = _get_row(session, client_id)
            if row is not None:
                session.delete(row)
        return build_response(200, {"layout": None})
    except Exception:
        logger.exception("Unhandled error in delete_layout (home layout experiment)")
        return build_response(500, {"error": "Internal server error"})


def _validate_themes(raw):
    if not isinstance(raw, list):
        return None, build_response(400, {"error": "Field 'themes' must be a list"})

    seen: set[str] = set()
    themes: list[str] = []
    for value in raw:
        key = str(value).strip()
        if not key or key in seen:
            continue
        if key not in THEMES:
            return None, build_response(400, {"error": f"Unknown theme '{key}'"})
        seen.add(key)
        themes.append(key)

    if not themes:
        return None, build_response(400, {"error": "Choose at least one theme"})
    if len(themes) > MAX_THEMES:
        return None, build_response(
            400, {"error": f"Choose at most {MAX_THEMES} themes"}
        )
    return themes, None


def _validate_cards(raw, themes: list[str]):
    """Card so entra se o tema dele foi escolhido.

    Sem esta checagem daria para gravar `mapa_embarques` sem o tema `mapa_mundi`:
    o card ficaria salvo e invisivel, e reapareceria sozinho no dia em que o
    cliente escolhesse o tema. Fantasma de estado, nao funcionalidade.
    """
    allowed = {card for theme in themes for card in THEME_CARDS[theme]}

    # Ausente (ou null) = "liga tudo do que eu escolhi", que e o que o onboarding
    # quer dizer. Lista VAZIA e diferente: e o cliente desligando todos os cards
    # no modal "Personalizar", e a tela tem um estado proprio para isso.
    if raw is None:
        return sorted(allowed), None
    if not isinstance(raw, list):
        return None, build_response(
            400, {"error": "Field 'enabled_cards' must be a list or null"}
        )

    seen: set[str] = set()
    cards: list[str] = []
    for value in raw:
        key = str(value).strip()
        if not key or key in seen:
            continue
        if key not in CARDS:
            return None, build_response(400, {"error": f"Unknown card '{key}'"})
        if key not in allowed:
            return None, build_response(
                400, {"error": f"Card '{key}' does not belong to the chosen themes"}
            )
        seen.add(key)
        cards.append(key)

    return cards, None
