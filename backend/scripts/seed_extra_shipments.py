"""Additive seed: create ONLY the 4 extra demo shipments from Task 2.

Purpose
-------
The full `seed_prototype.py` is destructive to run against a database that is
already populated: it is idempotent (it *skips* when the demo client exists), but
its intent is to build the demo from scratch. This script instead ADDS just the
four extra shipments introduced in Task 2 to an already-published demo, without
resetting anything.

What it does / does NOT do
--------------------------
- DOES: insert up to 4 new Processo + Embarque rows (SOLICITADO, COLETADO,
  ANALISE_BOOKING, POSTERGADO) for the existing demo client, via the same
  `processo_repository.create` + `embarque_repository.create` path the seed uses.
- Does NOT create, delete, recreate or update the demo client, agents, DNA,
  quotations, exporters, or any pre-existing shipment. It only INSERTs.
- Does NOT run `make seed`, drop tables, or touch anything outside these 4 rows.

Idempotency
-----------
Safe to run more than once. Each of the four rows carries a unique, stable
`observacao` string (byte-for-byte identical to the one in `seed_prototype.py`).
Before inserting, the script reads the existing `observacao` values for the demo
client and skips any shipment whose note is already present. So a second run --
or a run after the full seed already planted these four -- inserts nothing.

Safety gate
-----------
The target database (host / db / user, password never printed) is shown up front
and the script asks for an explicit confirmation before writing, so you can
eyeball that it is the intended Supabase production instance. Use `--dry-run` to
preview without writing, or `--yes` to skip the prompt once you have verified the
target.

Usage (from backend/)
---------------------
    .venv/bin/python -m scripts.seed_extra_shipments --dry-run   # preview only
    .venv/bin/python -m scripts.seed_extra_shipments             # asks to confirm
    .venv/bin/python -m scripts.seed_extra_shipments --yes       # no prompt

All data here is fictional and exists only to demonstrate the prototype.
"""

import argparse
import os
import sys
from datetime import datetime, timedelta, timezone
from urllib.parse import urlsplit

from dotenv import load_dotenv

load_dotenv()

from sqlalchemy import select

from shared.database.connection import get_session
from shared.database.models.quotation.client import QuotationClient
from shared.database.models.quotation.enums import Modal, TipoEmbarque
from shared.database.models.quotation.freight_agent import FreightAgent
from shared.database.models.shipment.enums import EmbarqueState, TipoDespacho
from shared.database.models.shipment.processo import Processo
from shared.database.repositories import embarque_repository, processo_repository

DEMO_CLIENT_NAME = "CLIENTE DEMO"

# The four extra shipments added in Task 2 (seed_prototype.py). Kept identical to
# the seed so that whichever script created a given shipment, the other one
# recognises it (by `observacao`) and never duplicates it.
EXTRA_SHIPMENTS = [
    {
        "agent_name": "AGENTE ALPHA",
        "estado": EmbarqueState.SOLICITADO,
        "carga_urgente": False,
        "containers": None,
        "observacao": "Embarque aberto — coletando dados de booking na Asia (Busan).",
    },
    {
        "agent_name": "AGENTE BETA",
        "estado": EmbarqueState.COLETADO,
        "carga_urgente": False,
        "containers": [{"numero": "HLCU4471902", "tipo": "40GP", "tara": 3680}],
        "observacao": "Carga coletada, seguindo para o porto de embarque na Europa (Roterda).",
    },
    {
        "agent_name": "AGENTE GAMMA",
        "estado": EmbarqueState.ANALISE_BOOKING,
        "carga_urgente": True,
        "containers": [{"numero": "CMAU5590017", "tipo": "40HC", "tara": 3800}],
        "observacao": "Conferindo os dados do booking com o armador — rota da America do Norte (Nova York).",
    },
    {
        "agent_name": "AGENTE ALPHA",
        "estado": EmbarqueState.POSTERGADO,
        "carga_urgente": False,
        "containers": None,
        "observacao": "Embarque postergado pelo armador — reprogramando a saida na Asia (Shenzhen).",
    },
]


def _target_description() -> str:
    """Human-readable target, password intentionally never included."""
    raw = os.environ.get("DATABASE_URL")
    if not raw:
        return "(DATABASE_URL nao definido)"
    parts = urlsplit(raw)
    host = parts.hostname or "?"
    port = f":{parts.port}" if parts.port else ""
    db = (parts.path or "").lstrip("/") or "?"
    user = parts.username or "?"
    return f"host={host}{port}  db={db}  user={user}"


def _confirm(target: str, args: argparse.Namespace) -> bool:
    print("=" * 72)
    print("  SEED ADITIVO — Meus Embarques (ate 4 embarques extras, idempotente)")
    print("=" * 72)
    print(f"  Banco de dados ALVO: {target}")
    print("  Acao: apenas INSERT de ate 4 linhas (Processo + Embarque).")
    print("  Nao apaga, nao recria e nao altera nenhum dado existente.")
    print("-" * 72)

    if args.dry_run:
        print("  Modo --dry-run: nada sera escrito.")
        return True
    if args.yes:
        return True
    if not sys.stdin.isatty():
        print("  Entrada nao interativa. Verifique o banco acima e rode com --yes.")
        return False
    resp = input(
        "  Confirma que este e o banco correto (ex.: Supabase de producao)?\n"
        "  Digite 'sim' para continuar: "
    ).strip().lower()
    if resp in {"sim", "s", "yes", "y"}:
        return True
    print("  Abortado. Nenhum dado foi alterado.")
    return False


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Cria apenas os 4 embarques extras do protótipo (idempotente)."
    )
    parser.add_argument(
        "--yes", "-y", action="store_true", help="pula a confirmacao interativa"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="mostra o que seria feito, sem escrever no banco",
    )
    args = parser.parse_args()

    target = _target_description()
    if not _confirm(target, args):
        sys.exit(0)

    created: list[tuple[str, str]] = []
    skipped: list[str] = []
    would_create: list[str] = []

    with get_session() as session:
        client = (
            session.query(QuotationClient)
            .filter(QuotationClient.name == DEMO_CLIENT_NAME)
            .first()
        )
        if client is None:
            print(
                f"  Cliente demo '{DEMO_CLIENT_NAME}' nao encontrado neste banco. "
                "Nada a fazer (este script nao cria o cliente)."
            )
            sys.exit(1)

        # Idempotency key: existing observacoes already recorded for this client.
        existing_obs = set(
            session.execute(
                select(Processo.observacao).where(Processo.client_id == client.id)
            )
            .scalars()
            .all()
        )

        agent_names = {s["agent_name"] for s in EXTRA_SHIPMENTS}
        agents_by_name = {
            a.name: a
            for a in session.execute(
                select(FreightAgent).where(FreightAgent.name.in_(agent_names))
            )
            .scalars()
            .all()
        }

        now = datetime.now(timezone.utc)
        for i, spec in enumerate(EXTRA_SHIPMENTS):
            estado_label = spec["estado"].value
            if spec["observacao"] in existing_obs:
                skipped.append(estado_label)
                continue
            if args.dry_run:
                would_create.append(estado_label)
                continue

            agent = agents_by_name.get(spec["agent_name"])
            processo = processo_repository.create(
                session,
                client_id=client.id,
                quotation_id=None,
                incoterm="FOB",
                modal=Modal.MARITIMO,
                tipo_embarque=TipoEmbarque.FCL,
                tipo_despacho=TipoDespacho.DIRETO,
                carga_urgente=spec["carga_urgente"],
                agente_id=agent.id if agent else None,
                containers=spec["containers"],
                observacao=spec["observacao"],
            )
            # Stagger created_at so the list ordering (urgent first, then newest
            # first) stays deterministic, mirroring seed_prototype.py.
            processo.created_at = now - timedelta(days=3 + i)
            embarque = embarque_repository.create(
                session, processo_id=processo.id, estado=spec["estado"]
            )
            created.append((embarque.reference, estado_label))

    print("-" * 72)
    if args.dry_run:
        print(f"  DRY-RUN — criaria {len(would_create)} embarque(s):")
        for estado in would_create:
            print(f"    + {estado}")
        print(f"  Ja existentes (seriam ignorados): {len(skipped)}.")
        print("  Nada foi escrito.")
    else:
        print(f"  Criados: {len(created)} embarque(s).")
        for ref, estado in created:
            print(f"    + {ref}  ({estado})")
        print(f"  Ja existentes (ignorados): {len(skipped)}.")
        print("  Nenhum dado existente foi apagado ou alterado.")
    print("=" * 72)


if __name__ == "__main__":
    main()
