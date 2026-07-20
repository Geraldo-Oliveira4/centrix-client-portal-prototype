"""add proposals and audit_flags tables

Revision ID: 008
Revises: 007
Create Date: 2026-03-22

Covers: RF-COT-030/031 (proposals), RF-COT-040/042/043 (audit flags)
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ENUM as PgEnum
from sqlalchemy.dialects.postgresql import JSONB, UUID

_audit_category = PgEnum(name="auditcategory", create_type=False)
_severity = PgEnum(name="severity", create_type=False)

revision = "008"
down_revision = "007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "centrix_quotation_proposals",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "quotation_id",
            UUID(as_uuid=True),
            sa.ForeignKey("centrix_quotation_quotations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "agent_id",
            UUID(as_uuid=True),
            sa.ForeignKey("centrix_quotation_freight_agents.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("total_value", sa.Numeric(15, 2), nullable=False),
        sa.Column("freight_value", sa.Numeric(15, 2), nullable=False),
        sa.Column("taxes_breakdown", JSONB, nullable=False),
        sa.Column("transit_time", sa.Integer, nullable=False),
        sa.Column("route_detail", sa.Text, nullable=True),
        sa.Column("carrier", sa.String, nullable=True),
        sa.Column("validity", sa.Date, nullable=True),
        sa.Column("insurance_included", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("incoterm", sa.String, nullable=True),
        sa.Column("is_winner", sa.Boolean, nullable=False, server_default="false"),
        sa.Column(
            "received_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index(
        "ix_proposals_quotation_id",
        "centrix_quotation_proposals",
        ["quotation_id"],
    )
    op.create_index(
        "ix_proposals_agent_id",
        "centrix_quotation_proposals",
        ["agent_id"],
    )

    op.create_table(
        "centrix_quotation_audit_flags",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "proposal_id",
            UUID(as_uuid=True),
            sa.ForeignKey("centrix_quotation_proposals.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("rule_category", _audit_category, nullable=False),
        sa.Column("rule_name", sa.String, nullable=False),
        sa.Column("severity", _severity, nullable=False),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("resolved", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("resolved_by", sa.String, nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index(
        "ix_audit_flags_proposal_id",
        "centrix_quotation_audit_flags",
        ["proposal_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_audit_flags_proposal_id", table_name="centrix_quotation_audit_flags")
    op.drop_table("centrix_quotation_audit_flags")
    op.drop_index("ix_proposals_agent_id", table_name="centrix_quotation_proposals")
    op.drop_index("ix_proposals_quotation_id", table_name="centrix_quotation_proposals")
    op.drop_table("centrix_quotation_proposals")
