"""add review_status and review_reason to proposals

Revision ID: 012
Revises: 011
Create Date: 2026-03-28

Covers: ARB-1733
"""

import sqlalchemy as sa
from alembic import op

revision = "012"
down_revision = "011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "centrix_quotation_proposals",
        sa.Column("review_status", sa.String(), nullable=True),
    )
    op.add_column(
        "centrix_quotation_proposals",
        sa.Column("review_reason", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("centrix_quotation_proposals", "review_reason")
    op.drop_column("centrix_quotation_proposals", "review_status")
