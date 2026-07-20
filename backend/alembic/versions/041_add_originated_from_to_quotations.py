"""add originated_from_id and recotacao_motivo to quotations

Revision ID: 041
Revises: 040
Create Date: 2026-05-05

Adds two nullable columns to centrix_quotation_quotations:
  - originated_from_id: UUID self-reference to the source quotation (duplicate/re-cotacao)
  - recotacao_motivo: operator-provided reason text for a re-cotacao
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "041"
down_revision = "040"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "centrix_quotation_quotations",
        sa.Column(
            "originated_from_id",
            UUID(as_uuid=True),
            sa.ForeignKey("centrix_quotation_quotations.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "centrix_quotation_quotations",
        sa.Column("recotacao_motivo", sa.Text, nullable=True),
    )


def downgrade() -> None:
    op.drop_column("centrix_quotation_quotations", "recotacao_motivo")
    op.drop_column("centrix_quotation_quotations", "originated_from_id")
