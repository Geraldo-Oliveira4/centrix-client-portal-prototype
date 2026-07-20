"""add route_type to proposals

Revision ID: 069
Revises: 068
Create Date: 2026-06-03

"""
from alembic import op
import sqlalchemy as sa


revision = "069"
down_revision = "068"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        sa.text(
            """
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_type WHERE typname = 'proposal_route_type'
                ) THEN
                    CREATE TYPE proposal_route_type AS ENUM ('DIRETA', 'TRANSBORDO');
                END IF;
            END $$;
            """
        )
    )
    op.execute(
        sa.text(
            """
            ALTER TABLE centrix_quotation_proposals
            ADD COLUMN IF NOT EXISTS route_type proposal_route_type
            """
        )
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            "ALTER TABLE centrix_quotation_proposals DROP COLUMN IF EXISTS route_type"
        )
    )
    op.execute(sa.text("DROP TYPE IF EXISTS proposal_route_type"))
