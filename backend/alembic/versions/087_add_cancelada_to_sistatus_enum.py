"""Add CANCELADA to sistatus enum

Revision ID: 087
Revises: 086
Create Date: 2026-07-13

Reopening a FECHADA quotation back to COTANDO (to switch winning agent) now
cancels any Shipment Instruction already generated for the old closing, so
create_shipment_instruction can issue a fresh draft for the new agent instead
of returning the stale one (idempotent-by-quotation_id lookup previously had
no way to distinguish a superseded SI from an active one).
"""

import sqlalchemy as sa
from alembic import op

revision = "087"
down_revision = "086"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(sa.text("ALTER TYPE sistatus ADD VALUE IF NOT EXISTS 'CANCELADA'"))


def downgrade():
    # PostgreSQL does not support removing enum values natively.
    # To revert: recreate the type without CANCELADA and migrate all rows.
    pass
