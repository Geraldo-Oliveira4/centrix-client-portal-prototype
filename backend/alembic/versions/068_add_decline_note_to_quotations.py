"""Add decline_note to quotations

Revision ID: 068
Revises: 067
Create Date: 2026-06-03

Stores the optional free-text note the client may enter when declining a
quotation. The note was previously only written to the audit log's details
JSONB field; this column makes it available on the quotation row itself so
the portal serializer can expose it.
"""

import sqlalchemy as sa
from alembic import op


revision = "068"
down_revision = "067"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "centrix_quotation_quotations",
        sa.Column("decline_note", sa.String(1000), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("centrix_quotation_quotations", "decline_note")
