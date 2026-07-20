"""Add portal proposal signals

Revision ID: 052
Revises: 051
Create Date: 2026-05-05

Adds three nullable fields on centrix_quotation_proposals to support the
client portal: a recommendation score (0-100), a boolean flag for the
recommended proposal, and a JSONB list of additional possible costs
(coleta, demurrage, etc.) shown on the proposal detail card.

These fields are intentionally null until the analytics pipeline starts
populating them — the portal renders the corresponding UI sections only
when data is present.
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision = "052"
down_revision = "051"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = {c["name"] for c in inspector.get_columns("centrix_quotation_proposals")}

    if "recommendation_score" not in existing:
        op.add_column(
            "centrix_quotation_proposals",
            sa.Column("recommendation_score", sa.Numeric(5, 2), nullable=True),
        )
    if "is_recommended" not in existing:
        op.add_column(
            "centrix_quotation_proposals",
            sa.Column("is_recommended", sa.Boolean(), nullable=True),
        )
    if "additional_costs" not in existing:
        op.add_column(
            "centrix_quotation_proposals",
            sa.Column(
                "additional_costs",
                postgresql.JSONB(astext_type=sa.Text()),
                nullable=True,
            ),
        )


def downgrade() -> None:
    op.drop_column("centrix_quotation_proposals", "additional_costs")
    op.drop_column("centrix_quotation_proposals", "is_recommended")
    op.drop_column("centrix_quotation_proposals", "recommendation_score")
