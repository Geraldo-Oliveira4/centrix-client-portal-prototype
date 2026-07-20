"""Add freight_agent_contacts table for multiple emails per agent

Revision ID: 034
Revises: 033
Create Date: 2026-04-23
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "034"
down_revision = "033"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "centrix_quotation_freight_agent_contacts",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "freight_agent_id",
            UUID(as_uuid=True),
            sa.ForeignKey(
                "centrix_quotation_freight_agents.id",
                ondelete="CASCADE",
            ),
            nullable=False,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("export_air", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("import_air", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("export_maritime", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("import_maritime", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("export_road", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("import_road", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=True,
            onupdate=sa.func.now(),
        ),
    )

    op.create_index(
        "idx_freight_agent_contacts_agent_id",
        "centrix_quotation_freight_agent_contacts",
        ["freight_agent_id"],
    )
    op.create_index(
        "idx_freight_agent_contacts_email",
        "centrix_quotation_freight_agent_contacts",
        ["email"],
    )


def downgrade() -> None:
    op.drop_index(
        "idx_freight_agent_contacts_email",
        table_name="centrix_quotation_freight_agent_contacts",
    )
    op.drop_index(
        "idx_freight_agent_contacts_agent_id",
        table_name="centrix_quotation_freight_agent_contacts",
    )
    op.drop_table("centrix_quotation_freight_agent_contacts")
