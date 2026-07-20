"""add rfq_agent_tokens table

Revision ID: 017
Revises: 016
Create Date: 2026-04-07
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "017"
down_revision = "016"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "centrix_quotation_rfq_agent_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "rfq_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("centrix_quotation_rfqs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "agent_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("centrix_quotation_freight_agents.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("token", sa.String(64), nullable=False, unique=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_rfq_agent_tokens_token",
        "centrix_quotation_rfq_agent_tokens",
        ["token"],
        unique=True,
    )
    op.create_unique_constraint(
        "uq_rfq_agent_token_rfq_agent",
        "centrix_quotation_rfq_agent_tokens",
        ["rfq_id", "agent_id"],
    )


def downgrade():
    op.drop_table("centrix_quotation_rfq_agent_tokens")
