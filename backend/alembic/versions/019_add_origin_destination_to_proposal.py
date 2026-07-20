"""019 — add proposal_origin and proposal_destination to proposals

Adds two optional text columns to centrix_quotation_proposals so that
the agent portal can capture the confirmed origin and destination for
each proposal. These fields are pre-filled from the quotation data and
used by audit rules R1/R2 instead of heuristic route_detail matching.

Revision ID: 019
Revises: 018
"""

from alembic import op
import sqlalchemy as sa

revision = "019"
down_revision = "018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "centrix_quotation_proposals",
        sa.Column("proposal_origin", sa.Text(), nullable=True),
    )
    op.add_column(
        "centrix_quotation_proposals",
        sa.Column("proposal_destination", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("centrix_quotation_proposals", "proposal_destination")
    op.drop_column("centrix_quotation_proposals", "proposal_origin")
