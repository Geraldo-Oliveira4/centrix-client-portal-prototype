"""Add observations field to proposals

Revision ID: 032
Revises: 031
Create Date: 2026-04-23
"""

import sqlalchemy as sa
from alembic import op

revision = "032"
down_revision = "031"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "centrix_quotation_proposals",
        sa.Column("observations", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("centrix_quotation_proposals", "observations")
