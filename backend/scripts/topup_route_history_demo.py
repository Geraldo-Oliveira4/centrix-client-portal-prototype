"""Top-up: duas cotacoes FECHADAS numa rota que o Radar de Precos NAO acompanha.

Por que este script existe
--------------------------
O bloco "Mercado" da Comparacao de Propostas tem dois ramos. Quando a rota da
cotacao esta entre as que o Radar acompanha, ele mostra a tendencia daquela
lane. Quando NAO esta, desde 28/08/2026 ele mostra o historico do proprio
cliente na mesma rota — as cotacoes que ele ja fechou ali, com valor e data
(`frontend/app/portal/inteligencia/lib/route-quotation-history.ts`).

O segundo ramo nao aparece num banco semeado, e a razao e aritmetica: existem
duas cotacoes FECHADA (COT-2026-0001 e COT-2026-0004), elas estao em rotas
diferentes uma da outra, e as duas rotas caem DENTRO do Radar. Nao ha nenhuma
cotacao fechada numa rota de fora, entao a lista nunca tem o que listar e a tela
sempre cai na frase de ausencia. Este script cria exatamente esse par que falta.

Qual rota, e como isso foi confirmado
-------------------------------------
A rota vem do banco, nao daqui: as duas cotacoes novas COPIAM `origin`,
`porto_destino` e `modal` de uma cotacao que ja existe (`HOST_REFERENCE`). Copiar
a entrada e o que garante a MESMA chave normalizada sem reimplementar a
normalizacao em Python — `quotationRadarRoute` e uma funcao do frontend, e uma
segunda versao dela aqui erraria calada justamente no caso mais comum (destino
nao nomeado, que vira "Brasil" e depois porto de chegada).

Que a rota do host cai FORA do Radar foi verificado com as proprias funcoes da
tela (`computePriceRadar` + `findQuotationRadarRoute`) contra a API local, nao
no olho. Para reconferir depois de mexer no seed:

    // com o backend em pe, a partir de frontend/
    import { computePriceRadar } from './app/portal/inteligencia/lib/price-radar.ts';
    import { findQuotationRadarRoute } from './app/portal/inteligencia/lib/quotation-radar-route.ts';
    // findQuotationRadarRoute(cotacaoDoHost, computePriceRadar({shipments, quotations}))
    // precisa devolver null.

O Radar agrupa EMBARQUES, e este script nao cria nenhum (INSERT direto nao passa
pelo state machine, entao nao ha `provision_processo_from_quotation`). Ou seja:
ele nao pode empurrar a rota para dentro do Radar e invalidar o proprio efeito.

Contrato de seguranca
---------------------
- Somente INSERT. Nenhum UPDATE, DELETE ou TRUNCATE em lugar nenhum.
- Dry-run por padrao: sem `--apply` a transacao termina em ROLLBACK.
- Nao toca em COT-2026-0001 nem COT-2026-0004, nem em nenhuma cotacao existente:
  as unicas linhas escritas sao as duas novas e o que pende delas.
- Idempotente pelo EFEITO, nao por referencia: aborta se o cliente ja tiver
  cotacao FECHADA na rota do host, que e exatamente a condicao que o script
  existe para criar.
- Confere os deltas de linha de todas as tabelas envolvidas antes de commitar;
  qualquer delta inesperado vira ROLLBACK, mesmo com `--apply`.

Datas
-----
As duas fecham no PASSADO e em meses distintos, uma bem mais recente que a
outra: e o que exercita a ordenacao por recencia da lista. Ficam fora do mes
corrente e do anterior de proposito — `computeSavingsTrend` (Home e Inteligencia)
soma exatamente essas duas janelas, e um fechamento novo caindo la dentro mudaria
o KPI de Economia de lambuja. Use `--now` para ancorar em relacao a hoje.

Uso (a partir de backend/):
    .venv/bin/python -m scripts.topup_route_history_demo           # dry-run
    .venv/bin/python -m scripts.topup_route_history_demo --apply   # grava
"""

import argparse
import sys
import uuid
from datetime import date, datetime, timedelta, timezone

from dotenv import load_dotenv

load_dotenv()

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from shared.database.connection import get_engine
from shared.database.models.quotation.client import QuotationClient
from shared.database.models.quotation.enums import (
    Currency,
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

# A cotacao de onde a ROTA e copiada. COT-2026-0009 (Izmir -> Santos) e a escolha
# porque ela junta as tres condicoes: esta fora do Radar, ja renderiza os cards da
# Comparacao de Propostas (COTANDO com uma proposta recebida) e nao e FECHADA —
# ou seja, ela mesma nunca entra na lista que este script vai popular, e continua
# sendo a tela onde a lista aparece.
HOST_REFERENCE = "COT-2026-0009"

# Quantos dias ANTES de hoje cada cotacao fechou. Meses distintos e as duas fora
# do mes corrente e do anterior (ver "Datas" no docstring).
CLOSED_DAYS_AGO = (106, 63)   # ~mai/2026 e ~jun/2026 quando rodado em ago/2026
CREATED_LEAD_DAYS = 24        # quanto antes do fechamento a cotacao nasceu

# (produto, PO do cliente, agente, total USD, frete USD, transit)
# A mais antiga e a mais cara: a leitura que o bloco entrega e "o que voce ja
# pagou nesta rota", e um par com valores diferentes mostra isso melhor do que
# dois numeros parecidos. Nada aqui e comparado nem tem media calculada em cima.
PLAN = (
    ("Bobinas de aco laminado a frio", "PO-2026-1174", "AGENTE BETA", 4780.0, 4150.0, 33),
    ("Tubos de aco sem costura", "PO-2026-1177", "AGENTE ALPHA", 4180.0, 3620.0, 30),
)

# Deltas exatos que este script pode causar. Qualquer coisa fora disso e bug.
EXPECTED_DELTAS = {
    Quotation: 2,
    Proposal: 2,
    QuotationLog: 4,
    ProposalScore: 0,
    Processo: 0,
    Embarque: 0,
    QuotationClient: 0,
    FreightAgent: 0,
}


def _counts(session):
    return {m: session.execute(select(func.count()).select_from(m)).scalar()
            for m in EXPECTED_DELTAS}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true",
                        help="commita. Sem esta flag o script faz ROLLBACK.")
    args = parser.parse_args()

    now = datetime.now(timezone.utc)
    session = Session(get_engine())
    try:
        # --- Pre-condicoes -------------------------------------------------
        client = session.execute(
            select(QuotationClient).where(QuotationClient.name == DEMO_CLIENT_NAME)
        ).scalar_one_or_none()
        if client is None:
            print(f"ABORTADO: cliente '{DEMO_CLIENT_NAME}' nao encontrado. "
                  f"Este banco nao foi semeado — rode 'make seed', nao este script.")
            return 1

        host = session.execute(
            select(Quotation).where(
                Quotation.reference == HOST_REFERENCE,
                Quotation.client_id == client.id,
            )
        ).scalar_one_or_none()
        if host is None:
            print(f"ABORTADO: {HOST_REFERENCE} nao existe neste banco. E dela que "
                  f"sai a rota; sem ela o script nao tem onde ancorar.")
            return 1
        if host.origin is None or not host.origin.strip():
            print(f"ABORTADO: {HOST_REFERENCE} nao nomeia a origem. Sem origem nao "
                  f"ha rota — e o bloco cai na outra frase, nao na lista.")
            return 1

        # Idempotencia pelo EFEITO: se ja existe fechada nesta rota, o ramo de
        # fallback ja tem o que mostrar e rodar de novo so empilharia exemplo.
        already = session.execute(
            select(Quotation.reference).where(
                Quotation.client_id == client.id,
                Quotation.state == QuotationState.FECHADA,
                Quotation.origin == host.origin,
            )
        ).scalars().all()
        if already:
            print(f"ABORTADO: o cliente ja tem cotacao FECHADA em '{host.origin}': "
                  f"{sorted(already)}. Nada a fazer — o top-up ja foi aplicado.")
            return 1

        agent_names = sorted({row[2] for row in PLAN})
        agents = {
            a.name: a for a in session.execute(
                select(FreightAgent).where(FreightAgent.name.in_(agent_names))
            ).scalars().all()
        }
        missing = [n for n in agent_names if n not in agents]
        if missing:
            print(f"ABORTADO: agentes do seed nao encontrados: {missing}.")
            return 1

        before = _counts(session)
        print(f"Cliente: {client.name} ({client.id})")
        print(f"Rota copiada de {HOST_REFERENCE}: origin={host.origin!r} "
              f"porto_destino={host.porto_destino!r} modal={host.modal}")
        print("\nAntes:")
        for m, n in before.items():
            print(f"  {m.__name__:<16} {n}")

        # --- Insercao ------------------------------------------------------
        # Estes models usam ForeignKey puro (sem relationship), entao o unit of
        # work do SQLAlchemy nao deriva ordem de insert entre eles. Insere nivel
        # a nivel, com flush entre eles — mesma estrategia do seed_prototype.
        created = []
        for (product, po, agent_name, total, freight, transit), days_ago in zip(
            PLAN, CLOSED_DAYS_AGO
        ):
            closed_at = now - timedelta(days=days_ago)
            created_at = closed_at - timedelta(days=CREATED_LEAD_DAYS)
            agent = agents[agent_name]

            # A referencia e gerada pelo REPOSITORIO, nao escolhida aqui: e ele
            # que conhece a sequencia COT-YYYY-NNNN, e chumbar um numero deixaria
            # buraco na numeracao de qualquer banco que nao seja este.
            reference = quotation_repository._generate_reference(session)
            quotation = Quotation(
                id=uuid.uuid4(),
                reference=reference,
                state=QuotationState.FECHADA,
                service_type=ServiceType.IMPORTACAO,
                modal=host.modal,
                tipo_embarque=TipoEmbarque.FCL,
                # A rota vem do host, byte a byte — ver o docstring.
                origin=host.origin,
                porto_destino=host.porto_destino,
                product=product,
                client_id=client.id,
                client_reference=po,
                data_cotacao=created_at.date(),
                desired_deadline=closed_at + timedelta(days=15),
                declared_value=48000.0,
                declared_value_currency=Currency.USD,
                incoterm="FOB",
                winning_agent_id=agent.id,
                closed_at=closed_at,
                # created_at tem default=func.now(); explicitar sobrescreve o
                # default. Sem isto as duas nasceriam "hoje" e a Historico as
                # ordenaria certo mas as dataria errado.
                created_at=created_at,
            )
            session.add(quotation)
            session.flush()

            proposal = Proposal(
                id=uuid.uuid4(),
                quotation_id=quotation.id,
                agent_id=agent.id,
                total_value=total,
                freight_value=freight,
                taxes_breakdown={"THC": 180.0, "ISPS": 45.0},
                transit_time=transit,
                route_type=RouteType.DIRETA,
                carrier="Maersk",
                validity=(created_at + timedelta(days=20)).date(),
                freight_currency="USD",
                numero_oferta=f"OF-{str(agent.id)[:4].upper()}",
                frequencia="Semanal",
                ptax_percentual=2.0,
                # A vencedora: e ela que o serializer expoe como `best_proposal`,
                # e e de `best_proposal.total_brl` que sai o valor da lista.
                is_winner=True,
                received_at=created_at + timedelta(days=2),
            )
            session.add(proposal)
            session.flush()

            session.add_all([
                QuotationLog(
                    id=uuid.uuid4(), quotation_id=quotation.id, action="created",
                    previous_state=None, new_state="TRIAGEM_IA", user_id=DEMO_SUB,
                    details=None, created_at=created_at,
                ),
                QuotationLog(
                    id=uuid.uuid4(), quotation_id=quotation.id,
                    action="client_approved_proposal", previous_state=None,
                    new_state="APROVADA_PELO_CLIENTE", user_id=DEMO_SUB,
                    details={"agent_name": agent.name}, created_at=closed_at,
                ),
            ])
            session.flush()
            created.append((reference, po, product, agent.name, total, closed_at))

        # Nenhum ProposalScore, de proposito: o seed tambem nao cria para as
        # cotacoes fechadas. O endpoint de recomendacao os gera sob demanda.

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

        print("\nCotacoes novas (mais antiga primeiro):")
        for reference, po, product, agent_name, total, closed_at in created:
            print(f"  {reference}  FECHADA  {closed_at.date()}  USD {total:>8.2f}  "
                  f"{agent_name:<13} {po}  {product}")

        if args.apply:
            session.commit()
            print("\nCOMMIT. Top-up aplicado.")
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
