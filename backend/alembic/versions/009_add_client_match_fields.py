"""add sender_email and client match fields to quotations

Revision ID: 009
Revises: 008
Create Date: 2026-03-23

Covers: RF-COT-006, RF-COT-101, RF-COT-103, RF-IA-001
"""

import sqlalchemy as sa
from alembic import op


revision = "009"
down_revision = "008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "centrix_quotation_quotations",
        sa.Column("sender_email", sa.String(), nullable=True),
    )
    op.add_column(
        "centrix_quotation_quotations",
        sa.Column("client_match_status", sa.String(), nullable=True),
    )
    op.add_column(
        "centrix_quotation_quotations",
        sa.Column(
            "client_match_candidates",
            sa.dialects.postgresql.JSONB(),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("centrix_quotation_quotations", "client_match_candidates")
    op.drop_column("centrix_quotation_quotations", "client_match_status")
    op.drop_column("centrix_quotation_quotations", "sender_email")
