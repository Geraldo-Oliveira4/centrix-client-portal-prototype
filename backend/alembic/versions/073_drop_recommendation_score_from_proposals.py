"""Drop recommendation_score from centrix_quotation_proposals

Revision ID: 073
Revises: 072
Create Date: 2026-06-25

recommendation_score was added in migration 052 as a portal signal intended
to be populated by an analytics pipeline. That pipeline was never implemented:
the recommendation engine (recommendation_service.calculate_and_persist) writes
exclusively to centrix_quotation_proposal_scores. The column has been NULL in
every production row since it was created. Dropping it removes dead schema and
eliminates the misleading null values returned to the client portal.
"""

import sqlalchemy as sa
from alembic import op

revision = "073"
down_revision = "072"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("centrix_quotation_proposals", "recommendation_score")


def downgrade() -> None:
    op.add_column(
        "centrix_quotation_proposals",
        sa.Column("recommendation_score", sa.Numeric(5, 2), nullable=True),
    )
