"""Add service_type to client_dna (split DNA by import/export)

Revision ID: 089
Revises: 088
Create Date: 2026-07-17

ARB-2445. A client may now keep a separate DNA per operation (IMPORTACAO /
EXPORTACAO), selected by the quotation's ServiceType. Existing rows are
backfilled to IMPORTACAO and cloned into an EXPORTACAO counterpart with
identical data so both operations start populated; analysts edit each
manually afterwards. Enforces one DNA per (client_id, service_type).
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ENUM as PgEnum

revision = "089"
down_revision = "088"
branch_labels = None
depends_on = None

# servicetype already exists (created via raw SQL in 015_keeper_quotes_alignment
# for centrix_quotations.service_type); create_type=False reuses it here for
# consistency with 006/071's convention, matching the other migrations that
# add a column of a pre-existing enum type.
_servicetype = PgEnum(name="servicetype", create_type=False)


_DNA_COLUMNS = """
    modality, tipo_embarque, logistics_type, default_agents, destination_yard,
    destination_yard_aereo, destination_yard_maritimo_fcl,
    destination_yard_maritimo_lcl, insurance_responsibility,
    quotation_particularities, dangerous_cargo_shipper, price_or_performance,
    cargo_profile, contact_name, contact_email, assigned_analyst, exige_oea,
    anvisa_restrictions, preferred_embarque_local, updated_at
"""


def upgrade():
    # 1. Add nullable, backfill existing rows as IMPORTACAO.
    op.add_column(
        "centrix_quotation_client_dna",
        sa.Column("service_type", _servicetype, nullable=True),
    )
    op.execute(
        sa.text(
            "UPDATE centrix_quotation_client_dna "
            "SET service_type = 'IMPORTACAO' WHERE service_type IS NULL"
        )
    )

    # 2. Clone each IMPORTACAO row into an EXPORTACAO counterpart.
    op.execute(
        sa.text(
            f"""
            INSERT INTO centrix_quotation_client_dna
                (id, client_id, service_type, {_DNA_COLUMNS})
            SELECT gen_random_uuid(), client_id, 'EXPORTACAO', {_DNA_COLUMNS}
            FROM centrix_quotation_client_dna
            WHERE service_type = 'IMPORTACAO'
            """
        )
    )

    # 3. Enforce not-null + one DNA per (client, operation).
    op.alter_column(
        "centrix_quotation_client_dna", "service_type", nullable=False
    )
    op.create_unique_constraint(
        "uq_client_dna_client_service",
        "centrix_quotation_client_dna",
        ["client_id", "service_type"],
    )


def downgrade():
    op.drop_constraint(
        "uq_client_dna_client_service",
        "centrix_quotation_client_dna",
        type_="unique",
    )
    # Restore the pre-split 1:1 shape: keep the IMPORTACAO row per client.
    op.execute(
        sa.text(
            "DELETE FROM centrix_quotation_client_dna WHERE service_type = 'EXPORTACAO'"
        )
    )
    op.drop_column("centrix_quotation_client_dna", "service_type")
