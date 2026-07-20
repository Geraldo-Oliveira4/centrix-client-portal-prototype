"""Add cotacao_auditoria table for the 3-moment audit agent

Revision ID: 062
Revises: 061
Create Date: 2026-05-21

Records each audit session triggered at the 3 critical moments of the
quotation workflow:
  Moment 1 — pre-dispatch to freight agents (active for Sprint 6)
  Moment 2 — on receiving the freight agent response (passive for Sprint 6)
  Moment 3 — pre-sending the comparative map to the client (passive for Sprint 6)

Each row captures the full run context: expected vs received per field
(divergencias JSONB), the action taken, and optional analyst resolution.
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ENUM as PgEnum
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "062"
down_revision = "061"
branch_labels = None
depends_on = None

# Column type references — create_type=False prevents SQLAlchemy's
# _on_table_create hook from emitting a second CREATE TYPE after we've
# already created the types via op.execute below.
_auditresultado = PgEnum(name="auditresultado", create_type=False)
_auditacaotomada = PgEnum(name="auditacaotomada", create_type=False)
_auditresolucaotipo = PgEnum(name="auditresolucaotipo", create_type=False)


def upgrade():
    # Create types via raw SQL with duplicate-safe DO $$ block so the
    # migration is idempotent if a previous run created the types but
    # failed before creating the table.
    op.execute(sa.text("""
        DO $$ BEGIN
            CREATE TYPE auditresultado AS ENUM ('aprovado', 'divergente', 'bloqueado');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$
    """))
    op.execute(sa.text("""
        DO $$ BEGIN
            CREATE TYPE auditacaotomada AS ENUM ('passivo', 'alerta', 'bloqueio', 'sugestao_aplicada');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$
    """))
    op.execute(sa.text("""
        DO $$ BEGIN
            CREATE TYPE auditresolucaotipo AS ENUM ('correcao_aplicada', 'justificada_e_seguiu', 'cancelada');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$
    """))

    op.create_table(
        "centrix_quotation_cotacao_auditoria",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "cotacao_id",
            UUID(as_uuid=True),
            sa.ForeignKey("centrix_quotation_quotations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("momento", sa.SmallInteger(), nullable=False),
        sa.Column(
            "agente_carga_id",
            UUID(as_uuid=True),
            sa.ForeignKey("centrix_quotation_freight_agents.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "timestamp",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("resultado", _auditresultado, nullable=False),
        sa.Column("divergencias", JSONB(), nullable=False, server_default=sa.text("'[]'")),
        sa.Column("acao_tomada", _auditacaotomada, nullable=False),
        sa.Column("resolvido_por", sa.String(), nullable=True),
        sa.Column("resolvido_em", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolucao_tipo", _auditresolucaotipo, nullable=True),
        sa.Column("observacao", sa.Text(), nullable=True),
        sa.CheckConstraint("momento IN (1, 2, 3)", name="ck_cotacao_auditoria_momento"),
    )

    op.create_index(
        "ix_cotacao_auditoria_cotacao_id",
        "centrix_quotation_cotacao_auditoria",
        ["cotacao_id"],
    )
    op.create_index(
        "ix_cotacao_auditoria_momento",
        "centrix_quotation_cotacao_auditoria",
        ["cotacao_id", "momento"],
    )


def downgrade():
    op.drop_index("ix_cotacao_auditoria_momento", table_name="centrix_quotation_cotacao_auditoria")
    op.drop_index("ix_cotacao_auditoria_cotacao_id", table_name="centrix_quotation_cotacao_auditoria")
    op.drop_table("centrix_quotation_cotacao_auditoria")
    op.execute(sa.text("DROP TYPE auditresolucaotipo"))
    op.execute(sa.text("DROP TYPE auditacaotomada"))
    op.execute(sa.text("DROP TYPE auditresultado"))
