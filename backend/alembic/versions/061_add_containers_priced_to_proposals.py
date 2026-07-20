"""Add containers_priced to proposals

Revision ID: 061
Revises: 060
Create Date: 2026-05-21

For FCL quotations the agent must declare how many containers they are pricing.
This allows the audit motor to detect quantity mismatches (e.g. client requested
5 containers but agent priced only 1).
"""

import sqlalchemy as sa
from alembic import op

revision = "061"
down_revision = "060"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "centrix_quotation_proposals",
        sa.Column("containers_priced", sa.Integer(), nullable=True),
    )


def downgrade():
    op.drop_column("centrix_quotation_proposals", "containers_priced")
