"""add rfq table

Revision ID: 007
Revises: 006
Create Date: 2026-03-22

Covers: RF-COT-025 (RFQ form), RF-COT-026 (agent targeting + dispatch timestamp)
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "007"
down_revision = "006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "centrix_quotation_rfqs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "quotation_id",
            UUID(as_uuid=True),
            sa.ForeignKey("centrix_quotation_quotations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("agents_targeted", JSONB, nullable=False),
        sa.Column("template_data", JSONB, nullable=False),
        sa.Column("include_insurance", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("destination_yard", sa.String, nullable=True),
        sa.Column("particularities", sa.Text, nullable=True),
        sa.Column("dispatched_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index(
        "ix_rfqs_quotation_id",
        "centrix_quotation_rfqs",
        ["quotation_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_rfqs_quotation_id", table_name="centrix_quotation_rfqs")
    op.drop_table("centrix_quotation_rfqs")
