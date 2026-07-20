"""add currency fields to proposals

Revision ID: 040
Revises: 039
Create Date: 2026-05-02

Adds taxes_currency_breakdown (JSONB) and freight_currency (VARCHAR) to
centrix_quotation_proposals. Both are nullable so existing proposals are
unaffected — they will display using the legacy USD-only assumption.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "040"
down_revision = "039"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "centrix_quotation_proposals",
        sa.Column("taxes_currency_breakdown", JSONB, nullable=True),
    )
    op.add_column(
        "centrix_quotation_proposals",
        sa.Column("freight_currency", sa.String(3), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("centrix_quotation_proposals", "freight_currency")
    op.drop_column("centrix_quotation_proposals", "taxes_currency_breakdown")
