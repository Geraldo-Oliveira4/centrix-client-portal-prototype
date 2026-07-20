"""Add versioning fields to proposals

Revision ID: 047
Revises: 046
Create Date: 2026-05-07

Adds version (int default 1), is_latest (bool default true),
parent_proposal_id (nullable FK -> proposals.id) and version_diff (JSONB)
to centrix_quotation_proposals to support proposal revision history.
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql as pg

revision = "047"
down_revision = "046"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "centrix_quotation_proposals",
        sa.Column("version", sa.Integer, nullable=False, server_default="1"),
    )
    op.add_column(
        "centrix_quotation_proposals",
        sa.Column("is_latest", sa.Boolean, nullable=False, server_default="true"),
    )
    op.add_column(
        "centrix_quotation_proposals",
        sa.Column("parent_proposal_id", pg.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "centrix_quotation_proposals",
        sa.Column("version_diff", pg.JSONB, nullable=True),
    )
    op.create_foreign_key(
        "fk_proposals_parent_proposal_id",
        "centrix_quotation_proposals",
        "centrix_quotation_proposals",
        ["parent_proposal_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_proposals_agent_quotation_latest",
        "centrix_quotation_proposals",
        ["quotation_id", "agent_id", "is_latest"],
    )


def downgrade() -> None:
    op.drop_index("ix_proposals_agent_quotation_latest", table_name="centrix_quotation_proposals")
    op.drop_constraint("fk_proposals_parent_proposal_id", "centrix_quotation_proposals", type_="foreignkey")
    op.drop_column("centrix_quotation_proposals", "version_diff")
    op.drop_column("centrix_quotation_proposals", "parent_proposal_id")
    op.drop_column("centrix_quotation_proposals", "is_latest")
    op.drop_column("centrix_quotation_proposals", "version")
