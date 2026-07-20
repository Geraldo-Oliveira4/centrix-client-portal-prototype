"""Add shipment_documentos table (GE — ARB-2379)

Revision ID: 077
Revises: 076
Create Date: 2026-07-01

Aba Documentos Anexados: registro dos documentos anexados a um embarque.
`url_s3` guarda a chave S3 (nao a URL presigned) — a URL de download e
gerada on-demand via GET. `inova_sequencia` guarda o retorno do
POST /anexo da Inova quando o sync acontece (nullable — o sync e
best-effort e nao bloqueia o upload em Centrix, ver ARB-2377).
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "077"
down_revision = "076"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "centrix_shipment_documentos",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "embarque_id",
            UUID(as_uuid=True),
            sa.ForeignKey("centrix_shipment_embarques.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("tipo_arquivo_codigo", sa.Integer(), nullable=True),
        sa.Column("tipo_arquivo_label", sa.String(), nullable=False),
        sa.Column("url_s3", sa.String(), nullable=False),
        sa.Column("observacao", sa.Text(), nullable=True),
        sa.Column("responsavel_id", sa.String(), nullable=True),
        sa.Column("inova_sequencia", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index(
        "ix_shipment_documentos_embarque_id",
        "centrix_shipment_documentos",
        ["embarque_id"],
    )
    op.create_index(
        "ix_shipment_documentos_created_at",
        "centrix_shipment_documentos",
        ["created_at"],
    )


def downgrade():
    op.drop_index("ix_shipment_documentos_created_at", table_name="centrix_shipment_documentos")
    op.drop_index("ix_shipment_documentos_embarque_id", table_name="centrix_shipment_documentos")
    op.drop_table("centrix_shipment_documentos")
