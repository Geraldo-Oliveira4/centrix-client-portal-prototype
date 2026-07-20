"""025 — remove destination, add agente_define_local_coleta

destination is redundant — the actual destination is already captured by
porto_destino / aeroporto_destino depending on the modal.

agente_define_local_coleta is a new flag following the same pattern as
agente_define_porto_embarque: when true, the analyst leaves the local de coleta
(origin/collection location) open for freight agents to decide.

Revision ID: 025
Revises: 024
"""

import sqlalchemy as sa
from alembic import op


revision = "025"
down_revision = "024"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("centrix_quotation_quotations", "destination")
    op.add_column(
        "centrix_quotation_quotations",
        sa.Column("agente_define_local_coleta", sa.Boolean(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("centrix_quotation_quotations", "agente_define_local_coleta")
    op.add_column(
        "centrix_quotation_quotations",
        sa.Column("destination", sa.String(), nullable=True),
    )
