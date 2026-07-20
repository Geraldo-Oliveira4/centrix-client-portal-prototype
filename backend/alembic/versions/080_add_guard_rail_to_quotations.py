"""Add guard rail fields to quotations (ARB-2449)

Revision ID: 080
Revises: 079
Create Date: 2026-07-05

Guard rail (portal-flow safety net) persistence on centrix_quotation_quotations.
Stores only the analyst's human decision; the computed evaluation (the two travas)
lives in shared/domain/guard_rail.py and is derived at read time.

- guard_rail_decision: null = pending review; RELEASED unlocks the client's portal
  approval; BLOCKED keeps it locked.
- guard_rail_block_reason: mandatory justification captured on BLOCKED.
- guard_rail_reviewed_by / guard_rail_reviewed_at: analyst actor + timestamp.
"""

import sqlalchemy as sa
from alembic import op

revision = "080"
down_revision = "079"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(sa.text("CREATE TYPE guardraildecision AS ENUM ('RELEASED', 'BLOCKED')"))
    op.add_column(
        "centrix_quotation_quotations",
        sa.Column(
            "guard_rail_decision",
            sa.Enum("RELEASED", "BLOCKED", name="guardraildecision"),
            nullable=True,
        ),
    )
    op.add_column(
        "centrix_quotation_quotations",
        sa.Column("guard_rail_block_reason", sa.Text(), nullable=True),
    )
    op.add_column(
        "centrix_quotation_quotations",
        sa.Column("guard_rail_reviewed_by", sa.String(), nullable=True),
    )
    op.add_column(
        "centrix_quotation_quotations",
        sa.Column("guard_rail_reviewed_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("centrix_quotation_quotations", "guard_rail_reviewed_at")
    op.drop_column("centrix_quotation_quotations", "guard_rail_reviewed_by")
    op.drop_column("centrix_quotation_quotations", "guard_rail_block_reason")
    op.drop_column("centrix_quotation_quotations", "guard_rail_decision")
    op.execute(sa.text("DROP TYPE guardraildecision"))
