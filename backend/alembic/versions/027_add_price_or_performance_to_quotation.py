"""add price_or_performance to quotations

Revision ID: 027
Revises: 026
Create Date: 2026-04-17
"""

from alembic import op
import sqlalchemy as sa

revision = "027"
down_revision = "026"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        sa.text(
            "ALTER TABLE centrix_quotation_quotations "
            "ADD COLUMN IF NOT EXISTS price_or_performance priceorperformance"
        )
    )


def downgrade() -> None:
    op.drop_column("centrix_quotation_quotations", "price_or_performance")
