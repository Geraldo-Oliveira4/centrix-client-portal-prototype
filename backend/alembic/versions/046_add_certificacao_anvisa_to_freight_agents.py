"""Add certificacao_anvisa field to freight agents

Revision ID: 046
Revises: 045
Create Date: 2026-05-07

Adds certificacao_anvisa (bool, nullable) to centrix_quotation_freight_agents
to support the D2 audit rule that checks whether an agent holds ANVISA
certification when the client DNA requires it.
"""

import sqlalchemy as sa
from alembic import op

revision = "046"
down_revision = "045"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "centrix_quotation_freight_agents",
        sa.Column("certificacao_anvisa", sa.Boolean, nullable=True),
    )


def downgrade() -> None:
    op.drop_column("centrix_quotation_freight_agents", "certificacao_anvisa")
