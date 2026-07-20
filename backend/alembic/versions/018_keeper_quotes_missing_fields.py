"""Keeper Quotes alignment — missing fields phase 2.

Revision ID: 018
Revises: 017
Create Date: 2026-04-09

Changes:
- Add enum type: tipocotacao (REAL / ESTIMATIVA)
- Add columns to centrix_quotation_quotations:
    tipo_cotacao, data_cotacao,
    porto_embarque, porto_destino, aeroporto_embarque, aeroporto_destino,
    incluir_entrega_destino_final,
    packing, un_number, imo_class,
    data_prontidao, data_limite_necessidade,
    carga_tombavel
- Change desired_deadline from DATE to TIMESTAMPTZ (adds time component)
"""

from alembic import op
import sqlalchemy as sa

revision = "018"
down_revision = "017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # 1. New enum type
    # ------------------------------------------------------------------
    op.execute(sa.text(
        "CREATE TYPE tipocotacao AS ENUM ('REAL', 'ESTIMATIVA')"
    ))

    # ------------------------------------------------------------------
    # 2. New columns on centrix_quotation_quotations
    # ------------------------------------------------------------------
    op.execute(sa.text(
        "ALTER TABLE centrix_quotation_quotations ADD COLUMN tipo_cotacao tipocotacao"
    ))
    op.execute(sa.text(
        "ALTER TABLE centrix_quotation_quotations ADD COLUMN data_cotacao DATE"
    ))
    op.execute(sa.text(
        "ALTER TABLE centrix_quotation_quotations ADD COLUMN porto_embarque TEXT"
    ))
    op.execute(sa.text(
        "ALTER TABLE centrix_quotation_quotations ADD COLUMN porto_destino TEXT"
    ))
    op.execute(sa.text(
        "ALTER TABLE centrix_quotation_quotations ADD COLUMN aeroporto_embarque TEXT"
    ))
    op.execute(sa.text(
        "ALTER TABLE centrix_quotation_quotations ADD COLUMN aeroporto_destino TEXT"
    ))
    op.execute(sa.text(
        "ALTER TABLE centrix_quotation_quotations ADD COLUMN incluir_entrega_destino_final BOOLEAN"
    ))
    op.execute(sa.text(
        "ALTER TABLE centrix_quotation_quotations ADD COLUMN packing TEXT"
    ))
    op.execute(sa.text(
        "ALTER TABLE centrix_quotation_quotations ADD COLUMN un_number TEXT"
    ))
    op.execute(sa.text(
        "ALTER TABLE centrix_quotation_quotations ADD COLUMN imo_class TEXT"
    ))
    op.execute(sa.text(
        "ALTER TABLE centrix_quotation_quotations ADD COLUMN data_prontidao DATE"
    ))
    op.execute(sa.text(
        "ALTER TABLE centrix_quotation_quotations ADD COLUMN data_limite_necessidade DATE"
    ))
    op.execute(sa.text(
        "ALTER TABLE centrix_quotation_quotations ADD COLUMN carga_tombavel BOOLEAN"
    ))

    # ------------------------------------------------------------------
    # 3. Promote desired_deadline from DATE to TIMESTAMPTZ
    #    Existing date values are cast to midnight UTC.
    # ------------------------------------------------------------------
    op.execute(sa.text(
        "ALTER TABLE centrix_quotation_quotations "
        "ALTER COLUMN desired_deadline TYPE TIMESTAMPTZ "
        "USING desired_deadline::TIMESTAMPTZ"
    ))


def downgrade() -> None:
    # Revert desired_deadline back to DATE (truncates time)
    op.execute(sa.text(
        "ALTER TABLE centrix_quotation_quotations "
        "ALTER COLUMN desired_deadline TYPE DATE "
        "USING desired_deadline::DATE"
    ))

    for col in (
        "carga_tombavel", "data_limite_necessidade", "data_prontidao",
        "imo_class", "un_number", "packing", "incluir_entrega_destino_final",
        "aeroporto_destino", "aeroporto_embarque", "porto_destino", "porto_embarque",
        "data_cotacao", "tipo_cotacao",
    ):
        op.execute(sa.text(
            f"ALTER TABLE centrix_quotation_quotations DROP COLUMN IF EXISTS {col}"
        ))

    op.execute(sa.text("DROP TYPE IF EXISTS tipocotacao"))
