"""add RODOVIARIO to modal enum

Revision ID: 028
Revises: 027
Create Date: 2026-04-20
"""

from alembic import op
import sqlalchemy as sa

revision = "028"
down_revision = "027"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(sa.text("ALTER TYPE modal ADD VALUE IF NOT EXISTS 'RODOVIARIO'"))


def downgrade() -> None:
    # PostgreSQL does not support removing enum values; handled manually if needed
    pass
