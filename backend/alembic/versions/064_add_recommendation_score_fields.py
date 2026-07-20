"""Add frequency_score, validade_status, posicao_ranking, motivo to proposal_scores;
add recommended_proposal_id to recommendation_overrides.

Revision ID: 064
Revises: 063
Create Date: 2026-05-22

Extends the existing recommendation schema to persist per-criterion rankings and
validity status directly in the DB. Removes the need to recompute these in memory
on every serialize call. Adds recommended_proposal_id to overrides so the training
signal (AI suggestion vs operator choice) is captured from Fase 1 onwards.
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql as pg

revision = "064"
down_revision = "063"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # proposal_scores — persist the four fields previously computed in memory
    op.add_column(
        "centrix_quotation_proposal_scores",
        sa.Column("frequency_score", sa.Numeric(5, 2), nullable=True),
    )
    op.add_column(
        "centrix_quotation_proposal_scores",
        sa.Column("validade_status", sa.String(20), nullable=True),
    )
    op.add_column(
        "centrix_quotation_proposal_scores",
        sa.Column("posicao_ranking", sa.SmallInteger, nullable=True),
    )
    op.add_column(
        "centrix_quotation_proposal_scores",
        sa.Column("motivo", sa.Text, nullable=True),
    )

    # recommendation_overrides — capture AI suggestion at override time for Fase 2 training
    op.add_column(
        "centrix_quotation_recommendation_overrides",
        sa.Column(
            "recommended_proposal_id",
            pg.UUID(as_uuid=True),
            sa.ForeignKey("centrix_quotation_proposals.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("centrix_quotation_recommendation_overrides", "recommended_proposal_id")
    op.drop_column("centrix_quotation_proposal_scores", "motivo")
    op.drop_column("centrix_quotation_proposal_scores", "posicao_ranking")
    op.drop_column("centrix_quotation_proposal_scores", "validade_status")
    op.drop_column("centrix_quotation_proposal_scores", "frequency_score")
