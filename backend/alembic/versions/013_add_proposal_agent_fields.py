"""add agent-supplied fields to proposals

Revision ID: 013
Revises: 012
Create Date: 2026-03-30

Covers: numero_oferta, ptax_percentual, prazo_pagamento_dias,
        seguro_percentual, seguro_minimo, frequencia
"""

import sqlalchemy as sa
from alembic import op

revision = "013"
down_revision = "012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "centrix_quotation_proposals",
        sa.Column("numero_oferta", sa.Text(), nullable=True),
    )
    op.add_column(
        "centrix_quotation_proposals",
        sa.Column("ptax_percentual", sa.Numeric(5, 2), nullable=True),
    )
    op.add_column(
        "centrix_quotation_proposals",
        sa.Column("prazo_pagamento_dias", sa.Integer(), nullable=True),
    )
    op.add_column(
        "centrix_quotation_proposals",
        sa.Column("seguro_percentual", sa.Numeric(6, 4), nullable=True),
    )
    op.add_column(
        "centrix_quotation_proposals",
        sa.Column("seguro_minimo", sa.Numeric(10, 2), nullable=True),
    )
    op.add_column(
        "centrix_quotation_proposals",
        sa.Column("frequencia", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("centrix_quotation_proposals", "frequencia")
    op.drop_column("centrix_quotation_proposals", "seguro_minimo")
    op.drop_column("centrix_quotation_proposals", "seguro_percentual")
    op.drop_column("centrix_quotation_proposals", "prazo_pagamento_dias")
    op.drop_column("centrix_quotation_proposals", "ptax_percentual")
    op.drop_column("centrix_quotation_proposals", "numero_oferta")
