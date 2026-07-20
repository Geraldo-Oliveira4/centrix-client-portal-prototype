"""Add proposal soft delete (ARB-2429)

Revision ID: 086
Revises: 085
Create Date: 2026-07-13

Adds a nullable `deleted_at` timestamp to `centrix_quotation_proposals` so
agents/analysts can hide proposals without losing the audit trail.
"""

import sqlalchemy as sa
from alembic import op

revision = "086"
down_revision = "085"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "centrix_quotation_proposals",
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade():
    op.drop_column("centrix_quotation_proposals", "deleted_at")
