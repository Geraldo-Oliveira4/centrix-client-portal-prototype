"""add attachment fields to proposals

Revision ID: 010
Revises: 009
Create Date: 2026-03-28

Covers: RF-COT-030
"""

import sqlalchemy as sa
from alembic import op


revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "centrix_quotation_proposals",
        sa.Column("original_email_s3_key", sa.String(), nullable=True),
    )
    op.add_column(
        "centrix_quotation_proposals",
        sa.Column(
            "attachments_s3_keys",
            sa.dialects.postgresql.JSONB(),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("centrix_quotation_proposals", "attachments_s3_keys")
    op.drop_column("centrix_quotation_proposals", "original_email_s3_key")
