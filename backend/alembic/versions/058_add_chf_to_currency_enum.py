"""Add CHF to currency enum

Revision ID: 058
Revises: 057
Create Date: 2026-05-21

Adds CHF (Swiss Franc) to the PostgreSQL `currency` enum.
"""

import sqlalchemy as sa
from alembic import op

revision = "058"
down_revision = "057"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(sa.text("ALTER TYPE currency ADD VALUE IF NOT EXISTS 'CHF'"))


def downgrade():
    # PostgreSQL does not support removing enum values natively.
    # To revert: recreate the type without CHF and migrate all rows.
    pass
