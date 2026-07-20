"""Add centrix_shipment_instructions table and SIStatus enum

Revision ID: 067
Revises: 066
Create Date: 2026-06-03

Creates the shipment_instructions table that holds Shipment Instruction drafts
and their send state. One SI per quotation; created after the quotation reaches
APROVADA_PELO_CLIENTE and consumed when it transitions to FECHADA.
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "067"
down_revision = "066"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(sa.text("CREATE TYPE sistatus AS ENUM ('RASCUNHO', 'ENVIADA')"))

    op.create_table(
        "centrix_shipment_instructions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("reference", sa.String(), nullable=False, unique=True),
        sa.Column(
            "quotation_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("centrix_quotation_quotations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "proposal_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("centrix_quotation_proposals.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "status",
            postgresql.ENUM("RASCUNHO", "ENVIADA", name="sistatus", create_type=False),
            nullable=False,
            server_default="RASCUNHO",
        ),
        sa.Column("exportador", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("consignatario", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("notificado", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("incoterm_cotado", sa.String(), nullable=True),
        sa.Column("incoterm_aprovado", sa.String(), nullable=True),
        sa.Column("ptax_tipo", sa.String(), nullable=True),
        sa.Column("ptax_valor", sa.Numeric(10, 4), nullable=True),
        sa.Column("incluir_seguro", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("solicitar_agente_origem", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("prontidao_prevista", sa.Date(), nullable=True),
        sa.Column("instrucoes_livres", sa.Text(), nullable=True),
        sa.Column("cc_emails", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("agente_origem", sa.Text(), nullable=True),
        sa.Column("created_by", sa.String(), nullable=False),
        sa.Column("sent_by", sa.String(), nullable=True),
        sa.Column(
            "sent_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_index(
        "ix_centrix_shipment_instructions_quotation_id",
        "centrix_shipment_instructions",
        ["quotation_id"],
    )


def downgrade():
    op.drop_index(
        "ix_centrix_shipment_instructions_quotation_id",
        table_name="centrix_shipment_instructions",
    )
    op.drop_table("centrix_shipment_instructions")
    op.execute(sa.text("DROP TYPE IF EXISTS sistatus"))
