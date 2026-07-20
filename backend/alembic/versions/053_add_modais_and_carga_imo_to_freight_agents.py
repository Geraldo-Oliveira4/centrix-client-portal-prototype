"""Add modal_regions and carga_imo to freight agents

Revision ID: 053
Revises: 052
Create Date: 2026-05-13

Replaces the separate operating_regions (geographic) and adds modal_regions,
a composite enum of (modal x region) covering all 9 combinations:
AEREO/MARITIMO_FCL/MARITIMO_LCL x ASIA/EUROPA/AMERICAS.

Also renames certificacao_anvisa to carga_imo.
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ARRAY

revision = "053"
down_revision = "052"
branch_labels = None
depends_on = None

MODAL_REGION_VALUES = (
    "AEREO_ASIA",
    "AEREO_EUROPA",
    "AEREO_AMERICAS",
    "MARITIMO_FCL_ASIA",
    "MARITIMO_FCL_EUROPA",
    "MARITIMO_FCL_AMERICAS",
    "MARITIMO_LCL_ASIA",
    "MARITIMO_LCL_EUROPA",
    "MARITIMO_LCL_AMERICAS",
)


def upgrade() -> None:
    op.drop_column("centrix_quotation_freight_agents", "operating_regions")
    op.execute(sa.text("DROP TYPE operating_region"))

    op.execute(
        sa.text(
            "CREATE TYPE modal_region AS ENUM ("
            + ", ".join(f"'{v}'" for v in MODAL_REGION_VALUES)
            + ")"
        )
    )
    op.add_column(
        "centrix_quotation_freight_agents",
        sa.Column(
            "modal_regions",
            ARRAY(sa.Enum(*MODAL_REGION_VALUES, name="modal_region")),
            nullable=True,
        ),
    )
    op.alter_column(
        "centrix_quotation_freight_agents",
        "certificacao_anvisa",
        new_column_name="carga_imo",
    )


def downgrade() -> None:
    op.alter_column(
        "centrix_quotation_freight_agents",
        "carga_imo",
        new_column_name="certificacao_anvisa",
    )
    op.drop_column("centrix_quotation_freight_agents", "modal_regions")
    op.execute(sa.text("DROP TYPE modal_region"))

    op.execute(
        sa.text("CREATE TYPE operating_region AS ENUM ('ASIA', 'EUROPA', 'AMERICAS')")
    )
    op.add_column(
        "centrix_quotation_freight_agents",
        sa.Column(
            "operating_regions",
            ARRAY(sa.Enum("ASIA", "EUROPA", "AMERICAS", name="operating_region")),
            nullable=True,
        ),
    )
