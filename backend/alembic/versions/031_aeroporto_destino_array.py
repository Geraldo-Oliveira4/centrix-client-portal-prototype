"""Convert aeroporto_destino from TEXT to TEXT[]

Revision ID: 031
Revises: 030
Create Date: 2026-04-22
"""

import sqlalchemy as sa
from alembic import op

revision = "031"
down_revision = "030"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        sa.text(
            """
            ALTER TABLE centrix_quotation_quotations
            ALTER COLUMN aeroporto_destino TYPE TEXT[]
            USING CASE
                WHEN aeroporto_destino IS NULL THEN NULL
                ELSE ARRAY[aeroporto_destino]
            END
            """
        )
    )


def downgrade():
    op.execute(
        sa.text(
            """
            ALTER TABLE centrix_quotation_quotations
            ALTER COLUMN aeroporto_destino TYPE TEXT
            USING CASE
                WHEN aeroporto_destino IS NULL THEN NULL
                ELSE array_to_string(aeroporto_destino, ', ')
            END
            """
        )
    )
