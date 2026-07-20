"""Add inova_processo_id to processo (GE — ARB-2438)

Revision ID: 078
Revises: 077
Create Date: 2026-07-01

Numero do processo na Inova (ex: FRT0585.II). Nasce do lado da Inova
(abertura manual na tela Desktop, antes de qualquer acao no Centrix) —
digitado pelo analista na criacao do processo Centrix ou depois, na aba
Dados Gerais. Nullable por design: skip gracioso com alerta visual
enquanto vazio, nunca bloqueia o fluxo (decisao de produto validada com
Orsi, ARB-2438).
"""

import sqlalchemy as sa
from alembic import op

revision = "078"
down_revision = "077"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "centrix_shipment_processos",
        sa.Column("inova_processo_id", sa.String(), nullable=True),
    )


def downgrade():
    op.drop_column("centrix_shipment_processos", "inova_processo_id")
