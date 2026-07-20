"""022 — remove packing field from quotations

The packing field at the quotation level was redundant with the per-volume
embalagem enum. Package type is now captured exclusively via QuotationVolume.embalagem.

Revision ID: 022
Revises: 021
"""

from alembic import op


revision = "022"
down_revision = "021"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("centrix_quotation_quotations", "packing")


def downgrade() -> None:
    import sqlalchemy as sa
    op.add_column(
        "centrix_quotation_quotations",
        sa.Column("packing", sa.Text(), nullable=True),
    )
