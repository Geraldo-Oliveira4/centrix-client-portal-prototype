"""Add exige_oea to client DNA

Revision ID: 043
Revises: 042
Create Date: 2026-05-06

Adds exige_oea (bool) to centrix_quotation_client_dna so that clients
with OEA Seguranca certification can mandate OEA-certified agents.
"""

import sqlalchemy as sa
from alembic import op

revision = "043"
down_revision = "042"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "centrix_quotation_client_dna",
        sa.Column("exige_oea", sa.Boolean, nullable=True),
    )


def downgrade() -> None:
    op.drop_column("centrix_quotation_client_dna", "exige_oea")
