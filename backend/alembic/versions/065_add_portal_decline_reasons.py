"""Add portal decline reasons

Revision ID: 065
Revises: 064
Create Date: 2026-06-02

Adds client-facing decline reasons requested by the portal spec to the
declinereason PostgreSQL enum.
"""

import sqlalchemy as sa
from alembic import op


revision = "065"
down_revision = "064"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        sa.text("ALTER TYPE declinereason ADD VALUE IF NOT EXISTS 'NAO_VAI_IMPORTAR'")
    )
    op.execute(
        sa.text(
            "ALTER TYPE declinereason ADD VALUE IF NOT EXISTS "
            "'ALTERNATIVA_OUTRO_PRESTADOR'"
        )
    )
    op.execute(
        sa.text("ALTER TYPE declinereason ADD VALUE IF NOT EXISTS 'VALIDADE_EXPIRADA'")
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            """
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1
                    FROM centrix_quotation_quotations
                    WHERE decline_reason::text IN (
                        'NAO_VAI_IMPORTAR',
                        'ALTERNATIVA_OUTRO_PRESTADOR',
                        'VALIDADE_EXPIRADA'
                    )
                ) THEN
                    RAISE EXCEPTION 'Cannot downgrade: quotations use new declinereason values';
                END IF;
            END $$;
            """
        )
    )
    op.execute(
        sa.text(
            "ALTER TABLE centrix_quotation_quotations "
            "ALTER COLUMN decline_reason TYPE text USING decline_reason::text"
        )
    )
    op.execute(sa.text("DROP TYPE declinereason"))
    op.execute(
        sa.text(
            "CREATE TYPE declinereason AS ENUM "
            "('PRECO', 'TRANSIT_TIME', 'SEM_RESPOSTA', 'OUTROS')"
        )
    )
    op.execute(
        sa.text(
            "ALTER TABLE centrix_quotation_quotations "
            "ALTER COLUMN decline_reason TYPE declinereason "
            "USING decline_reason::declinereason"
        )
    )
