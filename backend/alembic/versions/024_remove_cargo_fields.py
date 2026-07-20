"""024 — remove cargo fields from quotations

Removes weight, volume, quantity, and dimensions columns from the
quotation table as these are now handled by line items (equipments/volumes).
Related to ARB-1838 (remove duplicate cargo fields from quotation flow).

Revision ID: 024
Revises: 023
"""

import sqlalchemy as sa
from alembic import op


revision = "024"
down_revision = "023"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("centrix_quotation_quotations", "weight")
    op.drop_column("centrix_quotation_quotations", "volume")
    op.drop_column("centrix_quotation_quotations", "quantity")
    op.drop_column("centrix_quotation_quotations", "dimensions")


def downgrade() -> None:
    op.add_column(
        "centrix_quotation_quotations",
        sa.Column("weight", sa.Numeric(12, 3), nullable=True),
    )
    op.add_column(
        "centrix_quotation_quotations",
        sa.Column("volume", sa.Numeric(12, 3), nullable=True),
    )
    op.add_column(
        "centrix_quotation_quotations",
        sa.Column("quantity", sa.Integer(), nullable=True),
    )
    op.add_column(
        "centrix_quotation_quotations",
        sa.Column("dimensions", sa.dialects.postgresql.JSONB(), nullable=True),
    )
