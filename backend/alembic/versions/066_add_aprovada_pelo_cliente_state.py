"""Add APROVADA_PELO_CLIENTE to QuotationState enum

Revision ID: 066
Revises: 065
Create Date: 2026-06-03

Adds the APROVADA_PELO_CLIENTE intermediate state between ENVIADA_CLIENTE and
FECHADA. This state is entered when the analyst registers the client's approval
(or when the client approves via the portal), and is exited when the Shipment
Instruction is sent — at which point the quotation transitions to FECHADA.
"""

import sqlalchemy as sa
from alembic import op

revision = "066"
down_revision = "065"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        sa.text("ALTER TYPE quotationstate ADD VALUE IF NOT EXISTS 'APROVADA_PELO_CLIENTE'")
    )


def downgrade():
    # PostgreSQL does not support removing enum values natively.
    # To revert: recreate the type without the new value and migrate all rows.
    pass
