"""Add carga_perigosa to proposals

Revision ID: 037
Revises: 036
Create Date: 2026-04-27

Adds carga_perigosa field to proposals table for ARB-1961.
"""

import sqlalchemy as sa
from alembic import op

revision = "037"
down_revision = "036"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "centrix_quotation_proposals",
        sa.Column("carga_perigosa", sa.String(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("centrix_quotation_proposals", "carga_perigosa")
