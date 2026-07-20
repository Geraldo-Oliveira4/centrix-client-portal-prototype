"""add extraction fields to proposals

Revision ID: 011
Revises: 010
Create Date: 2026-03-28

Covers: ARB-1731
"""

import sqlalchemy as sa
from alembic import op


revision = "011"
down_revision = "010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "centrix_quotation_proposals",
        sa.Column("extraction_status", sa.String(), nullable=True),
    )
    op.add_column(
        "centrix_quotation_proposals",
        sa.Column("extraction_model", sa.String(), nullable=True),
    )
    op.add_column(
        "centrix_quotation_proposals",
        sa.Column(
            "extracted_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )
    op.add_column(
        "centrix_quotation_proposals",
        sa.Column(
            "confidence_scores",
            sa.dialects.postgresql.JSONB(),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("centrix_quotation_proposals", "confidence_scores")
    op.drop_column("centrix_quotation_proposals", "extracted_at")
    op.drop_column("centrix_quotation_proposals", "extraction_model")
    op.drop_column("centrix_quotation_proposals", "extraction_status")
