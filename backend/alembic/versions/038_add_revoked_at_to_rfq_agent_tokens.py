"""Add revoked_at to rfq_agent_tokens

Revision ID: 038
Revises: 037
Create Date: 2026-04-28

Adds revoked_at field to track invalidated tokens for ARB-1929.
"""

import sqlalchemy as sa
from alembic import op

revision = "038"
down_revision = "037"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "centrix_quotation_rfq_agent_tokens",
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("centrix_quotation_rfq_agent_tokens", "revoked_at")
