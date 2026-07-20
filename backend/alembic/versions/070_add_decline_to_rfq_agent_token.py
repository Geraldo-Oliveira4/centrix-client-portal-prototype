"""add declined_at and decline_reason to rfq_agent_token

Revision ID: 070
Revises: 069
Create Date: 2026-06-08

"""
from alembic import op
import sqlalchemy as sa


revision = "070"
down_revision = "069"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        sa.text(
            """
            ALTER TABLE centrix_quotation_rfq_agent_tokens
            ADD COLUMN IF NOT EXISTS declined_at TIMESTAMP WITH TIME ZONE,
            ADD COLUMN IF NOT EXISTS decline_reason TEXT
            """
        )
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            """
            ALTER TABLE centrix_quotation_rfq_agent_tokens
            DROP COLUMN IF EXISTS declined_at,
            DROP COLUMN IF EXISTS decline_reason
            """
        )
    )
