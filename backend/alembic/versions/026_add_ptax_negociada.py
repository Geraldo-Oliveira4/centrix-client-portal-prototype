"""add ptax_negociada to quotations

Revision ID: 026
Revises: 025
Create Date: 2026-04-17
"""

from alembic import op
import sqlalchemy as sa

revision = "026"
down_revision = "025"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "centrix_quotation_quotations",
        sa.Column("ptax_negociada", sa.String(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("centrix_quotation_quotations", "ptax_negociada")
