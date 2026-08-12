"""Top-up: preenche o PO do cliente (`client_reference`) nas cotacoes semeadas.

Por que este script existe
--------------------------
`client_reference` e a referencia do proprio cliente (o numero da PO dele) e ja
existia como coluna real — o formulario de Nova Cotacao sempre gravou. O que
mudou foi o portal passar a EXIBIR e PESQUISAR por ela ao longo da jornada
(Funil, Historico e Meus Embarques). Num banco limpo o `seed_prototype.py` ja
nasce com os POs; num banco que foi semeado antes disso, as nove cotacoes tem
`client_reference = NULL` e a jornada por PO nao tem o que mostrar.

`seed_prototype.py` e skip-if-exists (sai sem fazer nada se o CLIENTE DEMO ja
existir), entao acrescentar valor ao seed nao alcanca banco ja populado. Este
script alcanca — mesma disciplina do topup_funnel_quotations.py e do
topup_tracking_demo.py.

O PO nao propaga por copia: o embarque le a PO da cotacao que o originou, pelo
join `Processo.quotation_id -> Quotation.client_reference`
(portal_shipment_repository). Por isso este script grava em UM lugar so, a
cotacao, e o EMB-2026-0001 (provisionado a partir da COT-2026-0004) passa a
mostrar a mesma PO sem nenhuma escrita em embarque. Os demais embarques do seed
nascem sem `quotation_id` (processos que o analista abriu fora do portal) e
continuam sem PO — ausencia correta, nao lacuna a preencher.

Contrato de seguranca
---------------------
- Dry-run por padrao: sem `--apply` a transacao termina em ROLLBACK.
- UPDATE apenas na coluna `client_reference`, e apenas onde ela esta NULL.
  Cotacao que ja tem PO (inclusive as criadas pela suite e2e ou pelo proprio
  cliente no portal) e PULADA, nunca sobrescrita.
- Escopo travado no CLIENTE DEMO e nas referencias listadas em PO_BY_REFERENCE.
  Cotacao de outro cliente nunca entra no plano.
- Cotacao ja preenchida e PULADA, nao aborta o lote; so aborta se nao sobrar
  nada a fazer.
- Confere os deltas de linha antes de commitar: este script nao cria nem apaga
  linha nenhuma, entao qualquer delta != 0 vira ROLLBACK, mesmo com `--apply`.

Uso (a partir de backend/):
    .venv/bin/python -m scripts.topup_client_po           # dry-run
    .venv/bin/python -m scripts.topup_client_po --apply   # grava
"""

import argparse
import sys

from dotenv import load_dotenv

load_dotenv()

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from shared.database.connection import get_engine
from shared.database.models.quotation.client import QuotationClient
from shared.database.models.quotation.quotation import Quotation

DEMO_CLIENT_NAME = "CLIENTE DEMO"

# Os mesmos valores que o seed passou a gravar. A COT-2026-0006 (cancelada) fica
# de fora de proposito: o campo e opcional e as telas precisam ler direito quando
# ele esta ausente.
PO_BY_REFERENCE = {
    "COT-2026-0001": "PO-2026-1180",
    "COT-2026-0002": "PO-2026-1181",
    "COT-2026-0003": "PO-2026-1182",
    "COT-2026-0004": "PO-2026-1183",
    "COT-2026-0005": "PO-2026-1184",
    "COT-2026-0007": "PO-2026-1186",
    "COT-2026-0008": "PO-2026-1187",
    "COT-2026-0009": "PO-2026-1188",
}


def _fail(message: str) -> None:
    print(f"ABORT: {message}")
    sys.exit(1)


def _counts(session: Session) -> dict:
    return {
        "quotations": session.execute(
            select(func.count()).select_from(Quotation)
        ).scalar_one(),
    }


def run(apply: bool) -> None:
    engine = get_engine()
    with Session(engine) as session:
        client = session.execute(
            select(QuotationClient).where(QuotationClient.name == DEMO_CLIENT_NAME)
        ).scalar_one_or_none()
        if client is None:
            _fail(
                f"cliente demo nao encontrado ({DEMO_CLIENT_NAME}). Rode o seed antes."
            )

        rows = session.execute(
            select(Quotation).where(
                Quotation.client_id == client.id,
                Quotation.reference.in_(PO_BY_REFERENCE.keys()),
            )
        ).scalars().all()

        missing = sorted(set(PO_BY_REFERENCE) - {q.reference for q in rows})
        pending = [q for q in rows if q.client_reference is None]
        skipped = [q for q in rows if q.client_reference is not None]

        before = _counts(session)

        print("Plano:")
        for q in sorted(pending, key=lambda x: x.reference):
            print(f"  {q.reference}: NULL -> {PO_BY_REFERENCE[q.reference]}")
        for q in sorted(skipped, key=lambda x: x.reference):
            print(f"  {q.reference}: PULADO (ja tem PO {q.client_reference})")
        for reference in missing:
            print(f"  {reference}: PULADO (cotacao nao existe neste banco)")

        if not pending:
            _fail(
                "nada a fazer: todas as cotacoes do escopo ja tem PO ou nao "
                "existem neste banco."
            )

        for q in pending:
            q.client_reference = PO_BY_REFERENCE[q.reference]

        session.flush()

        after = _counts(session)
        deltas = {k: after[k] - before[k] for k in before}
        # Este script so faz UPDATE; qualquer linha criada ou apagada aqui e bug.
        expected = {"quotations": 0}
        print(f"\nDeltas de linha: {deltas} (esperado {expected})")

        if deltas != expected:
            session.rollback()
            _fail(f"deltas inesperados: {deltas} != {expected}. Nada foi gravado.")

        if not apply:
            session.rollback()
            print("\nDRY-RUN: rollback executado, nada foi gravado.")
            print("Rode com --apply para gravar.")
            return

        session.commit()
        print(f"\nAPLICADO: {len(pending)} cotacoes receberam o PO do cliente.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--apply", action="store_true", help="grava (sem esta flag e dry-run)"
    )
    run(parser.parse_args().apply)
