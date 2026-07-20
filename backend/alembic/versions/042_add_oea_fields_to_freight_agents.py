"""Add OEA certification fields to freight agents

Revision ID: 042
Revises: 041
Create Date: 2026-05-06

Adds certificacao_oea (bool) and data_validade_oea (date) to
centrix_quotation_freight_agents to support the OEA dispatch filter.
"""

import sqlalchemy as sa
from alembic import op

revision = "042"
down_revision = "041"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "centrix_quotation_freight_agents",
        sa.Column("certificacao_oea", sa.Boolean, nullable=True),
    )
    op.add_column(
        "centrix_quotation_freight_agents",
        sa.Column("data_validade_oea", sa.Date, nullable=True),
    )


def downgrade() -> None:
    op.drop_column("centrix_quotation_freight_agents", "data_validade_oea")
    op.drop_column("centrix_quotation_freight_agents", "certificacao_oea")
