"""Extend currency enum with GBP, CNY, ARS, CLP, MXN

Revision ID: 057
Revises: 056
Create Date: 2026-05-21

Adds GBP, CNY, ARS, CLP, MXN to the PostgreSQL `currency` enum.
Required because ALTER TYPE ... ADD VALUE cannot run inside a transaction;
each statement must execute in autocommit mode (handled by Alembic's
`op.execute` which runs outside the implicit transaction when
`transaction_per_migration` is not set — Alembic DDL helpers handle this).
"""

import sqlalchemy as sa
from alembic import op

revision = "057"
down_revision = "056"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(sa.text("ALTER TYPE currency ADD VALUE IF NOT EXISTS 'GBP'"))
    op.execute(sa.text("ALTER TYPE currency ADD VALUE IF NOT EXISTS 'CNY'"))
    op.execute(sa.text("ALTER TYPE currency ADD VALUE IF NOT EXISTS 'ARS'"))
    op.execute(sa.text("ALTER TYPE currency ADD VALUE IF NOT EXISTS 'CLP'"))
    op.execute(sa.text("ALTER TYPE currency ADD VALUE IF NOT EXISTS 'MXN'"))


def downgrade():
    # PostgreSQL does not support removing enum values natively.
    # To revert: recreate the type without the new values and migrate all rows.
    pass
