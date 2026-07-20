"""Drop certificacao_anvisa column from freight agents

Revision ID: 055
Revises: 054
Create Date: 2026-05-14

Migration 053 was applied to production in an intermediate form that added
carga_imo as a new column without renaming certificacao_anvisa. This migration
drops the now-orphaned certificacao_anvisa column. The audit motor D2 rule was
updated to use carga_imo (same semantic: agent certification for IMO/ANVISA cargo).
"""

import sqlalchemy as sa
from alembic import op

revision = "055"
down_revision = "054"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(sa.text(
        "ALTER TABLE centrix_quotation_freight_agents DROP COLUMN IF EXISTS certificacao_anvisa"
    ))


def downgrade() -> None:
    op.add_column(
        "centrix_quotation_freight_agents",
        sa.Column("certificacao_anvisa", sa.Boolean, nullable=True),
    )
