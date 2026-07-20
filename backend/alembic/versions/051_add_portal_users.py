"""Add centrix_portal_users table

Revision ID: 051
Revises: 050
Create Date: 2026-05-02

Creates the centrix_portal_users table for the Client Portal. Portal users
live in a separate Cognito pool (centrix-client-portal-pool) and a separate
table from internal Freitas employees (centrix_users). Each portal user
belongs to exactly one QuotationClient (FK NOT NULL with ON DELETE RESTRICT
so deleting a client requires deleting its portal users first).
"""

import sqlalchemy as sa
from alembic import op

revision = "051"
down_revision = "050"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # IF NOT EXISTS guards against dev DBs where this table was created by the
    # old migration 046 before the portal migrations were renumbered to 051/052.
    bind = op.get_bind()
    if bind.dialect.has_table(bind, "centrix_portal_users"):
        return
    op.create_table(
        "centrix_portal_users",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column(
            "client_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email", name="uq_centrix_portal_users_email"),
        sa.ForeignKeyConstraint(
            ["client_id"],
            ["centrix_quotation_clients.id"],
            ondelete="RESTRICT",
            name="fk_centrix_portal_users_client_id",
        ),
    )
    op.create_index(
        "ix_centrix_portal_users_client_id",
        "centrix_portal_users",
        ["client_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_centrix_portal_users_client_id", table_name="centrix_portal_users")
    op.drop_table("centrix_portal_users")
