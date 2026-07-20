"""add state machine fields (decline_reason, winning_agent_id, quoted_value_usd)

Revision ID: 006
Revises: 005
Create Date: 2026-03-21

Covers: RF-COT-040 (CRITICAL severity), RF-COT-061 (decline reason)
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add CRITICAL to severity enum
    op.execute(sa.text("ALTER TYPE severity ADD VALUE IF NOT EXISTS 'CRITICAL'"))

    # Create decline reason enum
    op.execute(
        sa.text(
            "CREATE TYPE declinereason AS ENUM "
            "('PRECO', 'TRANSIT_TIME', 'SEM_RESPOSTA', 'OUTROS')"
        )
    )

    # Add terminal state columns to quotations table
    op.add_column(
        "centrix_quotation_quotations",
        sa.Column(
            "decline_reason",
            sa.Enum(name="declinereason", create_type=False),
            nullable=True,
        ),
    )
    op.add_column(
        "centrix_quotation_quotations",
        sa.Column("winning_agent_id", UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_quotations_winning_agent",
        "centrix_quotation_quotations",
        "centrix_quotation_freight_agents",
        ["winning_agent_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.add_column(
        "centrix_quotation_quotations",
        sa.Column("quoted_value_usd", sa.Numeric(15, 2), nullable=True),
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_quotations_winning_agent",
        "centrix_quotation_quotations",
        type_="foreignkey",
    )
    op.drop_column("centrix_quotation_quotations", "quoted_value_usd")
    op.drop_column("centrix_quotation_quotations", "winning_agent_id")
    op.drop_column("centrix_quotation_quotations", "decline_reason")
    op.execute(sa.text("DROP TYPE IF EXISTS declinereason"))
    # Note: CRITICAL cannot be removed from severity enum in PostgreSQL.
    # It will remain in the type but is unused after downgrade.
