"""Migrate existing freight agents to have default contacts

Revision ID: 035
Revises: 034
Create Date: 2026-04-23
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "035"
down_revision = "034"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    result = conn.execute(
        sa.text(
            """
            SELECT id, name, email FROM centrix_quotation_freight_agents
            WHERE id NOT IN (
                SELECT freight_agent_id FROM centrix_quotation_freight_agent_contacts
            )
            """
        )
    )

    for agent_id, name, email in result:
        conn.execute(
            sa.text(
                """
                INSERT INTO centrix_quotation_freight_agent_contacts
                (freight_agent_id, name, email, export_air, import_air, export_maritime, import_maritime, export_road, import_road)
                VALUES
                (:agent_id, :name, :email, true, true, true, true, true, true)
                """
            ),
            {
                "agent_id": agent_id,
                "name": name,
                "email": email,
            }
        )


def downgrade() -> None:
    pass
