"""Update scoring criteria: add free_time_dias to proposals, rename dna_score to validity_score

Revision ID: 050
Revises: 049
Create Date: 2026-05-08

Adds free_time_dias (free time in days for FCL proposals) to the proposals table.
Renames dna_score to validity_score in proposal_scores to reflect the new scoring model
that evaluates validity date instead of agent DNA alignment.
"""

import sqlalchemy as sa
from alembic import op

revision = "050"
down_revision = "049"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "centrix_quotation_proposals",
        sa.Column("free_time_dias", sa.Integer, nullable=True),
    )
    op.alter_column(
        "centrix_quotation_proposal_scores",
        "dna_score",
        new_column_name="validity_score",
    )


def downgrade() -> None:
    op.alter_column(
        "centrix_quotation_proposal_scores",
        "validity_score",
        new_column_name="dna_score",
    )
    op.drop_column("centrix_quotation_proposals", "free_time_dias")
