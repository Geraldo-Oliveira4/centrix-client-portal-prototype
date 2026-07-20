"""021 — add agente_define port/airport flags to quotations

Adds four optional boolean columns to centrix_quotation_quotations that
indicate the freight agent should choose the port or airport rather than
having the analyst specify one explicitly.

Revision ID: 021
Revises: 020
"""

from alembic import op
import sqlalchemy as sa

revision = "021"
down_revision = "020"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "centrix_quotation_quotations",
        sa.Column("agente_define_porto_embarque", sa.Boolean(), nullable=True),
    )
    op.add_column(
        "centrix_quotation_quotations",
        sa.Column("agente_define_porto_destino", sa.Boolean(), nullable=True),
    )
    op.add_column(
        "centrix_quotation_quotations",
        sa.Column("agente_define_aeroporto_embarque", sa.Boolean(), nullable=True),
    )
    op.add_column(
        "centrix_quotation_quotations",
        sa.Column("agente_define_aeroporto_destino", sa.Boolean(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("centrix_quotation_quotations", "agente_define_aeroporto_destino")
    op.drop_column("centrix_quotation_quotations", "agente_define_aeroporto_embarque")
    op.drop_column("centrix_quotation_quotations", "agente_define_porto_destino")
    op.drop_column("centrix_quotation_quotations", "agente_define_porto_embarque")
