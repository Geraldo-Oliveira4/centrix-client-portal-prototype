"""add urgency level to quotation

Revision ID: 029
Revises: 028
Create Date: 2026-04-22
"""

from alembic import op
import sqlalchemy as sa

revision = "029"
down_revision = "028"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(sa.text("CREATE TYPE urgencylevel AS ENUM ('URGENTE', 'VIP', 'ALTA', 'NORMAL')"))
    op.add_column(
        "centrix_quotation_quotations",
        sa.Column(
            "urgency",
            sa.Enum("URGENTE", "VIP", "ALTA", "NORMAL", name="urgencylevel"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("centrix_quotation_quotations", "urgency")
    op.execute(sa.text("DROP TYPE urgencylevel"))
