"""Add client_portal_contacts table, decoupled from client_dna.contact_email (ARB-2501)

Revision ID: 088
Revises: 087
Create Date: 2026-07-14

Client feedback (Victor Orsi, 14/07): only one e-mail per client could
self-register for the client portal (QuotationClientDna.contact_email is a
single string column), and that same column also feeds the shipment
instruction consignee e-mail — an unrelated business use. This migration
introduces a dedicated centrix_client_portal_contacts table (many rows per
client) exclusively for portal registration authorisation, leaving
client_dna.contact_email untouched for its existing SI-consignee use.

Existing single contact_email values are backfilled into the new table so
already-registered portal users are not affected. contact_email has no
uniqueness constraint today, so two clients could in principle share the
same value; the backfill INSERT uses ON CONFLICT (email) DO NOTHING against
the new UNIQUE constraint, which would otherwise silently drop every row
but the first for a duplicated e-mail. A RAISE NOTICE pass runs first so
`alembic upgrade` output surfaces exactly which client_id/e-mail pairs will
be skipped, for manual review before/after applying.
"""

import sqlalchemy as sa
from alembic import op

revision = "088"
down_revision = "087"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(sa.text("""
        CREATE TABLE centrix_client_portal_contacts (
            id UUID PRIMARY KEY,
            client_id UUID NOT NULL REFERENCES centrix_quotation_clients(id) ON DELETE CASCADE,
            email VARCHAR NOT NULL UNIQUE,
            name VARCHAR,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """))

    op.execute(sa.text("""
        DO $$
        DECLARE
            dup RECORD;
        BEGIN
            FOR dup IN
                SELECT lower(trim(contact_email)) AS email, array_agg(client_id) AS client_ids
                FROM centrix_quotation_client_dna
                WHERE contact_email IS NOT NULL AND trim(contact_email) <> ''
                GROUP BY lower(trim(contact_email))
                HAVING count(*) > 1
            LOOP
                RAISE NOTICE 'client_portal_contacts backfill: e-mail % is shared by clients % — only one will be kept, the rest are skipped (ON CONFLICT DO NOTHING)', dup.email, dup.client_ids;
            END LOOP;
        END $$
    """))

    op.execute(sa.text("""
        INSERT INTO centrix_client_portal_contacts (id, client_id, email, name, created_at)
        SELECT gen_random_uuid(), client_id, lower(trim(contact_email)), contact_name, now()
        FROM centrix_quotation_client_dna
        WHERE contact_email IS NOT NULL AND trim(contact_email) <> ''
        ON CONFLICT (email) DO NOTHING
    """))


def downgrade():
    op.drop_table("centrix_client_portal_contacts")
