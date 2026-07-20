"""Add operating_regions to freight_agents

Revision ID: 039
Revises: 038
Create Date: 2026-05-01

Adds operating_regions field to freight agents for ARB-1932.
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ARRAY

revision = "039"
down_revision = "038"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        sa.text("CREATE TYPE operating_region AS ENUM ('ASIA', 'EUROPA', 'AMERICAS')")
    )
    op.add_column(
        "centrix_quotation_freight_agents",
        sa.Column(
            "operating_regions",
            ARRAY(sa.Enum("ASIA", "EUROPA", "AMERICAS", name="operating_region")),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("centrix_quotation_freight_agents", "operating_regions")
    op.execute(sa.text("DROP TYPE operating_region"))
