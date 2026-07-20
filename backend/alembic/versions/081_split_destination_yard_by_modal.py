"""Split destination_yard by modal in client_dna (ARB-2384)

Revision ID: 081
Revises: 080
Create Date: 2026-07-02

destination_yard was a single free-text field where analysts encoded
per-modal yards using text headers (AEREO: / MARITIMO FCL: / MARITIMO LCL:).
The frontend parser (frontend/utils/quotation-fields.ts) resolved the wrong
section when the modal was not yet selected on the new-quotation form
(ARB-2384, JARTEC case), leaking the air yard into a maritime RFQ.

Adds 3 typed columns and backfills them from the legacy text using the
same header-matching algorithm previously implemented in the frontend
parser (_resolveSectionKey/_extractSectionValue). destination_yard is kept
(nullable, unwritten by new code) for rollback safety — same pattern used
when tier/VIP badge were retired from the DNA UI earlier this sprint.

Ambiguous legacy values (generic "MARITIMO" header with no FCL/LCL
sub-header, or non-modal headers such as "CNPJ 04: ...") cannot be safely
split into a single yard per sub-type: a generic MARITIMO header is
broadcast to both FCL and LCL (best-effort match to analyst intent); rows
with no recognizable modal header are left with the new columns NULL and
are logged for manual review — destination_yard remains the source of
truth for them until an analyst re-enters the DNA via the new form.
"""

import re

import sqlalchemy as sa
from alembic import op

revision = "081"
down_revision = "080"
branch_labels = None
depends_on = None

_HEADER_RE = re.compile(
    r"[ \t]+(AÉREO|MARÍTIMO(?:[ \t]+(?:FCL|LCL|BREAK[ \t]+BULK))?|RODOVIÁRIO)\s*:",
)

_KNOWN_HEADERS = {
    "AÉREO",
    "MARÍTIMO FCL",
    "MARÍTIMO LCL",
    "MARÍTIMO",
    "MARÍTIMO BREAK BULK",
    "RODOVIÁRIO",
}


def _split_sections(raw: str) -> dict:
    normalized = _HEADER_RE.sub(r"\n\1:", raw)
    sections = {}
    for line in normalized.split("\n"):
        line = line.strip()
        if ":" not in line:
            continue
        header, _, value = line.partition(":")
        sections[header.strip().upper()] = value.strip()
    return sections


def _resolve_new_columns(raw):
    """Returns (aereo, maritimo_fcl, maritimo_lcl), or (None, None, None) when unparseable."""
    if not raw or not raw.strip():
        return None, None, None

    sections = _split_sections(raw)
    if not sections or not (set(sections) & _KNOWN_HEADERS):
        return None, None, None

    aereo = sections.get("AÉREO")
    fcl = sections.get("MARÍTIMO FCL")
    lcl = sections.get("MARÍTIMO LCL")
    generic_maritime = sections.get("MARÍTIMO")
    if generic_maritime:
        fcl = fcl or generic_maritime
        lcl = lcl or generic_maritime
    return aereo, fcl, lcl


def upgrade():
    # IF NOT EXISTS: the dev DB had these columns applied out-of-band from its
    # alembic_version tracking (found 08/07/2026 while adding migration 084) —
    # made idempotent so `alembic upgrade head` can safely reconcile the
    # version pointer without erroring on already-existing columns.
    op.execute(sa.text(
        "ALTER TABLE centrix_quotation_client_dna "
        "ADD COLUMN IF NOT EXISTS destination_yard_aereo VARCHAR"
    ))
    op.execute(sa.text(
        "ALTER TABLE centrix_quotation_client_dna "
        "ADD COLUMN IF NOT EXISTS destination_yard_maritimo_fcl VARCHAR"
    ))
    op.execute(sa.text(
        "ALTER TABLE centrix_quotation_client_dna "
        "ADD COLUMN IF NOT EXISTS destination_yard_maritimo_lcl VARCHAR"
    ))

    conn = op.get_bind()
    rows = conn.execute(
        sa.text(
            "SELECT id, destination_yard FROM centrix_quotation_client_dna "
            "WHERE destination_yard IS NOT NULL"
        )
    ).fetchall()

    unparsed = []
    for dna_id, raw in rows:
        aereo, fcl, lcl = _resolve_new_columns(raw)
        if aereo is None and fcl is None and lcl is None:
            unparsed.append(str(dna_id))
            continue
        conn.execute(
            sa.text(
                "UPDATE centrix_quotation_client_dna "
                "SET destination_yard_aereo = :aereo, "
                "destination_yard_maritimo_fcl = :fcl, "
                "destination_yard_maritimo_lcl = :lcl "
                "WHERE id = :id"
            ),
            {"aereo": aereo, "fcl": fcl, "lcl": lcl, "id": dna_id},
        )

    if unparsed:
        print(
            f"[081] {len(unparsed)} DNA row(s) could not be auto-split from "
            f"destination_yard, needs manual review: {unparsed}"
        )


def downgrade():
    op.drop_column("centrix_quotation_client_dna", "destination_yard_maritimo_lcl")
    op.drop_column("centrix_quotation_client_dna", "destination_yard_maritimo_fcl")
    op.drop_column("centrix_quotation_client_dna", "destination_yard_aereo")
