"""quotation domain schema

Revision ID: 002
Revises: 001
Create Date: 2026-03-16

Covers: RF-COT-027, RF-COT-101, RF-COT-044, RF-COT-041, RF-COT-010
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ENUM as PgEnum
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None

# ---------------------------------------------------------------------------
# Column type references (create_type=False — types are created via raw SQL
# in upgrade() to avoid SQLAlchemy's _on_table_create hook double-firing).
# ---------------------------------------------------------------------------

_quotation_state = PgEnum(name="quotationstate", create_type=False)
_modal = PgEnum(name="modal", create_type=False)
_audit_category = PgEnum(name="auditcategory", create_type=False)
_severity = PgEnum(name="severity", create_type=False)
_client_tier = PgEnum(name="clienttier", create_type=False)
_logistics_type = PgEnum(name="logisticstype", create_type=False)
_insurance_responsibility = PgEnum(name="insuranceresponsibility", create_type=False)
_price_or_performance = PgEnum(name="priceorperformance", create_type=False)


def upgrade() -> None:
    # ------------------------------------------------------------------
    # Create PostgreSQL enum types via raw SQL before any table DDL.
    # Using op.execute bypasses SQLAlchemy's type hooks entirely.
    # ------------------------------------------------------------------

    op.execute(sa.text(
        "CREATE TYPE quotationstate AS ENUM ("
        "'TRIAGEM_IA', 'AGUARDANDO_DADOS', 'COTANDO', 'PARA_ANALISE',"
        "'REVISAO_AGENTE', 'ENVIADA_CLIENTE', 'FECHADA', 'DECLINADA'"
        ")"
    ))
    op.execute(sa.text(
        "CREATE TYPE modal AS ENUM ("
        "'MARITIMO_FCL', 'MARITIMO_LCL', 'MARITIMO_REEFER', 'AEREO'"
        ")"
    ))
    op.execute(sa.text(
        "CREATE TYPE auditcategory AS ENUM ("
        "'SEGURO', 'ROTA_DESTINO', 'COTACAO_INCOMPLETA', 'PARTICULARIDADES_IGNORADAS'"
        ")"
    ))
    op.execute(sa.text(
        "CREATE TYPE severity AS ENUM ('LOW', 'MEDIUM', 'HIGH')"
    ))
    op.execute(sa.text(
        "CREATE TYPE clienttier AS ENUM ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM')"
    ))
    op.execute(sa.text(
        "CREATE TYPE logisticstype AS ENUM ('COTACAO', 'TORRE_DE_CONTROLE', 'PREMIUM')"
    ))
    op.execute(sa.text(
        "CREATE TYPE insuranceresponsibility AS ENUM ('FREITAS', 'CLIENTE', 'NAO_INCLUSO')"
    ))
    op.execute(sa.text(
        "CREATE TYPE priceorperformance AS ENUM ('PRECO', 'PERFORMANCE')"
    ))

    # ------------------------------------------------------------------
    # Independent tables (no foreign keys into this domain)
    # ------------------------------------------------------------------

    op.create_table(
        "centrix_quotation_clients",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("sector", sa.String(), nullable=True),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("company_code", sa.String(), nullable=True),
        sa.Column("tier", _client_tier, nullable=False, server_default="BRONZE"),
        sa.Column("is_vip", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    op.create_table(
        "centrix_quotation_freight_agents",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("preferred_channel", sa.String(), nullable=True),
        sa.Column("reliability_score", sa.Numeric(5, 2), nullable=True),
        sa.Column("total_quotations", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "centrix_quotation_transit_time_references",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("modal", _modal, nullable=False),
        sa.Column("origin_country", sa.String(), nullable=False),
        sa.Column("avg_days", sa.Integer(), nullable=False),
        sa.Column("sample_size", sa.Integer(), nullable=False),
        sa.Column(
            "tolerance_pct",
            sa.Numeric(5, 2),
            nullable=False,
            server_default="20.00",
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )

    # ------------------------------------------------------------------
    # Tables with foreign keys into centrix_quotation_clients
    # ------------------------------------------------------------------

    op.create_table(
        "centrix_quotation_client_dna",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "client_id",
            UUID(as_uuid=True),
            sa.ForeignKey("centrix_quotation_clients.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("modality", _modal, nullable=True),
        sa.Column("logistics_type", _logistics_type, nullable=True),
        sa.Column("default_agents", JSONB(), nullable=True),
        sa.Column("destination_yard", sa.String(), nullable=True),
        sa.Column("insurance_responsibility", _insurance_responsibility, nullable=True),
        sa.Column("quotation_particularities", sa.Text(), nullable=True),
        sa.Column("dangerous_cargo_shipper", sa.Boolean(), nullable=True),
        sa.Column("price_or_performance", _price_or_performance, nullable=True),
        sa.Column("cargo_profile", sa.String(), nullable=True),
        sa.Column("contact_name", sa.String(), nullable=True),
        sa.Column("contact_email", sa.String(), nullable=True),
        sa.Column("assigned_analyst", sa.String(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "centrix_quotation_quotations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("reference", sa.String(), nullable=False, unique=True),
        sa.Column(
            "state",
            _quotation_state,
            nullable=False,
            server_default="TRIAGEM_IA",
        ),
        sa.Column("priority_score", sa.Numeric(5, 2), nullable=True),
        sa.Column("completeness_score", sa.Numeric(5, 2), nullable=True),
        sa.Column("modal", _modal, nullable=True),
        sa.Column("origin", sa.String(), nullable=True),
        sa.Column("destination", sa.String(), nullable=True),
        sa.Column("incoterm", sa.String(), nullable=True),
        sa.Column("weight", sa.Numeric(12, 3), nullable=True),
        sa.Column("volume", sa.Numeric(12, 3), nullable=True),
        sa.Column("quantity", sa.Integer(), nullable=True),
        sa.Column("dimensions", JSONB(), nullable=True),
        sa.Column("product", sa.String(), nullable=True),
        sa.Column("desired_deadline", sa.Date(), nullable=True),
        sa.Column("declared_value", sa.Numeric(15, 2), nullable=True),
        sa.Column("stackability", sa.Boolean(), nullable=True),
        sa.Column("insurance_required", sa.Boolean(), nullable=True),
        sa.Column("destination_yard", sa.String(), nullable=True),
        sa.Column("observations", sa.Text(), nullable=True),
        sa.Column("analyst_id", sa.String(), nullable=True),
        sa.Column(
            "client_id",
            UUID(as_uuid=True),
            sa.ForeignKey("centrix_quotation_clients.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("original_email_s3_key", sa.String(), nullable=True),
        sa.Column("attachments_s3_keys", JSONB(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )

    # ------------------------------------------------------------------
    # Tables with foreign keys into centrix_quotation_quotations
    # ------------------------------------------------------------------

    # centrix_quotation_rfqs is created in migration 007_add_rfq_table.
    # centrix_quotation_proposals and centrix_quotation_audit_flags are created in migration 008_add_proposals_and_audit_flags.

    op.create_table(
        "centrix_quotation_logs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "quotation_id",
            UUID(as_uuid=True),
            sa.ForeignKey("centrix_quotation_quotations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("action", sa.String(), nullable=False),
        sa.Column("previous_state", sa.String(), nullable=True),
        sa.Column("new_state", sa.String(), nullable=True),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("details", JSONB(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

def downgrade() -> None:
    # Drop tables in reverse FK dependency order.
    # centrix_quotation_audit_flags and centrix_quotation_proposals are dropped by migration 008.
    op.drop_table("centrix_quotation_logs")
    op.drop_table("centrix_quotation_quotations")
    op.drop_table("centrix_quotation_client_dna")
    op.drop_table("centrix_quotation_transit_time_references")
    op.drop_table("centrix_quotation_freight_agents")
    op.drop_table("centrix_quotation_clients")

    # Drop PostgreSQL enum types after all tables are gone.
    op.execute(sa.text("DROP TYPE priceorperformance"))
    op.execute(sa.text("DROP TYPE insuranceresponsibility"))
    op.execute(sa.text("DROP TYPE logisticstype"))
    op.execute(sa.text("DROP TYPE clienttier"))
    op.execute(sa.text("DROP TYPE severity"))
    op.execute(sa.text("DROP TYPE auditcategory"))
    op.execute(sa.text("DROP TYPE modal"))
    op.execute(sa.text("DROP TYPE quotationstate"))
