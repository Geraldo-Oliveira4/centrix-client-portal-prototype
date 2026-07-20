"""Remove bl_consolidado column — redundant for LCL (always consolidated by definition)

Revision ID: 033
Revises: 032
Create Date: 2026-04-23
"""

import sqlalchemy as sa
from alembic import op

revision = "033"
down_revision = "032"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("centrix_quotation_quotations", "bl_consolidado")


def downgrade() -> None:
    op.add_column(
        "centrix_quotation_quotations",
        sa.Column("bl_consolidado", sa.Boolean(), nullable=True),
    )
