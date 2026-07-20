"""Add necessidade_descarga and ncm to quotations

Revision ID: 060
Revises: 059
Create Date: 2026-05-21

DPU (Delivered at Place Unloaded): seller is responsible for unloading; the
necessidade_descarga flag captures whether the client has a specific unloading
requirement that must be surfaced to the freight agent.

DDP (Delivered Duty Paid): full customs clearance is required; NCM is mandatory
for customs declaration and duty calculation.
"""

import sqlalchemy as sa
from alembic import op

revision = "060"
down_revision = "059"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "centrix_quotation_quotations",
        sa.Column("necessidade_descarga", sa.Boolean(), nullable=True),
    )
    op.add_column(
        "centrix_quotation_quotations",
        sa.Column("ncm", sa.String(), nullable=True),
    )


def downgrade():
    op.drop_column("centrix_quotation_quotations", "ncm")
    op.drop_column("centrix_quotation_quotations", "necessidade_descarga")
