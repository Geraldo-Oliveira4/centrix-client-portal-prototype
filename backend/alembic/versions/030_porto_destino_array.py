"""Convert porto_destino from TEXT to TEXT[]

Revision ID: 030
Revises: 029
Create Date: 2026-04-22
"""

import sqlalchemy as sa
from alembic import op

revision = "030"
down_revision = "029"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(sa.text(
        """
        ALTER TABLE centrix_quotation_quotations
        ALTER COLUMN porto_destino TYPE TEXT[]
        USING CASE
            WHEN porto_destino IS NULL THEN NULL
            ELSE ARRAY[porto_destino]
        END
        """
    ))


def downgrade() -> None:
    op.execute(sa.text(
        """
        ALTER TABLE centrix_quotation_quotations
        ALTER COLUMN porto_destino TYPE TEXT
        USING CASE
            WHEN porto_destino IS NULL THEN NULL
            ELSE array_to_string(porto_destino, ', ')
        END
        """
    ))
