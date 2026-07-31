"""Top-up: acrescenta COT-2026-0007/0008/0009 a um banco ja semeado.

Por que este script existe
--------------------------
`seed_prototype.py` e "pula se ja existe": se o CLIENTE DEMO estiver presente,
ele retorna sem fazer nada. As cotacoes q7/q8/q9 (que preenchem a coluna
"Preencher detalhes" do Funil e dao um segundo card a "Aguardando agentes")
entraram no seed depois que o banco remoto ja tinha sido semeado com 6 cotacoes,
entao `make seed` nunca vai inseri-las la. Este script cobre exatamente essa
lacuna, sem tocar em nada do que ja existe.

Contrato de seguranca
---------------------
- Somente INSERT. Nenhum UPDATE, DELETE ou TRUNCATE em lugar nenhum.
- Dry-run por padrao: sem `--apply` a transacao termina em ROLLBACK.
- Aborta se qualquer uma das tres referencias ja existir (nao duplica).
- Aborta se o CLIENTE DEMO ou os tres agentes nao forem encontrados.
- Confere os deltas de linha de todas as tabelas envolvidas antes de commitar;
  qualquer delta inesperado vira ROLLBACK, mesmo com `--apply`.

As linhas novas sao carimbadas com o instante do seed original, nao com "agora".
`quotation_repository.get_all` ordena por `priority_score DESC, created_at DESC`
e todas as cotacoes semeadas tem `priority_score` NULL, entao o desempate e o
created_at. Carimbar "agora" jogaria os cards novos para o topo e faria a
COT-2026-0009 aparecer acima da COT-2026-0002 na mesma coluna. Reusar o instante
do seed deixa o conjunto identico ao que um `make seed` num banco limpo
produziria. Use `--now` para carimbar com a hora corrente.

Uso (a partir de backend/):
    .venv/bin/python -m scripts.topup_funnel_quotations           # dry-run
    .venv/bin/python -m scripts.topup_funnel_quotations --apply   # grava
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

DEMO_CLIENT_NAME = "CLIENTE DEMO"
DEMO_SUB = "demo-portal-user-sub"
NEW_REFS = ("COT-2026-0007", "COT-2026-0008", "COT-2026-0009")

# Instante do seed original, lido do banco remoto:
#   _now      (sent_at / closed_at / desired_deadline) = 17:53:38.523547
#   created_at (func.now() no INSERT)                  = 17:53:39.020983
SEED_NOW = datetime(2026, 7, 23, 17, 53, 38, 523547, tzinfo=timezone.utc)
SEED_ROW_STAMP = datetime(2026, 7, 23, 17, 53, 39, 20983, tzinfo=timezone.utc)
SEED_DATA_COTACAO = date(2026, 7, 23)

# Deltas exatos que este script pode causar. Qualquer coisa fora disso e bug.
EXPECTED_DELTAS = {
    Quotation: 3,
    Proposal: 1,
    QuotationLog: 6,
    ProposalScore: 0,
    Processo: 0,
    Embarque: 0,
    QuotationClient: 0,
    FreightAgent: 0,
}


def _quotation(ref, client_id, state, product, origin, now, row_stamp, data_cotacao,
               tipo_embarque=TipoEmbarque.FCL):
    return Quotation(
        id=uuid.uuid4(),
        reference=ref,
        state=state,
        service_type=ServiceType.IMPORTACAO,
        modal=Modal.MARITIMO,
        tipo_embarque=tipo_embarque,
        origin=origin,
        product=product,
        client_id=client_id,
        data_cotacao=data_cotacao,
        desired_deadline=now + timedelta(days=15),
        declared_value=48000.0,
        declared_value_currency=Currency.USD,
        incoterm="FOB",
        # created_at tem default=func.now(); explicitar sobrescreve o default.
        created_at=row_stamp,
    )


def _proposal(quotation_id, agent_id, total, freight, transit, data_cotacao, row_stamp):
    return Proposal(
        id=uuid.uuid4(),
        quotation_id=quotation_id,
        agent_id=agent_id,
        total_value=total,
        freight_value=freight,
        taxes_breakdown={"THC": 180.0, "ISPS": 45.0},
        transit_time=transit,
        route_type=RouteType.DIRETA,
        carrier="Maersk",
        validity=data_cotacao + timedelta(days=20),
        freight_currency="USD",
        numero_oferta=f"OF-{str(agent_id)[:4].upper()}",
        frequencia="Semanal",
        ptax_percentual=2.0,
        is_winner=False,
        received_at=row_stamp,
    )


def _log(quotation_id, action, new_state, row_stamp, details=None):
    return QuotationLog(
        id=uuid.uuid4(),
        quotation_id=quotation_id,
        action=action,
        previous_state=None,
        new_state=new_state,
        user_id=DEMO_SUB,
        details=details,
        created_at=row_stamp,
    )


def _counts(session):
    return {m: session.execute(select(func.count()).select_from(m)).scalar()
            for m in EXPECTED_DELTAS}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true",
                        help="commita. Sem esta flag o script faz ROLLBACK.")
    parser.add_argument("--now", action="store_true",
                        help="carimba com a hora corrente em vez do instante do seed.")
    args = parser.parse_args()

    if args.now:
        now = datetime.now(timezone.utc)
        row_stamp = now
        data_cotacao = date.today()
    else:
        now, row_stamp, data_cotacao = SEED_NOW, SEED_ROW_STAMP, SEED_DATA_COTACAO

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

        existing = session.execute(
            select(Quotation.reference).where(Quotation.reference.in_(NEW_REFS))
        ).scalars().all()
        if existing:
            print(f"ABORTADO: estas referencias ja existem: {sorted(existing)}. "
                  f"Nada a fazer — o top-up ja foi aplicado.")
            return 1

        agents = {
            a.name: a for a in session.execute(
                select(FreightAgent).where(FreightAgent.name.in_(
                    ["AGENTE ALPHA", "AGENTE BETA", "AGENTE GAMMA"]))
            ).scalars().all()
        }
        if len(agents) != 3:
            print(f"ABORTADO: esperava 3 agentes do seed, encontrei {sorted(agents)}.")
            return 1

        before = _counts(session)
        print(f"Cliente: {client.name} ({client.id})")
        print(f"Carimbo: {row_stamp.isoformat()}"
              f"{' (hora corrente)' if args.now else ' (instante do seed original)'}")
        print("\nAntes:")
        for m, n in before.items():
            print(f"  {m.__name__:<16} {n}")

        # --- Insercao ------------------------------------------------------
        # Estes models usam ForeignKey puro (sem relationship), entao o unit of
        # work do SQLAlchemy nao deriva ordem de insert entre eles. Insere nivel
        # a nivel, com flush entre eles — mesma estrategia do seed_prototype.
        q7 = _quotation(NEW_REFS[0], client.id, QuotationState.AGUARDANDO_DADOS,
                        "Componentes eletronicos", "Shenzhen, China",
                        now, row_stamp, data_cotacao, tipo_embarque=TipoEmbarque.LCL)
        q8 = _quotation(NEW_REFS[1], client.id, QuotationState.AGUARDANDO_DADOS,
                        "Piso vinilico", "Ho Chi Minh, Vietnam",
                        now, row_stamp, data_cotacao)
        q9 = _quotation(NEW_REFS[2], client.id, QuotationState.COTANDO,
                        "Bobinas de aco", "Izmir, Turkey",
                        now, row_stamp, data_cotacao)
        session.add_all([q7, q8, q9])
        session.flush()

        # q9 tem um agente respondido e dois ainda em aberto — e isso que
        # "Aguardando agentes" significa. q7/q8 nao tem nenhuma: a cotacao esta
        # travada no cliente, entao nenhuma RFQ saiu ainda.
        beta = agents["AGENTE BETA"]
        p9 = _proposal(q9.id, beta.id, 3900.0, 3400.0, 29, data_cotacao, row_stamp)
        session.add(p9)
        session.flush()

        session.add_all([
            _log(q7.id, "created", "TRIAGEM_IA", row_stamp),
            _log(q7.id, "missing_data_requested", "AGUARDANDO_DADOS", row_stamp,
                 {"missing_fields": ["peso_taxado", "porto_destino"]}),
            _log(q8.id, "created", "TRIAGEM_IA", row_stamp),
            _log(q8.id, "missing_data_requested", "AGUARDANDO_DADOS", row_stamp,
                 {"missing_fields": ["incoterm", "cubagem"]}),
            _log(q9.id, "created", "TRIAGEM_IA", row_stamp),
            _log(q9.id, "proposal_received", "COTANDO", row_stamp,
                 {"agent_name": beta.name, "freight_value": 3400.0,
                  "freight_currency": "USD"}),
        ])
        session.flush()

        # Nenhum ProposalScore aqui, de proposito: o seed tambem nao cria para
        # q9. O endpoint de recomendacao os gera na primeira abertura da tela.

        # --- Verificacao dos deltas ----------------------------------------
        after = _counts(session)
        deltas = {m: after[m] - before[m] for m in EXPECTED_DELTAS}
        print("\nDepois (delta):")
        ok = True
        for m, expected in EXPECTED_DELTAS.items():
            got = deltas[m]
            flag = "" if got == expected else "  <-- INESPERADO"
            if got != expected:
                ok = False
            print(f"  {m.__name__:<16} {after[m]}  ({got:+d}, esperado {expected:+d}){flag}")

        if not ok:
            session.rollback()
            print("\nROLLBACK: deltas divergem do esperado. Nada foi gravado.")
            return 1

        print(f"\nCotacoes novas: {', '.join(NEW_REFS)}")
        print(f"  {NEW_REFS[0]}  AGUARDANDO_DADOS  Componentes eletronicos (LCL)")
        print(f"  {NEW_REFS[1]}  AGUARDANDO_DADOS  Piso vinilico")
        print(f"  {NEW_REFS[2]}  COTANDO           Bobinas de aco  (+1 proposta, AGENTE BETA)")

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
