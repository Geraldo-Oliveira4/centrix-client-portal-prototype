"""Add exportador, pais_procedencia, peso_taxado to quotations (ARB-2387)

Revision ID: 076
Revises: 075
Create Date: 2026-06-29

Three new optional fields on centrix_quotation_quotations:
- exportador: shipper/exporter name (free text, extracted from email/attachments)
- pais_procedencia: country of origin (free text, extracted from commercial docs)
- peso_taxado: taxable weight in kg entered manually by the analyst
"""

import sqlalchemy as sa
from alembic import op

revision = "076"
down_revision = "075"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "centrix_quotation_quotations",
        sa.Column("exportador", sa.String(), nullable=True),
    )
    op.add_column(
        "centrix_quotation_quotations",
        sa.Column("pais_procedencia", sa.String(), nullable=True),
    )
    op.add_column(
        "centrix_quotation_quotations",
        sa.Column("peso_taxado", sa.Numeric(10, 2), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("centrix_quotation_quotations", "peso_taxado")
    op.drop_column("centrix_quotation_quotations", "pais_procedencia")
    op.drop_column("centrix_quotation_quotations", "exportador")
