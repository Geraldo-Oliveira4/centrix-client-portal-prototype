"""Add CANCELADO to quotationstate enum.

Revision ID: 014
Revises: 013
Create Date: 2026-04-01
"""

from alembic import op
import sqlalchemy as sa

revision = "014"
down_revision = "013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(sa.text("ALTER TYPE quotationstate ADD VALUE IF NOT EXISTS 'CANCELADO'"))


def downgrade() -> None:
    # PostgreSQL does not support removing enum values directly.
    # To roll back, recreate the enum without CANCELADO and migrate affected rows.
    pass
