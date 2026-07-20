"""Add sent_at, closed_at, declined_at to quotations (ARB-2393)

Revision ID: 079
Revises: 078
Create Date: 2026-07-03

Durable state-transition timestamps on centrix_quotation_quotations, stamped by
the state machine when a quotation enters the corresponding state:
- sent_at: last transition into ENVIADA_CLIENTE (sent to client)
- closed_at: last transition into FECHADA (deal closed)
- declined_at: last transition into DECLINADA (declined by the client)

These replace a fragile derivation from the append-only audit log
(centrix_quotation_logs). The log remains the history; the columns are the
authoritative domain fact and survive log pruning/archival.

The upgrade backfills each column from the most recent matching transition
already recorded in the logs, so existing quotations keep their dates.
"""

import sqlalchemy as sa
from alembic import op

revision = "079"
down_revision = "078"
branch_labels = None
depends_on = None


_BACKFILL = """
    UPDATE centrix_quotation_quotations q
    SET {column} = sub.ts
    FROM (
        SELECT quotation_id, MAX(created_at) AS ts
        FROM centrix_quotation_logs
        WHERE new_state = '{state}'
        GROUP BY quotation_id
    ) sub
    WHERE q.id = sub.quotation_id
"""


def upgrade() -> None:
    op.add_column(
        "centrix_quotation_quotations",
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "centrix_quotation_quotations",
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "centrix_quotation_quotations",
        sa.Column("declined_at", sa.DateTime(timezone=True), nullable=True),
    )

    # Backfill from the existing audit log so no current card loses its date.
    op.execute(sa.text(_BACKFILL.format(column="sent_at", state="ENVIADA_CLIENTE")))
    op.execute(sa.text(_BACKFILL.format(column="closed_at", state="FECHADA")))
    op.execute(sa.text(_BACKFILL.format(column="declined_at", state="DECLINADA")))


def downgrade() -> None:
    op.drop_column("centrix_quotation_quotations", "declined_at")
    op.drop_column("centrix_quotation_quotations", "closed_at")
    op.drop_column("centrix_quotation_quotations", "sent_at")
