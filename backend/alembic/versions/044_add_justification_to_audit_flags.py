"""Add justification to audit_flags

Revision ID: 044
Revises: 043
Create Date: 2026-05-06

Adds justification (text) to centrix_quotation_audit_flags so that
operators can provide a required justification when resolving MEDIUM
severity flags.
"""

import sqlalchemy as sa
from alembic import op

revision = "044"
down_revision = "043"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "centrix_quotation_audit_flags",
        sa.Column("justification", sa.Text, nullable=True),
    )


def downgrade() -> None:
    op.drop_column("centrix_quotation_audit_flags", "justification")
