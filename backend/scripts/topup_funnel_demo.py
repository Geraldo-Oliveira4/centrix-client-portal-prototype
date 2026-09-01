"""Top-up: sete cotacoes que enchem as tres colunas do Funil de Cotacoes.

Por que este script existe
--------------------------
O Funil tem tres colunas e o seed deixa duas delas com dois cards e uma com um.
Para a demo desta semana o cliente pediu volume nas tres, e — mais importante —
pediu que a coluna "Escolha sua proposta" exercite os TRES ramos do bloco
"Mercado" da Comparacao de Propostas, que hoje a demo so mostra em parte.

Os tres ramos vivem em `RouteTrendSection`
(`frontend/app/portal/inteligencia/components/market-block.tsx`) e sao mutuamente
exclusivos, nesta ordem de precedencia:

  1. TENDENCIA      `findQuotationRadarRoute` acha a rota no Radar de Precos.
  2. HISTORICO      nao acha, mas `findRouteQuotationHistory` encontra cotacoes
                    FECHADAS do cliente na mesma rota (plural a partir de duas).
  3. AUSENCIA PURA  nao acha nenhum dos dois: a frase que explica a ausencia.

O ramo 3 nunca apareceu numa demo. O ramo 2 so passou a existir em 28/08/2026
(`topup_route_history_demo.py`). Este script cria uma cotacao ABERTA em cada um
dos tres, para os tres poderem ser mostrados lado a lado.

Como as rotas foram escolhidas (e por que nenhuma delas e chutada)
------------------------------------------------------------------
Igual ao `topup_route_history_demo.py`: a rota vem do BANCO, copiada byte a byte
de uma cotacao que ja existe, nunca reescrita aqui. Copiar a ENTRADA e o que
garante a mesma chave normalizada sem reimplementar em Python a
`quotationRadarRoute` do frontend — uma segunda normalizacao erraria calada no
destino nao nomeado, que e o caso da maioria das cotacoes deste banco.

  - Ramo 1: copia a rota de `--radar-host`, que precisa ser uma cotacao cuja rota
    esteja entre as SEIS que `computePriceRadar` devolve. Qual e essa cotacao NAO
    esta chumbada aqui de proposito: o Radar indexa EMBARQUES, e o conjunto de
    embarques muda a cada top-up de tracking. Rode o harness (abaixo) contra o
    banco alvo e passe a referencia que ele imprimir.
  - Ramo 2: copia a rota de `HISTORY_HOST_REFERENCE` (COT-2026-0009, Izmir ->
    Santos), a mesma rota onde `topup_route_history_demo.py` deixou duas
    FECHADAS. Duas e o que faz a manchete sair no PLURAL.
  - Ramo 3: rota nova, escrita aqui porque nao existe de onde copiar — e o script
    VERIFICA as duas condicoes no banco antes de inserir (nenhuma FECHADA na
    origem, e nenhum embarque que resolva para ela).

Como reconferir as rotas (harness, funcoes reais da tela)
----------------------------------------------------------
Com um backend de pe apontando para o banco alvo:

    curl -s localhost:8000/portal/quotations > /tmp/q.json
    curl -s localhost:8000/portal/shipments  > /tmp/s.json
    cd frontend && node /caminho/radar-check.mts /tmp/q.json /tmp/s.json

Ele importa `computePriceRadar`, `findQuotationRadarRoute` e
`findRouteQuotationHistory` dos arquivos do portal (nao reimplementa nada) e
imprime as rotas do Radar e o ramo em que cada cotacao cai. Rode DE NOVO depois
do `--apply`: as seis rotas do Radar tem de ser as MESMAS.

Por que a composicao do Radar nao pode mudar
---------------------------------------------
`computePriceRadar` agrupa por EMBARQUE e so resolve a rota de cada um via
`shipment.quotation_id`. Este script faz INSERT direto, que nao passa pelo
`quotation_state_machine`, entao nao ha `provision_processo_from_quotation` e
nenhum embarque nasce. Nenhuma cotacao criada aqui e FECHADA, que e a transicao
que provisionaria um. A invariancia e estrutural — o que nao dispensa reconferir.

Contrato de seguranca
---------------------
- Somente INSERT. Nenhum UPDATE, DELETE ou TRUNCATE em lugar nenhum.
- Dry-run por padrao: sem `--apply` a transacao termina em ROLLBACK.
- Nao toca em nenhuma cotacao existente.
- Referencias geradas pelo REPOSITORIO (`_generate_reference`), nunca chumbadas.
- Idempotente pelo EFEITO: aborta se o cliente ja tiver cotacao ABERTA na rota
  do ramo 3, que e a condicao que este script existe para criar.
- Confere os deltas de linha antes de commitar; delta inesperado vira ROLLBACK
  mesmo com `--apply`.
- Imprime o HOST do banco alvo antes de qualquer coisa (pratica firmada depois
  do ef1e828, em que um top-up rodou contra um Postgres local sem ninguem notar).

Uso (a partir de backend/):
    .venv/bin/python -m scripts.topup_funnel_demo --radar-host COT-2026-000X
    .venv/bin/python -m scripts.topup_funnel_demo --radar-host COT-2026-000X --apply
"""

import argparse
import sys
import urllib.parse
import uuid
from datetime import timedelta, datetime, timezone

from dotenv import load_dotenv

load_dotenv()

import os

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from shared.database.connection import get_engine
from shared.database.models.quotation.client import QuotationClient
from shared.database.models.quotation.enums import (
    Currency,
    Modal,
    QuotationState,
    RouteType,
    ServiceType,
    TipoEmbarque,
)
from shared.database.models.quotation.freight_agent import FreightAgent
from shared.database.models.quotation.proposal import Proposal
from shared.database.models.quotation.proposal_score import ProposalScore
from shared.database.models.quotation.quotation import Quotation
from shared.database.models.quotation.quotation_log import QuotationLog
from shared.database.models.shipment.embarque import Embarque
from shared.database.models.shipment.processo import Processo
from shared.database.repositories import quotation_repository

DEMO_CLIENT_NAME = "CLIENTE DEMO"
DEMO_SUB = "demo-portal-user-sub"

# Ramo 2: a rota com duas FECHADAS, deixada por topup_route_history_demo.py.
HISTORY_HOST_REFERENCE = "COT-2026-0009"

# Ramo 3: rota nova. Qingdao nao e origem de nenhuma cotacao do seed e nao esta
# em ILLUSTRATIVE_HUBS (port-coordinates.ts) — os dois jeitos de um embarque
# resolver para uma rota. As duas condicoes sao VERIFICADAS abaixo, nao supostas.
ABSENT_ROUTE_ORIGIN = "Qingdao, China"

# Colunas do Funil (types/portal.ts::PORTAL_BUCKET_LABELS):
#   AGUARDANDO_DADOS -> "Preencher detalhes"
#   COTANDO          -> "Aguardando agentes"
#   ENVIADA_CLIENTE  -> "Escolha sua proposta"
#
# (produto, PO, origem, incoterm, tipo_embarque, dias_atras)
FILL_DETAILS = (
    ("Perfis de aluminio anodizado", "PO-2026-1190", "Valencia, Spain", "CIF", TipoEmbarque.FCL, 3),
    ("Resinas plasticas em big bag", "PO-2026-1191", "Antwerpen, Belgium", "EXW", TipoEmbarque.LCL, 5),
)

# (produto, PO, origem, incoterm, dias_atras, tem_proposta)
# Uma com proposta recebida e outra sem — a mistura que a coluna ja tem hoje.
AWAITING_AGENTS = (
    ("Rolamentos industriais", "PO-2026-1192", "Ningbo, China", "FOB", 4, True),
    ("Vidro plano temperado", "PO-2026-1193", "Ho Chi Minh, Vietnam", "FCA", 2, False),
)

# Ramo -> (produto, PO, incoterm, dias_atras). A ROTA nao esta aqui: vem do banco.
CHOOSE_PROPOSAL = {
    "tendencia": ("Motores eletricos trifasicos", "PO-2026-1194", "FOB", 6),
    "historico": ("Chapas de aco galvanizado", "PO-2026-1195", "CIF", 4),
    "ausencia": ("Ceramica tecnica industrial", "PO-2026-1196", "FOB", 2),
}

# Deltas exatos que este script pode causar. Qualquer coisa fora disso e bug.
#   Quotation    7 = 2 + 2 + 3
#   Proposal     7 = 1 (a de "aguardando agentes") + 2 para cada uma das 3
#   QuotationLog 7 = um "created" por cotacao
EXPECTED_DELTAS = {
    Quotation: 7,
    Proposal: 7,
    QuotationLog: 7,
    ProposalScore: 0,
    Processo: 0,
    Embarque: 0,
    QuotationClient: 0,
    FreightAgent: 0,
}


def _counts(session):
    return {m: session.execute(select(func.count()).select_from(m)).scalar()
            for m in EXPECTED_DELTAS}


def _print_target_host() -> None:
    """Host do banco alvo, sem a senha. Ver ef1e828."""
    raw = os.environ.get("DATABASE_URL", "")
    p = urllib.parse.urlparse(raw.replace("postgresql+psycopg2://", "postgresql://"))
    print(f"BANCO ALVO: {p.hostname}:{p.port or 5432}{p.path}  user={p.username}\n")


def _host_route(session, client_id, reference: str) -> Quotation:
    """A cotacao de onde a rota e copiada, ja validada."""
    host = session.execute(
        select(Quotation).where(
            Quotation.reference == reference,
            Quotation.client_id == client_id,
        )
    ).scalar_one_or_none()
    if host is None:
        raise SystemExit(f"ABORTADO: {reference} nao existe neste banco. E dela "
                         f"que sai a rota; sem ela nao ha onde ancorar.")
    if not (host.origin or "").strip():
        raise SystemExit(f"ABORTADO: {reference} nao nomeia a origem. Sem origem "
                         f"a cotacao cai na frase de ausencia, nao no ramo certo.")
    return host


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true",
                        help="commita. Sem esta flag o script faz ROLLBACK.")
    parser.add_argument("--radar-host", metavar="COT-YYYY-NNNN",
                        help="cotacao cuja rota esta no top-6 do Radar. "
                             "Obtenha com o harness (ver docstring) — nao chute.")
    args = parser.parse_args()

    if not args.radar_host:
        print("ABORTADO: --radar-host nao informado.\n"
              "A rota do ramo 1 tem de estar entre as SEIS do Radar, e quais sao\n"
              "elas depende dos EMBARQUES do banco alvo — muda a cada top-up de\n"
              "tracking. Rode o harness descrito no docstring contra este banco e\n"
              "passe a referencia que ele imprimir. Este script nao adivinha.")
        return 1

    now = datetime.now(timezone.utc)
    _print_target_host()
    session = Session(get_engine())
    try:
        client = session.execute(
            select(QuotationClient).where(QuotationClient.name == DEMO_CLIENT_NAME)
        ).scalar_one_or_none()
        if client is None:
            print(f"ABORTADO: cliente '{DEMO_CLIENT_NAME}' nao encontrado. Este "
                  f"banco nao foi semeado — rode 'make seed', nao este script.")
            return 1

        radar_host = _host_route(session, client.id, args.radar_host)
        history_host = _host_route(session, client.id, HISTORY_HOST_REFERENCE)

        # Ramo 2 so sai no PLURAL com duas ou mais FECHADAS na rota.
        closed_on_history_route = session.execute(
            select(Quotation.reference).where(
                Quotation.client_id == client.id,
                Quotation.state == QuotationState.FECHADA,
                Quotation.origin == history_host.origin,
            )
        ).scalars().all()
        if len(closed_on_history_route) < 2:
            print(f"ABORTADO: a rota de {HISTORY_HOST_REFERENCE} "
                  f"({history_host.origin!r}) tem {len(closed_on_history_route)} "
                  f"cotacao FECHADA, e o ramo de historico PLURAL precisa de 2+.\n"
                  f"Rode antes: .venv/bin/python -m scripts.topup_route_history_demo --apply")
            return 1

        # Ramo 3, condicao (a): nenhuma FECHADA na origem, senao cai no ramo 2.
        closed_on_absent = session.execute(
            select(Quotation.reference).where(
                Quotation.client_id == client.id,
                Quotation.state == QuotationState.FECHADA,
                Quotation.origin == ABSENT_ROUTE_ORIGIN,
            )
        ).scalars().all()
        if closed_on_absent:
            print(f"ABORTADO: ja existe cotacao FECHADA em {ABSENT_ROUTE_ORIGIN!r} "
                  f"({sorted(closed_on_absent)}). A rota deixou de ser 'sem "
                  f"historico' e o ramo 3 nao apareceria. Escolha outra origem.")
            return 1

        # Ramo 3, condicao (b): nenhum embarque resolve para essa origem — se
        # resolvesse, a rota poderia estar no Radar e o ramo 1 venceria.
        shipped_on_absent = session.execute(
            select(func.count())
            .select_from(Processo)
            .join(Quotation, Processo.quotation_id == Quotation.id)
            .where(Quotation.origin == ABSENT_ROUTE_ORIGIN)
        ).scalar()
        if shipped_on_absent:
            print(f"ABORTADO: existem {shipped_on_absent} processos em "
                  f"{ABSENT_ROUTE_ORIGIN!r}. A rota pode estar no Radar e o ramo 3 "
                  f"nao apareceria. Escolha outra origem.")
            return 1

        # Idempotencia pelo EFEITO: se ja ha cotacao ABERTA na rota do ramo 3,
        # o exemplo ja existe e rodar de novo so empilharia card.
        already = session.execute(
            select(Quotation.reference).where(
                Quotation.client_id == client.id,
                Quotation.origin == ABSENT_ROUTE_ORIGIN,
                Quotation.state == QuotationState.ENVIADA_CLIENTE,
            )
        ).scalars().all()
        if already:
            print(f"ABORTADO: ja existe cotacao em 'Escolha sua proposta' na rota "
                  f"{ABSENT_ROUTE_ORIGIN!r}: {sorted(already)}. Top-up ja aplicado.")
            return 1

        agents = session.execute(select(FreightAgent).limit(3)).scalars().all()
        if len(agents) < 2:
            print(f"ABORTADO: o banco tem {len(agents)} agente(s); sao precisos 2+ "
                  f"para montar as propostas a comparar.")
            return 1

        before = _counts(session)
        print(f"Cliente: {client.name} ({client.id})")
        print(f"Ramo 1 (tendencia) copia de {args.radar_host}: "
              f"origin={radar_host.origin!r} porto_destino={radar_host.porto_destino!r}")
        print(f"Ramo 2 (historico) copia de {HISTORY_HOST_REFERENCE}: "
              f"origin={history_host.origin!r} porto_destino={history_host.porto_destino!r} "
              f"({len(closed_on_history_route)} FECHADAS -> plural)")
        print(f"Ramo 3 (ausencia) rota nova: origin={ABSENT_ROUTE_ORIGIN!r} "
              f"porto_destino=None (0 FECHADAS, 0 processos)")
        print("\nAntes:")
        for m, n in before.items():
            print(f"  {m.__name__:<16} {n}")

        created = []

        def _new_quotation(state, product, po, origin, incoterm, days_ago,
                           *, porto_destino=None, modal=None,
                           tipo_embarque=TipoEmbarque.FCL, **extra):
            created_at = now - timedelta(days=days_ago)
            reference = quotation_repository._generate_reference(session)
            q = Quotation(
                id=uuid.uuid4(),
                reference=reference,
                state=state,
                service_type=ServiceType.IMPORTACAO,
                modal=modal or Modal.MARITIMO,
                tipo_embarque=tipo_embarque,
                origin=origin,
                porto_destino=porto_destino,
                product=product,
                client_id=client.id,
                client_reference=po,
                data_cotacao=created_at.date(),
                desired_deadline=now + timedelta(days=30),
                declared_value=48000.0,
                declared_value_currency=Currency.USD,
                incoterm=incoterm,
                created_at=created_at,
                **extra,
            )
            session.add(q)
            session.flush()
            session.add(QuotationLog(
                id=uuid.uuid4(), quotation_id=q.id, action="created",
                previous_state=None, new_state=state.value, user_id=DEMO_SUB,
                details=None, created_at=created_at,
            ))
            session.flush()
            created.append((reference, state.value, origin, po, product))
            return q, created_at

        def _add_proposal(q, agent, total, freight, transit, received_at):
            session.add(Proposal(
                id=uuid.uuid4(), quotation_id=q.id, agent_id=agent.id,
                total_value=total, freight_value=freight,
                taxes_breakdown={"THC": 180.0, "ISPS": 45.0},
                transit_time=transit, route_type=RouteType.DIRETA,
                carrier="Maersk", validity=(received_at + timedelta(days=20)).date(),
                freight_currency="USD", numero_oferta=f"OF-{str(agent.id)[:4].upper()}",
                frequencia="Semanal", ptax_percentual=2.0, is_winner=False,
                received_at=received_at,
            ))
            session.flush()

        # --- Coluna "Preencher detalhes" -----------------------------------
        for product, po, origin, incoterm, tipo, days_ago in FILL_DETAILS:
            _new_quotation(QuotationState.AGUARDANDO_DADOS, product, po, origin,
                           incoterm, days_ago, tipo_embarque=tipo)

        # --- Coluna "Aguardando agentes" -----------------------------------
        for product, po, origin, incoterm, days_ago, has_proposal in AWAITING_AGENTS:
            q, created_at = _new_quotation(QuotationState.COTANDO, product, po,
                                           origin, incoterm, days_ago)
            if has_proposal:
                _add_proposal(q, agents[0], 3450.0, 2980.0, 31,
                              created_at + timedelta(days=1))

        # --- Coluna "Escolha sua proposta" (os tres ramos) -----------------
        branch_route = {
            "tendencia": (radar_host.origin, radar_host.porto_destino, radar_host.modal),
            "historico": (history_host.origin, history_host.porto_destino, history_host.modal),
            "ausencia": (ABSENT_ROUTE_ORIGIN, None, Modal.MARITIMO),
        }
        for branch, (product, po, incoterm, days_ago) in CHOOSE_PROPOSAL.items():
            origin, porto_destino, modal = branch_route[branch]
            q, created_at = _new_quotation(
                QuotationState.ENVIADA_CLIENTE, product, po, origin, incoterm,
                days_ago, porto_destino=porto_destino, modal=modal,
                sent_at=now - timedelta(days=max(days_ago - 2, 1)),
            )
            # Duas propostas: a coluna se chama "Escolha sua proposta", e com uma
            # so nao ha escolha. Nenhuma e vencedora — a escolha e do cliente.
            _add_proposal(q, agents[0], 3980.0, 3410.0, 29, created_at + timedelta(days=1))
            _add_proposal(q, agents[1], 4310.0, 3720.0, 25, created_at + timedelta(days=2))

        # --- Verificacao dos deltas ----------------------------------------
        after = _counts(session)
        print("\nDepois (delta):")
        ok = True
        for m, expected in EXPECTED_DELTAS.items():
            got = after[m] - before[m]
            flag = "" if got == expected else "  <-- INESPERADO"
            if got != expected:
                ok = False
            print(f"  {m.__name__:<16} {after[m]}  ({got:+d}, esperado {expected:+d}){flag}")

        if not ok:
            session.rollback()
            print("\nROLLBACK: deltas divergem do esperado. Nada foi gravado.")
            return 1

        print("\nCotacoes novas:")
        for reference, state, origin, po, product in created:
            print(f"  {reference}  {state:<18} {origin:<22} {po}  {product}")

        if args.apply:
            session.commit()
            print("\nCOMMIT. Top-up aplicado.")
            print("Reconfira o Radar com o harness: as 6 rotas tem de ser as mesmas.")
        else:
            session.rollback()
            print("\nROLLBACK (dry-run). Nada foi gravado. "
                  "Rode com --apply para gravar.")
        return 0

    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    sys.exit(main())
