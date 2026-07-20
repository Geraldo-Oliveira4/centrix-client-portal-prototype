"""Add shipment_followups table (GE — ARB-2380)

Revision ID: 075
Revises: 074
Create Date: 2026-06-26

Aba Ocorrencias (Follow-up): base para o historico manual e automatico de
eventos do embarque. A coluna `origem` discrimina entradas manuais ("MANUAL")
de ocorrencias criadas automaticamente por Lambdas de varredura ou por
transicoes de estado ("AUTOMATICO").
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "075"
down_revision = "074"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "centrix_shipment_followups",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "embarque_id",
            UUID(as_uuid=True),
            sa.ForeignKey("centrix_shipment_embarques.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("grupo", sa.String(), nullable=True),
        sa.Column("tipo_ocorrencia", sa.String(), nullable=False),
        sa.Column("nota", sa.Text(), nullable=True),
        sa.Column("origem", sa.String(), nullable=False),
        sa.Column("responsavel_id", sa.String(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index(
        "ix_shipment_followups_embarque_id",
        "centrix_shipment_followups",
        ["embarque_id"],
    )
    op.create_index(
        "ix_shipment_followups_created_at",
        "centrix_shipment_followups",
        ["created_at"],
    )


def downgrade():
    op.drop_index("ix_shipment_followups_created_at", table_name="centrix_shipment_followups")
    op.drop_index("ix_shipment_followups_embarque_id", table_name="centrix_shipment_followups")
    op.drop_table("centrix_shipment_followups")
