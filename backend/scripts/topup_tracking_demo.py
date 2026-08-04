"""Top-up: dado ILUSTRATIVO de rastreamento em 4 embarques, para a demo.

Por que este script existe
--------------------------
As colunas `tracking_*` (migrations 091/092/093) existem para a integracao
ShipsGo, que ainda nao foi feita, e por isso ficam NULL: o portal responde
"Pendente integracao" em todo embarque. Isso e honesto, mas deixa os caminhos
visuais da tela sem nada para mostrar numa demo:

    1. no prazo            -> delta 0 dia,  badge verde
    2. atraso              -> delta +5 dias, badge vermelho, e a timeline com
                              "Descarregado" preenchido (milestone DISCHARGE)
    3. sem dado suficiente -> data_status INCOMPLETE, badge neutro na Lista,
                              na Timeline e no Mapa
    4. liberado            -> milestone AVAILABLE, que fecha a timeline e e o
                              unico gatilho do alerta de risco de demurrage na
                              aba Alertas

Este script popula exatamente esses quatro cenarios. Todo valor que ele grava e
inventado, e por isso toda linha vai com `tracking_is_mock = TRUE` — a flag que
faz o portal desenhar o selo "Pre-visualizacao" em cima desses numeros. Sem a
flag, o dado ilustrativo passaria por real, que e o problema que o Prompt 7 ja
corrigiu. Nao popule tracking sem ela.

`seed_prototype.py` e skip-if-exists e roda antes deste script; este e separado
de proposito (mesma disciplina do topup_funnel_quotations.py) para que um banco
limpo continue nascendo 100% "Pendente integracao" e o dado de demo seja uma
escolha explicita de quem prepara a apresentacao.

Contrato de seguranca
---------------------
- Dry-run por padrao: sem `--apply` a transacao termina em ROLLBACK.
- UPDATE apenas em colunas `tracking_*`, e apenas se as quatro estiverem NULL no
  EMB alvo. Nenhum campo de negocio (estado, containers, observacao, datas) e
  tocado em embarque que ja existe.
- Os cenarios 2 e 3 sao INSERT de embarques novos, nao promocao de embarques
  existentes: mudar o `estado` de um embarque semeado quebraria a variedade de
  estados que a demo e a suite e2e dependem (O2b cobre os cinco estados do
  happy path).
- Aborta se o CLIENTE DEMO, os agentes ou o EMB alvo nao existirem.
- Cenario ja aplicado e PULADO, nao duplicado nem sobrescrito: o embarque novo
  cujo reference ja existe sai do plano, e o UPDATE do cenario 1 so roda se as
  colunas `tracking_*` do alvo estiverem NULL. Se nao sobrar nada a fazer, o
  script aborta dizendo isso. E o que permite acrescentar um cenario novo
  (o 4 veio depois dos outros tres) e roda-lo num banco que ja recebeu o
  top-up, sem tocar no que ja esta la.
- Confere que cada embarque novo nasceu com o reference esperado; se a sequencia
  do repositorio produzir outro, e ROLLBACK.
- Confere os deltas de linha das tabelas envolvidas antes de commitar; delta
  inesperado vira ROLLBACK, mesmo com `--apply`.

Uso (a partir de backend/):
    .venv/bin/python -m scripts.topup_tracking_demo           # dry-run
    .venv/bin/python -m scripts.topup_tracking_demo --apply   # grava
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

# Cenario 1 pega um embarque que ja existe e ja esta EMBARCADO: o unico do seed
# em que uma previsao de chegada faz sentido sem mexer em nada de negocio.
ON_TIME_TARGET = "EMB-2026-0001"

# Cenarios 2, 3 e 4 sao embarques novos (ver contrato acima).
DELAYED_REFERENCE = "EMB-2026-0008"
INCOMPLETE_REFERENCE = "EMB-2026-0009"
RELEASED_REFERENCE = "EMB-2026-0010"

DELAY_DAYS = 5


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
    print(f"    first_eta      = {_fmt(embarque.tracking_first_eta)}")
    print(f"    current_eta    = {_fmt(embarque.tracking_current_eta)}")
    print(f"    eta_is_actual  = {embarque.tracking_eta_is_actual}")
    print(f"    data_status    = {embarque.tracking_data_status}")
    print(f"    last_milestone = {embarque.tracking_last_milestone}")
    print(f"    milestone_at   = {_fmt(embarque.tracking_last_milestone_at)}")
    print(f"    is_mock        = {embarque.tracking_is_mock}")


def run(apply: bool) -> None:
    engine = get_engine()
    with Session(engine) as session:
        client = session.execute(
            select(QuotationClient).where(QuotationClient.name == DEMO_CLIENT_NAME)
        ).scalar_one_or_none()
        if client is None:
            _fail(f"cliente demo nao encontrado ({DEMO_CLIENT_NAME}). Rode o seed antes.")

        agents = session.execute(
            select(FreightAgent).order_by(FreightAgent.name)
        ).scalars().all()
        if not agents:
            _fail("nenhum agente de carga encontrado. Rode o seed antes.")

        target = session.execute(
            select(Embarque).where(Embarque.reference == ON_TIME_TARGET)
        ).scalar_one_or_none()
        if target is None:
            _fail(f"{ON_TIME_TARGET} nao encontrado. Rode o seed antes.")
        # Ja tem tracking nao e erro: e o cenario 1 ja aplicado numa rodada
        # anterior. Pula, nunca sobrescreve.
        do_update = not any(
            v is not None
            for v in (
                target.tracking_first_eta,
                target.tracking_current_eta,
                target.tracking_data_status,
                target.tracking_last_milestone,
            )
        )
        target_processo = session.get(Processo, target.processo_id)
        if target_processo.client_id != client.id:
            _fail(f"{ON_TIME_TARGET} nao pertence ao cliente demo.")

        before = _counts(session)

        # ETAs sao ancoradas em "agora", nao no created_at do embarque, porque o
        # que precisa ficar coerente aqui e a leitura na tela: uma carga em
        # transito tem chegada no futuro, uma carga ja descarregada chegou no
        # passado. Ancorar no seed faria a data depender de quando o banco foi
        # semeado — no remoto, semeado ha semanas, o cenario "no prazo" nasceria
        # com ETA vencida. Ordenacao da lista nao usa esses campos.
        now = datetime.now(timezone.utc)
        base = target_processo.created_at

        # --- Cenario 1: no prazo (UPDATE, so colunas tracking_*) -------------
        if do_update:
            eta = now + timedelta(days=12)
            target.tracking_first_eta = eta
            target.tracking_current_eta = eta
            target.tracking_eta_is_actual = False
            target.tracking_data_status = "COMPLETE"
            target.tracking_last_milestone = "OCEAN_TRANSIT"
            target.tracking_is_mock = True

        # --- Cenarios 2, 3 e 4: embarques novos (INSERT) ---------------------
        # created_at continua a escada do seed para nao embaralhar a ordenacao
        # da lista, que e urgente-primeiro e depois created_at desc.
        #
        # `last_milestone_at` (migration 093) so e preenchido no cenario 4: e o
        # unico milestone que o portal datiza na tela (o alerta de demurrage diz
        # "liberado em"). Nos outros a data do milestone nao e renderizada em
        # lugar nenhum, e inventa-la seria dado morto.
        all_specs = [
            {
                # Ja descarregado: o embarque e antigo e as duas datas ficam no
                # passado, senao a "chegada real" cairia no futuro.
                "label": "cenario 2 — atraso +5 dias, descarregado",
                "reference": DELAYED_REFERENCE,
                "age": 40,
                "agent": agents[1 % len(agents)],
                "containers": [{"numero": "MSCU6620481", "tipo": "40HC", "tara": 3820}],
                "observacao": (
                    "Carga descarregada no porto de destino, aguardando liberacao "
                    "(rota da Asia, Ningbo)."
                ),
                "tracking": {
                    "first_eta_days": -12,
                    "current_eta_days": -12 + DELAY_DAYS,
                    "eta_is_actual": True,
                    "data_status": "COMPLETE",
                    "last_milestone": "DISCHARGE",
                },
            },
            {
                "label": "cenario 3 — sem dado suficiente da companhia",
                "reference": INCOMPLETE_REFERENCE,
                "age": 8,
                "agent": agents[2 % len(agents)],
                "containers": [{"numero": "OOLU3318740", "tipo": "20GP", "tara": 2250}],
                "observacao": (
                    "Embarcado — a companhia maritima ainda nao publicou os dados "
                    "de acompanhamento (rota da Europa, Antuerpia)."
                ),
                "tracking": {
                    "first_eta_days": None,
                    "current_eta_days": None,
                    "eta_is_actual": None,
                    "data_status": "INCOMPLETE",
                    "last_milestone": None,
                },
            },
            {
                # Container ja liberado para retirada: e o unico cenario que
                # dispara o alerta de risco de demurrage. Chegou no prazo de
                # proposito — o alerta nasce da liberacao, nao de atraso, e
                # empilhar as duas coisas esconderia isso na demo.
                "label": "cenario 4 — liberado para retirada (demurrage)",
                "reference": RELEASED_REFERENCE,
                "age": 45,
                "agent": agents[0],
                "containers": [{"numero": "TCLU7742096", "tipo": "40HC", "tara": 3750}],
                "observacao": (
                    "Container liberado para retirada no porto de destino "
                    "(rota da Asia, Xangai)."
                ),
                "tracking": {
                    "first_eta_days": -6,
                    "current_eta_days": -6,
                    "eta_is_actual": True,
                    "data_status": "COMPLETE",
                    "last_milestone": "AVAILABLE",
                    # Depois da chegada, como no mundo real: descarga e
                    # liberacao levam alguns dias.
                    "last_milestone_at_days": -3,
                },
            },
        ]

        pending_specs = [
            spec
            for spec in all_specs
            if session.execute(
                select(Embarque.id).where(Embarque.reference == spec["reference"])
            ).first()
            is None
        ]
        skipped = [s["reference"] for s in all_specs if s not in pending_specs]
        if skipped:
            print(f"Ja aplicados, pulando: {', '.join(skipped)}")
        if not do_update:
            print(f"Ja aplicado, pulando: {ON_TIME_TARGET} (cenario 1)")
        if not pending_specs and not do_update:
            _fail("nada a fazer — todos os cenarios ja foram aplicados neste banco.")

        created: list[tuple[str, Embarque]] = []
        for spec in pending_specs:
            processo = processo_repository.create(
                session,
                client_id=client.id,
                quotation_id=None,
                incoterm="FOB",
                modal=Modal.MARITIMO,
                tipo_embarque=TipoEmbarque.FCL,
                tipo_despacho=TipoDespacho.DIRETO,
                carga_urgente=False,
                agente_id=spec["agent"].id,
                containers=spec["containers"],
                observacao=spec["observacao"],
            )
            processo.created_at = base - timedelta(days=spec["age"])
            embarque = embarque_repository.create(
                session, processo_id=processo.id, estado=EmbarqueState.EMBARCADO
            )
            t = spec["tracking"]
            if t["first_eta_days"] is not None:
                embarque.tracking_first_eta = now + timedelta(days=t["first_eta_days"])
            if t["current_eta_days"] is not None:
                embarque.tracking_current_eta = now + timedelta(
                    days=t["current_eta_days"]
                )
            embarque.tracking_eta_is_actual = t["eta_is_actual"]
            embarque.tracking_data_status = t["data_status"]
            embarque.tracking_last_milestone = t["last_milestone"]
            if t.get("last_milestone_at_days") is not None:
                embarque.tracking_last_milestone_at = now + timedelta(
                    days=t["last_milestone_at_days"]
                )
            embarque.tracking_is_mock = True
            created.append((spec, embarque))

        session.flush()

        # A referencia e gerada pelo repositorio (sequencial), nao escolhida
        # aqui: se a sequencia do banco nao produzir o que este script anuncia,
        # o plano impresso mente e nada deve ser gravado.
        wrong = [
            (spec["reference"], embarque.reference)
            for spec, embarque in created
            if embarque.reference != spec["reference"]
        ]

        after = _counts(session)
        deltas = {k: after[k] - before[k] for k in before}
        expected = {"processos": len(pending_specs), "embarques": len(pending_specs)}

        print("Plano:")
        if do_update:
            _describe("cenario 1 — no prazo (UPDATE)", target)
        for spec, embarque in created:
            _describe(f"{spec['label']} (INSERT)", embarque)
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
            f"\nAPLICADO: {1 if do_update else 0} UPDATE de tracking + "
            f"{len(created)} embarques novos, todos is_mock=TRUE."
        )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--apply", action="store_true", help="grava (sem esta flag e dry-run)"
    )
    run(parser.parse_args().apply)
