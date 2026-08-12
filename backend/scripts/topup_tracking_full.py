"""Top-up: rastreamento ilustrativo em TODOS os embarques, para a referencia visual.

Por que este script existe
--------------------------
Mudanca de proposito do prototipo (12/08/2026, pedido do Vinicius): ele deixou de
ser uma replica standalone que precisa distinguir dado real de mock para o
usuario final e passou a ser REFERENCIA VISUAL para o Mauro construir a versao
integrada. Consequencia pratica: onde a tela mostrava "Pendente integracao", ela
passa a mostrar como vai se comportar quando o dado existir.

O `topup_tracking_demo.py` (anterior) populava QUATRO embarques, o suficiente
para exercitar os tres caminhos visuais da tela. Este aqui fecha a lacuna: todo
embarque do cliente demo passa a ter ETA, risco de atraso e — quando o estado
permite — milestone de rastreamento.

Diferenca de escopo entre os dois, e por que os dois continuam existindo:
o `_demo` monta cenarios NOMEADOS (no prazo / atraso / sem dado / liberado) que
a demo usa para explicar a tela; este aqui e o preenchimento em massa do resto.
Rodar o `_demo` antes continua sendo o caminho recomendado — este script pula
tudo que ja tem tracking, entao a ordem nao quebra nada.

O que este script NAO faz
-------------------------
- Nao toca em embarque que ja tem `tracking_data_status` preenchido. Os quatro
  cenarios do `_demo` sobrevivem intactos.
- Nao sobrescreve `tracking_is_mock = FALSE` em lugar nenhum: se algum dia um
  embarque tiver rastreamento de verdade, ele fica fora do lote.
- Nao muda `estado`, containers, observacao, agente nem qualquer campo de
  negocio dos embarques que ja existem.
- Nao mexe no seed: um banco recem-semeado continua 100% sem tracking, que e o
  que o `O15` da suite e2e trava.

Regras do dado gerado
---------------------
- **Milestone segue o estado.** So embarque `embarcado` (a carga partiu) recebe
  milestone de rastreamento; nos demais ele fica NULL. Um embarque em
  `aguardando_prontidao` com milestone `DISCHARGE` seria dado contraditorio — a
  carga estaria descarregada no destino antes de sair da origem. Estados de
  excecao (postergado, booking_divergente) tambem ficam sem milestone: a
  timeline congela na excecao de qualquer jeito.
- **ETA existe antes de embarcar.** Uma carga ainda nao coletada tem previsao de
  chegada; por isso ETA e risco de atraso sao preenchidos para todos, milestone
  nao.
- **Variedade proposital**: a maioria no prazo, alguns com atraso pequeno, um com
  atraso grande, e um par INCOMPLETE (a companhia integrada que nao reportou o
  suficiente). Sem isso a tela mostra dez embarques identicos e o semaforo perde
  a graca.
- **`tracking_is_mock = TRUE` em toda linha gravada**, como no `_demo`. A
  infraestrutura de sinalizacao continua de pe; o que mudou foi o que a UI faz
  com a AUSENCIA de dado, nao a marcacao do dado ilustrativo.

Contrato de seguranca
---------------------
- Dry-run por padrao: sem `--apply` a transacao termina em ROLLBACK.
- UPDATE apenas em colunas `tracking_*`, e apenas onde `tracking_data_status`
  esta NULL.
- Escopo travado no CLIENTE DEMO.
- Embarque ja populado e PULADO, nao aborta o lote; so aborta se nao sobrar nada.
- Confere os deltas de linha antes de commitar. Os UPDATEs nao criam linha, mas
  os embarques novos criam — o esperado e conferido explicitamente.

Uso (a partir de backend/):
    .venv/bin/python -m scripts.topup_tracking_full           # dry-run
    .venv/bin/python -m scripts.topup_tracking_full --apply   # grava
"""

import argparse
import sys
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv

load_dotenv()

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from shared.database.connection import get_engine
from shared.database.models.quotation.client import QuotationClient
from shared.database.models.quotation.enums import Modal, TipoEmbarque
from shared.database.models.quotation.freight_agent import FreightAgent
from shared.database.models.shipment.embarque import Embarque
from shared.database.models.shipment.enums import EmbarqueState, TipoDespacho
from shared.database.models.shipment.processo import Processo
from shared.database.repositories import embarque_repository, processo_repository

DEMO_CLIENT_NAME = "CLIENTE DEMO"

# Estados em que a carga ja partiu e, portanto, a companhia tem o que reportar.
DEPARTED = {EmbarqueState.EMBARCADO}

# Perfis de desvio, aplicados em rodizio pela ordem da referencia. A distribuicao
# e escolhida para o semaforo aparecer inteiro na tela: maioria verde, um par
# laranja, um vermelho.
#
# (delta_dias, data_status)  — delta 0 = no prazo; 1..3 = atencao; >3 = atraso.
DELAY_PROFILES = [
    (0, "COMPLETE"),
    (0, "COMPLETE"),
    (2, "COMPLETE"),
    (0, "COMPLETE"),
    (7, "COMPLETE"),
    (0, "INCOMPLETE"),
    (1, "COMPLETE"),
    (0, "COMPLETE"),
]

# Embarques novos, para a tela ter mais cargas ja em transito/chegadas do que o
# seed cria. Sao INSERTs: promover um embarque existente para `embarcado`
# quebraria a variedade de estados que a Lista e o `O2b` do e2e dependem.
#
# Dois deles chegam em AVAILABLE de proposito: e o milestone que torna um
# embarque elegivel para a Auditoria, que ate agora mostrava "0 embarques
# elegiveis" por nao existir nenhum.
NEW_SHIPMENTS = [
    {
        "reference": "EMB-2026-0011",
        "age": 46,
        "milestone": "AVAILABLE",
        "delta": 0,
        "data_status": "COMPLETE",
        "milestone_at_days": -3,
        "containers": [{"numero": "TGHU8845120", "tipo": "40HC", "tara": 3790}],
        "observacao": (
            "Container liberado para retirada no terminal de destino "
            "(rota da Europa, Roterda)."
        ),
    },
    {
        "reference": "EMB-2026-0012",
        "age": 52,
        "milestone": "AVAILABLE",
        "delta": 4,
        "data_status": "COMPLETE",
        "milestone_at_days": -6,
        "containers": [{"numero": "OOLU7731905", "tipo": "20GP", "tara": 2240}],
        "observacao": (
            "Carga liberada apos atraso na descarga, no navio OOCL SEOUL "
            "(rota da Asia, Xangai)."
        ),
    },
    {
        "reference": "EMB-2026-0013",
        "age": 22,
        "milestone": "ARRIVAL",
        "delta": 1,
        "data_status": "COMPLETE",
        "milestone_at_days": None,
        "containers": [{"numero": "HLXU3390188", "tipo": "40GP", "tara": 3705}],
        "observacao": (
            "Navio atracado no porto de destino, aguardando descarga "
            "(rota da America do Norte, Houston)."
        ),
    },
]


def _fail(message: str) -> None:
    print(f"ABORT: {message}")
    sys.exit(1)


def _counts(session: Session) -> dict:
    return {
        "processos": session.execute(
            select(func.count()).select_from(Processo)
        ).scalar_one(),
        "embarques": session.execute(
            select(func.count()).select_from(Embarque)
        ).scalar_one(),
    }


def _fmt(value) -> str:
    return value.date().isoformat() if value is not None else "NULL"


def _describe(label: str, embarque: Embarque) -> None:
    print(f"  {label} ({embarque.reference}, estado={embarque.estado.value})")
    print(
        f"    first_eta={_fmt(embarque.tracking_first_eta)}"
        f"  current_eta={_fmt(embarque.tracking_current_eta)}"
        f"  status={embarque.tracking_data_status}"
        f"  milestone={embarque.tracking_last_milestone}"
        f"  is_mock={embarque.tracking_is_mock}"
    )


def run(apply: bool) -> None:
    engine = get_engine()
    with Session(engine) as session:
        client = session.execute(
            select(QuotationClient).where(QuotationClient.name == DEMO_CLIENT_NAME)
        ).scalar_one_or_none()
        if client is None:
            _fail(f"cliente demo nao encontrado ({DEMO_CLIENT_NAME}). Rode o seed antes.")

        agents = (
            session.execute(select(FreightAgent).order_by(FreightAgent.name))
            .scalars()
            .all()
        )
        if not agents:
            _fail("nenhum agente de carga encontrado. Rode o seed antes.")

        rows = session.execute(
            select(Embarque, Processo)
            .join(Processo, Processo.id == Embarque.processo_id)
            .where(Processo.client_id == client.id)
            .order_by(Embarque.reference)
        ).all()
        if not rows:
            _fail("nenhum embarque do cliente demo. Rode o seed antes.")

        # Ja populado = tem status de dado. Nunca sobrescrevemos: os cenarios do
        # topup_tracking_demo, e qualquer rastreamento real futuro, ficam fora.
        pending = [(e, p) for e, p in rows if e.tracking_data_status is None]
        skipped = [e for e, _ in rows if e.tracking_data_status is not None]

        new_pending = [
            s
            for s in NEW_SHIPMENTS
            if session.execute(
                select(Embarque.id).where(Embarque.reference == s["reference"])
            ).first()
            is None
        ]
        new_skipped = [
            s["reference"] for s in NEW_SHIPMENTS if s not in new_pending
        ]

        if not pending and not new_pending:
            _fail(
                "nada a fazer: todos os embarques ja tem rastreamento e os "
                "embarques novos ja existem."
            )

        before = _counts(session)

        # Ancoradas em "agora", nao no created_at: o que precisa ficar coerente e
        # a leitura na tela (carga em transito chega no futuro, carga liberada
        # chegou no passado). Ancorar no seed faria a data depender de quando o
        # banco foi semeado.
        now = datetime.now(timezone.utc)

        updated: list[Embarque] = []
        for index, (embarque, _processo) in enumerate(pending):
            delta, data_status = DELAY_PROFILES[index % len(DELAY_PROFILES)]
            departed = embarque.estado in DEPARTED

            if data_status == "INCOMPLETE":
                # Integrada, mas a companhia nao reportou o suficiente: sem datas.
                embarque.tracking_first_eta = None
                embarque.tracking_current_eta = None
                embarque.tracking_eta_is_actual = None
            else:
                first = now + timedelta(days=14 + index)
                embarque.tracking_first_eta = first
                embarque.tracking_current_eta = first + timedelta(days=delta)
                embarque.tracking_eta_is_actual = False

            embarque.tracking_data_status = data_status
            # Milestone so para carga que partiu — ver o docstring.
            embarque.tracking_last_milestone = (
                "OCEAN_TRANSIT" if departed and data_status == "COMPLETE" else None
            )
            embarque.tracking_is_mock = True
            updated.append(embarque)

        created: list[Embarque] = []
        for spec in new_pending:
            processo = processo_repository.create(
                session,
                client_id=client.id,
                quotation_id=None,
                incoterm="FOB",
                modal=Modal.MARITIMO,
                tipo_embarque=TipoEmbarque.FCL,
                tipo_despacho=TipoDespacho.DIRETO,
                carga_urgente=False,
                agente_id=agents[len(created) % len(agents)].id,
                containers=spec["containers"],
                observacao=spec["observacao"],
            )
            processo.created_at = now - timedelta(days=spec["age"])
            embarque = embarque_repository.create(
                session, processo_id=processo.id, estado=EmbarqueState.EMBARCADO
            )
            # Ja chegaram: as duas datas ficam no passado, senao a chegada cairia
            # no futuro para uma carga que a tela diz estar liberada.
            first = now - timedelta(days=spec["age"] - 30)
            embarque.tracking_first_eta = first
            embarque.tracking_current_eta = first + timedelta(days=spec["delta"])
            embarque.tracking_eta_is_actual = True
            embarque.tracking_data_status = spec["data_status"]
            embarque.tracking_last_milestone = spec["milestone"]
            if spec["milestone_at_days"] is not None:
                embarque.tracking_last_milestone_at = now + timedelta(
                    days=spec["milestone_at_days"]
                )
            embarque.tracking_is_mock = True
            created.append(embarque)

        session.flush()

        print("Plano:")
        for embarque in updated:
            _describe("UPDATE", embarque)
        for embarque in created:
            _describe("INSERT", embarque)
        for embarque in skipped:
            print(f"  PULADO {embarque.reference} (ja tem tracking)")
        for reference in new_skipped:
            print(f"  PULADO {reference} (embarque novo ja existe)")

        # A referencia dos novos e gerada pelo repositorio, nao escolhida aqui.
        wrong = [
            (spec["reference"], embarque.reference)
            for spec, embarque in zip(new_pending, created)
            if embarque.reference != spec["reference"]
        ]

        after = _counts(session)
        deltas = {k: after[k] - before[k] for k in before}
        expected = {"processos": len(created), "embarques": len(created)}
        print(f"\nDeltas de linha: {deltas} (esperado {expected})")

        if wrong:
            session.rollback()
            _fail(
                "referencia gerada diferente da esperada: "
                + ", ".join(f"esperava {e}, veio {g}" for e, g in wrong)
                + ". Nada foi gravado."
            )

        if deltas != expected:
            session.rollback()
            _fail(f"deltas inesperados: {deltas} != {expected}. Nada foi gravado.")

        if not apply:
            session.rollback()
            print("\nDRY-RUN: rollback executado, nada foi gravado.")
            print("Rode com --apply para gravar.")
            return

        session.commit()
        print(
            f"\nAPLICADO: {len(updated)} embarques receberam rastreamento e "
            f"{len(created)} embarques novos foram criados, todos is_mock=TRUE."
        )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--apply", action="store_true", help="grava (sem esta flag e dry-run)"
    )
    run(parser.parse_args().apply)
