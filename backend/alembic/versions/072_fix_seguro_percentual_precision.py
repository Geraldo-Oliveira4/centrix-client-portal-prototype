"""Fix seguro_percentual column precision

Revision ID: 072
Revises: 071
Create Date: 2026-06-17

seguro_percentual was declared as Numeric(6, 4) (max 99.9999), which caused a
NumericValueOutOfRange crash when agents submitted the insurance cost value
(e.g. 397.82 EUR) instead of the percentage rate. Changed to Numeric(10, 4)
to accommodate values up to 999999.9999.
"""

import sqlalchemy as sa
from alembic import op

revision = "072"
down_revision = "071"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "centrix_quotation_proposals",
        "seguro_percentual",
        type_=sa.Numeric(10, 4),
        existing_type=sa.Numeric(6, 4),
        existing_nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "centrix_quotation_proposals",
        "seguro_percentual",
        type_=sa.Numeric(6, 4),
        existing_type=sa.Numeric(10, 4),
        existing_nullable=True,
    )
