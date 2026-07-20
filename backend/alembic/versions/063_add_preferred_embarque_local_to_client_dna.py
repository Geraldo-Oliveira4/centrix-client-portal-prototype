"""Add preferred_embarque_local to client_dna

Revision ID: 063
Revises: 062
Create Date: 2026-05-21

Adds preferred_embarque_local (VARCHAR) to centrix_quotation_client_dna.
Supports audit engine rule 1.3: preferred export loading point for DNA-based
pre-dispatch cross-checks (Moment 1).
"""

import sqlalchemy as sa
from alembic import op

revision = "063"
down_revision = "062"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "centrix_quotation_client_dna",
        sa.Column("preferred_embarque_local", sa.String(), nullable=True),
    )


def downgrade():
    op.drop_column("centrix_quotation_client_dna", "preferred_embarque_local")
