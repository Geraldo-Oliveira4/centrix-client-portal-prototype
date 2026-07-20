"""Add anvisa_restrictions to client DNA

Revision ID: 045
Revises: 044
Create Date: 2026-05-06

Adds anvisa_restrictions (JSONB) to centrix_quotation_client_dna so that
clients with ANVISA restrictions (e.g., FGM) can have their specific
requirements stored and validated against proposals.
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "045"
down_revision = "044"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "centrix_quotation_client_dna",
        sa.Column("anvisa_restrictions", postgresql.JSONB, nullable=True),
    )


def downgrade() -> None:
    op.drop_column("centrix_quotation_client_dna", "anvisa_restrictions")
