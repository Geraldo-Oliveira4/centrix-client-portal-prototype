"""Add processo and embarque tables (GE foundation)

Revision ID: 071
Revises: 070
Create Date: 2026-06-15

Database foundation for the Gerenciamento de Embarque (GE) module. Creates the
two core tables of the domain:

  centrix_shipment_processos  — a GE process (FK to quotation is nullable by
                                design: Perfil B / manual creation)
  centrix_shipment_embarques  — a shipment within a process, carrying the
                                lifecycle state and the EMB-YYYY-NNNN reference

Two new PostgreSQL enum types are created here (embarquestate, tipodespacho).
The "modal" and "tipoembarque" types already exist (created for quotations) and
are reused via create_type=False. PurchaseOrderState and TipoOcorrencia enums
are defined in Python but their PG types are deferred to the migrations that add
the PurchaseOrder / Followup tables (later sprints).
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ENUM as PgEnum
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "071"
down_revision = "070"
branch_labels = None
depends_on = None

# Column type references. create_type=False prevents SQLAlchemy from emitting a
# second CREATE TYPE after we create them via op.execute (new types), or any
# CREATE TYPE at all for the pre-existing shared types (modal, tipoembarque).
_embarquestate = PgEnum(name="embarquestate", create_type=False)
_tipodespacho = PgEnum(name="tipodespacho", create_type=False)
_modal = PgEnum(name="modal", create_type=False)
_tipoembarque = PgEnum(name="tipoembarque", create_type=False)


def upgrade():
    # New enum types via raw SQL with duplicate-safe DO blocks (idempotent).
    op.execute(sa.text("""
        DO $$ BEGIN
            CREATE TYPE embarquestate AS ENUM (
                'solicitado', 'aguardando_prontidao', 'coletado',
                'analise_booking', 'embarcado', 'postergado', 'booking_divergente'
            );
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$
    """))
    op.execute(sa.text("""
        DO $$ BEGIN
            CREATE TYPE tipodespacho AS ENUM ('DIRETO', 'CONSOLIDADO');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$
    """))

    op.create_table(
        "centrix_shipment_processos",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "quotation_id",
            UUID(as_uuid=True),
            sa.ForeignKey("centrix_quotation_quotations.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "client_id",
            UUID(as_uuid=True),
            sa.ForeignKey("centrix_quotation_clients.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("incoterm", sa.String(), nullable=True),
        sa.Column("modal", _modal, nullable=True),
        sa.Column("tipo_embarque", _tipoembarque, nullable=True),
        sa.Column("tipo_despacho", _tipodespacho, nullable=True),
        sa.Column(
            "carga_urgente",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "agente_id",
            UUID(as_uuid=True),
            sa.ForeignKey("centrix_quotation_freight_agents.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("containers", JSONB(), nullable=True),
        sa.Column("datas", JSONB(), nullable=True),
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
        "ix_shipment_processos_client_id",
        "centrix_shipment_processos",
        ["client_id"],
    )
    op.create_index(
        "ix_shipment_processos_quotation_id",
        "centrix_shipment_processos",
        ["quotation_id"],
    )

    op.create_table(
        "centrix_shipment_embarques",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "processo_id",
            UUID(as_uuid=True),
            sa.ForeignKey("centrix_shipment_processos.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "estado",
            _embarquestate,
            nullable=False,
            server_default=sa.text("'solicitado'::embarquestate"),
        ),
        sa.Column("reference", sa.String(), nullable=False, unique=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_shipment_embarques_processo_id",
        "centrix_shipment_embarques",
        ["processo_id"],
    )
    op.create_index(
        "ix_shipment_embarques_estado",
        "centrix_shipment_embarques",
        ["estado"],
    )


def downgrade():
    op.drop_index("ix_shipment_embarques_estado", table_name="centrix_shipment_embarques")
    op.drop_index("ix_shipment_embarques_processo_id", table_name="centrix_shipment_embarques")
    op.drop_table("centrix_shipment_embarques")
    op.drop_index("ix_shipment_processos_quotation_id", table_name="centrix_shipment_processos")
    op.drop_index("ix_shipment_processos_client_id", table_name="centrix_shipment_processos")
    op.drop_table("centrix_shipment_processos")
    # Only drop the types created by this migration — modal / tipoembarque are
    # shared with the quotation domain and must remain.
    op.execute(sa.text("DROP TYPE tipodespacho"))
    op.execute(sa.text("DROP TYPE embarquestate"))
