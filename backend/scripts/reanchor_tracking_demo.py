"""Re-ancora no tempo o rastreamento ILUSTRATIVO, para a demo nao envelhecer.

Por que este script existe
--------------------------
`topup_tracking_demo.py` e `topup_tracking_full.py` ancoram as datas que gravam
em "agora" — o instante em que RODARAM. O relogio segue andando e o banco nao:
alguns dias depois, o ETA de um embarque que a tela diz estar em transito ja
esta no passado, o risco de atraso passa a comparar duas datas vencidas e os
passos futuros da timeline mostram "Previsto" para uma data que ja foi.

Nenhum dos dois top-ups conserta isso: os dois PULAM qualquer embarque que ja
tenha `tracking_data_status`, entao rodar de novo nao faz nada (por design — e o
que impede sobrescrever um rastreamento real futuro). Este script fecha essa
lacuna e so ela.

O que ele faz
-------------
Um DESLOCAMENTO UNIFORME: soma o MESMO numero de dias a todas as datas de
rastreamento ilustrativo do cliente demo. Uniforme e o ponto — e o que preserva
todas as distancias relativas de uma vez:

- dentro do embarque: `current_eta - first_eta` (o desvio que vira o semaforo de
  atraso) e `last_milestone_at - current_eta` nao mudam em um dia sequer;
- entre embarques: quem chegava antes continua chegando antes, e quem ja tinha
  chegado continua no passado.

Consequencia direta: o script NAO conserta dado incoerente, so o move. Se algum
embarque ja esta contraditorio hoje, ele continua contraditorio depois — corrigir
isso e outra decisao, e seria outro script.

Quanto ele desloca
------------------
O suficiente para o embarque ainda-nao-chegado mais proximo voltar a ter ETA no
futuro, com `MIN_FUTURE_DAYS` de folga. "Ainda nao chegou" = milestone NULL ou
`OCEAN_TRANSIT`; a partir de `ARRIVAL` a carga chegou e o ETA no passado e o
estado CORRETO, nao defasagem. Use `--days N` para escolher o deslocamento na
mao (util para ensaiar uma data especifica de apresentacao).

O que este script NAO faz
-------------------------
- Nao toca em linha com `tracking_is_mock = FALSE`: rastreamento real fica fora,
  e a verificacao e por COLUNA, nao por lista de referencias chumbada aqui.
- Nao toca em nenhuma coluna que nao comece com `tracking_` — e isso e conferido
  no objeto sujo antes do commit, nao so prometido no docstring.
- Nao cria nem apaga linha: o delta esperado e ZERO e qualquer delta vira
  ROLLBACK.
- Nao mexe em `tracking_eta_is_actual`, `tracking_data_status` nem
  `tracking_last_milestone`: nao sao datas e o deslocamento no tempo nao muda o
  que a companhia reportou.
- Nao desloca para tras. Deslocamento <= 0 significa que a demo ainda esta em
  dia, e o script aborta em vez de "atualizar" o banco sem necessidade.

Uso (a partir de backend/):
    .venv/bin/python -m scripts.reanchor_tracking_demo            # dry-run
    .venv/bin/python -m scripts.reanchor_tracking_demo --days 30  # dry-run, na mao
    .venv/bin/python -m scripts.reanchor_tracking_demo --apply    # grava
"""

import argparse
import sys
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv

load_dotenv()

from sqlalchemy import func, inspect, select
from sqlalchemy.orm import Session

from shared.database.connection import get_engine
from shared.database.models.quotation.client import QuotationClient
from shared.database.models.shipment.embarque import Embarque
from shared.database.models.shipment.processo import Processo

DEMO_CLIENT_NAME = "CLIENTE DEMO"

# Folga minima do ETA mais proximo depois do deslocamento. Nao e so estetica: com
# o ETA colado em hoje, a tela volta a envelhecer no dia seguinte.
MIN_FUTURE_DAYS = 3

# Colunas de data deslocadas. As demais colunas tracking_* nao sao datas.
DATE_COLUMNS = (
    "tracking_first_eta",
    "tracking_current_eta",
    "tracking_last_milestone_at",
)

# Milestones em que a carga JA chegou. Para esses, ETA no passado e o estado
# correto — eles nao entram no calculo do deslocamento, so o acompanham.
ARRIVED_MILESTONES = {"ARRIVAL", "DISCHARGE", "AVAILABLE"}


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


def run(apply: bool, days_override: int | None) -> None:
    engine = get_engine()
    with Session(engine) as session:
        client = session.execute(
            select(QuotationClient).where(QuotationClient.name == DEMO_CLIENT_NAME)
        ).scalar_one_or_none()
        if client is None:
            _fail(f"cliente demo nao encontrado ({DEMO_CLIENT_NAME}). Rode o seed antes.")

        rows = (
            session.execute(
                select(Embarque)
                .join(Processo, Processo.id == Embarque.processo_id)
                .where(Processo.client_id == client.id)
                .where(Embarque.tracking_is_mock.is_(True))
                .order_by(Embarque.reference)
            )
            .scalars()
            .all()
        )
        if not rows:
            _fail(
                "nenhum embarque com rastreamento ilustrativo "
                "(tracking_is_mock = TRUE). Rode os top-ups antes."
            )

        # Linha ilustrativa sem data nenhuma (o cenario INCOMPLETE) nao tem o que
        # deslocar: fica de fora do plano em vez de virar um UPDATE vazio.
        datable = [
            e for e in rows if any(getattr(e, c) is not None for c in DATE_COLUMNS)
        ]
        undatable = [e for e in rows if e not in datable]
        if not datable:
            _fail("nenhuma data de rastreamento ilustrativo para deslocar.")

        now = datetime.now(timezone.utc)

        if days_override is not None:
            if days_override <= 0:
                _fail("--days precisa ser positivo: este script nao desloca para tras.")
            delta_days = days_override
            basis = f"--days {days_override} (escolhido na mao)"
        else:
            pre_arrival = [
                e
                for e in datable
                if e.tracking_current_eta is not None
                and (e.tracking_last_milestone or "") not in ARRIVED_MILESTONES
            ]
            if not pre_arrival:
                _fail(
                    "todos os embarques ilustrativos ja chegaram (milestone >= "
                    "ARRIVAL), entao nao existe ETA futuro para ancorar. Use "
                    "--days para escolher o deslocamento."
                )
            nearest = min(pre_arrival, key=lambda e: e.tracking_current_eta)
            target = (now + timedelta(days=MIN_FUTURE_DAYS)).date()
            delta_days = (target - nearest.tracking_current_eta.date()).days
            basis = (
                f"{nearest.reference} e o ainda-nao-chegado mais proximo "
                f"(ETA {_fmt(nearest.tracking_current_eta)}); alvo "
                f"{target.isoformat()} (hoje + {MIN_FUTURE_DAYS})"
            )

        if delta_days <= 0:
            _fail(
                f"nada a fazer: o deslocamento calculado e {delta_days} dias. "
                "A demo ainda esta em dia e este script nao desloca para tras."
            )

        shift = timedelta(days=delta_days)
        print(f"Deslocamento: +{delta_days} dias")
        print(f"Base: {basis}\n")

        before = _counts(session)

        print("Plano:")
        for embarque in datable:
            campos = []
            for column in DATE_COLUMNS:
                current = getattr(embarque, column)
                if current is None:
                    continue
                novo = current + shift
                setattr(embarque, column, novo)
                campos.append(f"{column[9:]}: {_fmt(current)} -> {_fmt(novo)}")
            print(
                f"  UPDATE {embarque.reference} "
                f"(estado={embarque.estado.value}, "
                f"milestone={embarque.tracking_last_milestone})"
            )
            for campo in campos:
                print(f"    {campo}")
        for embarque in undatable:
            print(f"  PULADO {embarque.reference} (ilustrativo, mas sem data alguma)")

        # AVISO, nao ABORT: um embarque que a companhia diz ter chegado com data
        # de chegada no futuro e dado contraditorio, mas o deslocamento uniforme
        # so PRESERVA a contradicao — ela ja estava la, ou veio de um --days
        # escolhido grande demais de proposito. Abortar aqui esconderia o
        # problema real atras de um script que nunca roda.
        futuros = [
            f"{e.reference} ({e.tracking_last_milestone}, chegada "
            f"{_fmt(e.tracking_current_eta)})"
            for e in datable
            if (e.tracking_last_milestone or "") in ARRIVED_MILESTONES
            and e.tracking_current_eta is not None
            and e.tracking_current_eta > now
        ]
        if futuros:
            print(
                "\nAVISO: embarque marcado como chegado com data de chegada no "
                "futuro depois do deslocamento:"
            )
            for item in futuros:
                print(f"  {item}")
            print(
                "  A tela vai mostrar 'chegou' e uma chegada que ainda nao "
                "aconteceu. Confira antes de aplicar."
            )

        # Duas garantias conferidas no objeto, nao prometidas no docstring: nada
        # fora de tracking_* foi modificado, e nada sem o flag de ilustrativo
        # entrou no lote. Antes do flush de proposito — depois dele a sessao ja
        # considerou os objetos limpos e o historico de mudancas some.
        offenders = []
        for obj in session.dirty:
            if not isinstance(obj, Embarque) or obj.tracking_is_mock is not True:
                offenders.append(f"{obj} nao e embarque ilustrativo")
                continue
            for attr in inspect(obj).attrs:
                if attr.history.has_changes() and not attr.key.startswith("tracking_"):
                    offenders.append(f"{obj.reference}.{attr.key}")

        session.flush()

        after = _counts(session)
        deltas = {k: after[k] - before[k] for k in before}
        expected = {"processos": 0, "embarques": 0}
        print(f"\nDeltas de linha: {deltas} (esperado {expected})")

        if offenders:
            session.rollback()
            _fail(
                "alteracao fora do escopo permitido: "
                + ", ".join(offenders)
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
            f"\nAPLICADO: {len(datable)} embarques tiveram o rastreamento "
            f"ilustrativo deslocado em +{delta_days} dias."
        )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--apply", action="store_true", help="grava (sem esta flag e dry-run)"
    )
    parser.add_argument(
        "--days",
        type=int,
        default=None,
        help="deslocamento em dias, no lugar do calculado a partir do ETA mais proximo",
    )
    args = parser.parse_args()
    run(args.apply, args.days)
