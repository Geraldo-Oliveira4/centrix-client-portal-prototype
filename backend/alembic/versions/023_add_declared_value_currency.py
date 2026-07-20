"""023 — add declared_value_currency to quotations

Adds a currency selector (BRL/USD/EUR) alongside the declared_value field.
Existing rows default to NULL (no assumption made about legacy data).

Revision ID: 023
Revises: 022
"""

import sqlalchemy as sa
from alembic import op


revision = "023"
down_revision = "022"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(sa.text("CREATE TYPE currency AS ENUM ('BRL', 'USD', 'EUR')"))
    op.add_column(
        "centrix_quotation_quotations",
        sa.Column(
            "declared_value_currency",
            sa.Enum("BRL", "USD", "EUR", name="currency"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("centrix_quotation_quotations", "declared_value_currency")
    op.execute(sa.text("DROP TYPE currency"))
