"""Add AGENTE_DE_CARGAS to insuranceresponsibility enum

Revision ID: 056
Revises: 055
Create Date: 2026-05-21

Adds the 'AGENTE_DE_CARGAS' value to the insuranceresponsibility PostgreSQL enum.
This covers cases where the insurance is handled by a freight forwarder (agente de
cargas) rather than Freitas or the client directly.
"""

import sqlalchemy as sa
from alembic import op

revision = "056"
down_revision = "055"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        sa.text(
            "ALTER TYPE insuranceresponsibility ADD VALUE IF NOT EXISTS 'AGENTE_DE_CARGAS'"
        )
    )


def downgrade():
    # PostgreSQL does not support removing enum values natively.
    # To revert: recreate the type without AGENTE_DE_CARGAS and migrate all rows.
    pass
