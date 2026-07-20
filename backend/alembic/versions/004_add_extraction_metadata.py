"""add extraction metadata columns to quotations

Revision ID: 004
Revises: 003
Create Date: 2026-03-19

Adds columns to track AI extraction results: confidence scores per field,
extraction status, model used, and timestamp.
"""

import sqlalchemy as sa
from alembic import op

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None

_TABLE = "centrix_quotation_quotations"


def upgrade() -> None:
    op.add_column(_TABLE, sa.Column("confidence_scores", sa.JSON(), nullable=True))
    op.add_column(_TABLE, sa.Column("extraction_status", sa.String(), nullable=True))
    op.add_column(_TABLE, sa.Column("extraction_model", sa.String(), nullable=True))
    op.add_column(
        _TABLE,
        sa.Column("extracted_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column(_TABLE, "extracted_at")
    op.drop_column(_TABLE, "extraction_model")
    op.drop_column(_TABLE, "extraction_status")
    op.drop_column(_TABLE, "confidence_scores")
