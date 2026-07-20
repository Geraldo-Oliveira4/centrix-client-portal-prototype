"""Add shipment_bookings table (GE — ARB-2378)

Revision ID: 074
Revises: 073
Create Date: 2026-06-26

Dados de Frete (Booking): tabela 1:1 com centrix_shipment_embarques que armazena
os campos operacionais do booking: cia aerea/armador, MAWB/MBL, HAWB/HBL,
lista de containers, valores de frete e seguro, observacao.
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "074"
down_revision = "073"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "centrix_shipment_bookings",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "embarque_id",
            UUID(as_uuid=True),
            sa.ForeignKey("centrix_shipment_embarques.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("cia_aerea_armador", sa.String(), nullable=True),
        sa.Column("mawb_mbl", sa.String(), nullable=True),
        sa.Column("hawb_hbl", sa.String(), nullable=True),
        sa.Column("containers", JSONB(), nullable=True),
        sa.Column("frete_valor", sa.Numeric(14, 2), nullable=True),
        sa.Column("seguro_valor", sa.Numeric(14, 2), nullable=True),
        sa.Column("observacao", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_shipment_bookings_embarque_id",
        "centrix_shipment_bookings",
        ["embarque_id"],
    )


def downgrade():
    op.drop_index("ix_shipment_bookings_embarque_id", table_name="centrix_shipment_bookings")
    op.drop_table("centrix_shipment_bookings")
