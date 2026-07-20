"""Fix modal_regions column — reconcile DB state after intermediate migration

Revision ID: 054
Revises: 053
Create Date: 2026-05-13

Migration 053 was applied in an intermediate form that added a 'modais' column
and 'operating_modal' enum but did not drop 'operating_regions' or add
'modal_regions'. This migration finalises the intended schema:
  - Drops 'modais' (intermediate column)
  - Drops 'operating_modal' enum type (intermediate)
  - Drops 'operating_regions' (legacy geographic column)
  - Drops 'operating_region' enum type (legacy)
  - Creates 'modal_region' enum (9 composite values)
  - Adds 'modal_regions' column
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ARRAY

revision = "054"
down_revision = "053"
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
    op.execute(sa.text("ALTER TABLE centrix_quotation_freight_agents DROP COLUMN IF EXISTS modais"))
    op.execute(sa.text("DROP TYPE IF EXISTS operating_modal"))
    op.execute(sa.text("ALTER TABLE centrix_quotation_freight_agents DROP COLUMN IF EXISTS operating_regions"))
    op.execute(sa.text("DROP TYPE IF EXISTS operating_region"))

    # CREATE TYPE has no IF NOT EXISTS in PostgreSQL — use a DO block instead.
    # On a fresh DB, migration 053 already created modal_region, so this is a no-op.
    # On prod where 053 ran in an intermediate form, this creates it for the first time.
    values_sql = ", ".join(f"'{v}'" for v in MODAL_REGION_VALUES)
    op.execute(sa.text(f"""
        DO $$ BEGIN
            CREATE TYPE modal_region AS ENUM ({values_sql});
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """))
    op.execute(
        sa.text(
            "ALTER TABLE centrix_quotation_freight_agents"
            " ADD COLUMN IF NOT EXISTS modal_regions modal_region[]"
        )
    )


def downgrade() -> None:
    op.execute(sa.text("ALTER TABLE centrix_quotation_freight_agents DROP COLUMN IF EXISTS modal_regions"))
    op.execute(sa.text("DROP TYPE IF EXISTS modal_region"))

    op.execute(sa.text("""
        DO $$ BEGIN
            CREATE TYPE operating_region AS ENUM ('ASIA', 'EUROPA', 'AMERICAS');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """))
    op.execute(
        sa.text(
            "ALTER TABLE centrix_quotation_freight_agents"
            " ADD COLUMN IF NOT EXISTS operating_regions operating_region[]"
        )
    )
