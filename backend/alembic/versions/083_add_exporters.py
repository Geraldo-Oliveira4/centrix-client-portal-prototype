"""Add exporters table and link to quotations (ARB-2443)

Revision ID: 083
Revises: 082
Create Date: 2026-07-02

New Exporter entity: dangerous cargo is a characteristic of the exporter,
not of the importing client, so QuotationClientDna.dangerous_cargo_shipper
was too coarse (one flag per client, but a client can ship through several
exporters with different cargo profiles). Exporters carry name, endereco,
particularidades (collection notes), cargo_profile (Geral/Perigosa/Temp
controlada) and a contact e-mail.

Quotation gains a nullable exporter_id FK so a specific exporter can be
linked per quotation, feeding audit engine rules 1.5/1.6 (DA-001) and the
extraction/recommendation layer with exporter-specific particularities.

dangerous_cargo_shipper is NOT removed from client_dna in this migration —
kept as an additional (OR'd) signal alongside exporter.cargo_profile until
Exporter adoption is proven, same rollback-safety pattern used for
tier/is_vip/destination_yard earlier this sprint.
"""

import sqlalchemy as sa
from alembic import op

revision = "083"
down_revision = "082"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(sa.text("""
        DO $$ BEGIN
            CREATE TYPE exportercargoprofile AS ENUM ('GERAL', 'PERIGOSA', 'TEMP_CONTROLADA');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$
    """))

    # IF NOT EXISTS: the dev DB had this table/column applied out-of-band from
    # its alembic_version tracking (found 08/07/2026 while adding migration
    # 084) — made idempotent so `alembic upgrade head` can safely reconcile
    # the version pointer without erroring on already-existing objects.
    op.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS centrix_exporters (
            id UUID PRIMARY KEY,
            name VARCHAR NOT NULL,
            endereco VARCHAR,
            particularidades TEXT,
            cargo_profile exportercargoprofile NOT NULL DEFAULT 'GERAL',
            contact_email VARCHAR,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ
        )
    """))

    op.execute(sa.text(
        "ALTER TABLE centrix_quotation_quotations "
        "ADD COLUMN IF NOT EXISTS exporter_id UUID "
        "REFERENCES centrix_exporters(id) ON DELETE SET NULL"
    ))


def downgrade():
    op.drop_column("centrix_quotation_quotations", "exporter_id")
    op.drop_table("centrix_exporters")
    op.execute(sa.text("DROP TYPE exportercargoprofile"))
