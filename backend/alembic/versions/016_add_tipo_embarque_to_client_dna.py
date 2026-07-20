"""add tipo_embarque to client_dna

Revision ID: 016
Revises: 015
Create Date: 2026-04-07
"""

from alembic import op
import sqlalchemy as sa

revision = "016"
down_revision = "015"
branch_labels = None
depends_on = None


def upgrade():
    # tipoembarque enum already exists from migration 015
    op.add_column(
        "centrix_quotation_client_dna",
        sa.Column(
            "tipo_embarque",
            sa.Enum("FCL", "LCL", "BREAK_BULK", name="tipoembarque"),
            nullable=True,
        ),
    )


def downgrade():
    op.drop_column("centrix_quotation_client_dna", "tipo_embarque")
