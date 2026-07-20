"""020 — add endereco_entrega_final to quotations

Adds an optional text column to centrix_quotation_quotations for storing
the final delivery address when porta-a-porta delivery is requested
(air modal only, when incluir_entrega_destino_final is true).

Revision ID: 020
Revises: 019
"""

from alembic import op
import sqlalchemy as sa

revision = "020"
down_revision = "019"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "centrix_quotation_quotations",
        sa.Column("endereco_entrega_final", sa.String(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("centrix_quotation_quotations", "endereco_entrega_final")
