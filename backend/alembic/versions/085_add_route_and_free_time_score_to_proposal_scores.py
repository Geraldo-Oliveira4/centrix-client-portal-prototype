"""Add route_score and free_time_score to proposal_scores (ARB-2478)

Revision ID: 085
Revises: 084
Create Date: 2026-07-08

Nota IA v2: the recommendation engine gains two new weighted criteria
(route/connections and free time) per Victor Orsi's 07/07 email, and validity
moves from an eliminatory pre-filter to a weighted criterion (reusing the
existing `validity_score` column, previously always NULL).

Adds the two missing columns; validity_score already exists (migration 050).
"""

import sqlalchemy as sa
from alembic import op

revision = "085"
down_revision = "084"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "centrix_quotation_proposal_scores",
        sa.Column("route_score", sa.Numeric(5, 2), nullable=True),
    )
    op.add_column(
        "centrix_quotation_proposal_scores",
        sa.Column("free_time_score", sa.Numeric(5, 2), nullable=True),
    )


def downgrade():
    op.drop_column("centrix_quotation_proposal_scores", "free_time_score")
    op.drop_column("centrix_quotation_proposal_scores", "route_score")
