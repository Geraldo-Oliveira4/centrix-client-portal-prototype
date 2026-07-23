"""Add client_id to exporters — portal self-service exporter registration

Revision ID: 090
Revises: 089
Create Date: 2026-07-22

PROTOTYPE-ONLY migration (does not exist in Centrix). Migration 083 created
centrix_exporters as a globally-scoped, analyst-managed catalogue: every
exporter is visible to every quotation. The Client Portal needs the opposite —
a client registers their own exporters and must never see (or link) another
client's.

client_id is nullable so the two populations coexist without a backfill:

    client_id IS NULL  -> analyst-registered, global (pre-existing rows)
    client_id = <uuid> -> registered by that client through the portal

The portal list/create handlers always filter on client_id, so a portal user
only ever sees their own rows. ON DELETE CASCADE: an exporter registered by a
client has no meaning once the client is gone.
"""

import sqlalchemy as sa
from alembic import op

revision = "090"
down_revision = "089"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(sa.text(
        "ALTER TABLE centrix_exporters "
        "ADD COLUMN IF NOT EXISTS client_id UUID "
        "REFERENCES centrix_quotation_clients(id) ON DELETE CASCADE"
    ))
    # The portal lists exporters by owner on every page load of the new-quotation
    # form; without this the filter degrades to a seq scan on a table the analyst
    # side keeps appending to.
    op.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_centrix_exporters_client_id "
        "ON centrix_exporters (client_id)"
    ))


def downgrade():
    op.execute(sa.text("DROP INDEX IF EXISTS ix_centrix_exporters_client_id"))
    op.drop_column("centrix_exporters", "client_id")
