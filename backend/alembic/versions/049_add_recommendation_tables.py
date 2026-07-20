"""Add proposal scoring and recommendation override tables

Revision ID: 049
Revises: 048
Create Date: 2026-05-08

Adds centrix_quotation_proposal_scores (scoring engine results per proposal)
and centrix_quotation_recommendation_overrides (operator override audit trail).
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql as pg

revision = "049"
down_revision = "048"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "centrix_quotation_proposal_scores",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "quotation_id",
            pg.UUID(as_uuid=True),
            sa.ForeignKey("centrix_quotation_quotations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "proposal_id",
            pg.UUID(as_uuid=True),
            sa.ForeignKey("centrix_quotation_proposals.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("is_eligible", sa.Boolean, nullable=False),
        sa.Column("ineligibility_reason", sa.Text, nullable=True),
        sa.Column("cost_score", sa.Numeric(6, 2), nullable=True),
        sa.Column("transit_score", sa.Numeric(6, 2), nullable=True),
        sa.Column("dna_score", sa.Numeric(6, 2), nullable=True),
        sa.Column("total_score", sa.Numeric(6, 2), nullable=True),
        sa.Column(
            "calculated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index(
        "ix_proposal_scores_quotation_id",
        "centrix_quotation_proposal_scores",
        ["quotation_id"],
    )

    op.create_table(
        "centrix_quotation_recommendation_overrides",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "quotation_id",
            pg.UUID(as_uuid=True),
            sa.ForeignKey("centrix_quotation_quotations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "proposal_id",
            pg.UUID(as_uuid=True),
            sa.ForeignKey("centrix_quotation_proposals.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("agent_name", sa.String, nullable=False),
        sa.Column("justification", sa.Text, nullable=False),
        sa.Column("overridden_by", sa.String, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index(
        "ix_recommendation_overrides_quotation_id",
        "centrix_quotation_recommendation_overrides",
        ["quotation_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_recommendation_overrides_quotation_id",
        table_name="centrix_quotation_recommendation_overrides",
    )
    op.drop_table("centrix_quotation_recommendation_overrides")

    op.drop_index(
        "ix_proposal_scores_quotation_id",
        table_name="centrix_quotation_proposal_scores",
    )
    op.drop_table("centrix_quotation_proposal_scores")
