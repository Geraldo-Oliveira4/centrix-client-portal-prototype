"""Add full client data fields (ARB-2444)

Revision ID: 082
Revises: 081
Create Date: 2026-07-02

Adds CNPJ, razao social, endereco, and Importador/Adquirente fields to
QuotationClient. Some clients import through a trading company, so the
importer of record (importador) can differ from the actual buyer of the
goods (adquirente). importacao_direta flags when they are the same party
(hides the Adquirente field in the UI).

Used to reduce documentary errors in the Shipment Instruction sent to
agents (client CNPJ/endereco pre-fill the consignatario party block).
"""

import sqlalchemy as sa
from alembic import op

revision = "082"
down_revision = "081"
branch_labels = None
depends_on = None


def upgrade():
    # IF NOT EXISTS: the dev DB had these columns applied out-of-band from its
    # alembic_version tracking (found 08/07/2026 while adding migration 084) —
    # made idempotent so `alembic upgrade head` can safely reconcile the
    # version pointer without erroring on already-existing columns.
    op.execute(sa.text(
        "ALTER TABLE centrix_quotation_clients ADD COLUMN IF NOT EXISTS cnpj VARCHAR"
    ))
    op.execute(sa.text(
        "ALTER TABLE centrix_quotation_clients ADD COLUMN IF NOT EXISTS razao_social VARCHAR"
    ))
    op.execute(sa.text(
        "ALTER TABLE centrix_quotation_clients ADD COLUMN IF NOT EXISTS endereco VARCHAR"
    ))
    op.execute(sa.text(
        "ALTER TABLE centrix_quotation_clients ADD COLUMN IF NOT EXISTS importador VARCHAR"
    ))
    op.execute(sa.text(
        "ALTER TABLE centrix_quotation_clients ADD COLUMN IF NOT EXISTS adquirente VARCHAR"
    ))
    op.execute(sa.text(
        "ALTER TABLE centrix_quotation_clients "
        "ADD COLUMN IF NOT EXISTS importacao_direta BOOLEAN NOT NULL DEFAULT false"
    ))


def downgrade():
    op.drop_column("centrix_quotation_clients", "importacao_direta")
    op.drop_column("centrix_quotation_clients", "adquirente")
    op.drop_column("centrix_quotation_clients", "importador")
    op.drop_column("centrix_quotation_clients", "endereco")
    op.drop_column("centrix_quotation_clients", "razao_social")
    op.drop_column("centrix_quotation_clients", "cnpj")
