"""initial schema

Revision ID: 001
Revises:
Create Date: 2026-03-14

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "pre_registered_users",
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("role", sa.String(), nullable=False, server_default="user"),
        sa.PrimaryKeyConstraint("email"),
    )

    op.create_table(
        "logs",
        sa.Column("log_id", UUID(as_uuid=True), nullable=False),
        sa.Column(
            "timestamp",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("action_type", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("details", JSONB(), nullable=False),
        sa.Column("error_message", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("log_id"),
    )

    op.create_table(
        "configs",
        sa.Column("config_type", sa.String(), nullable=False),
        sa.Column("config_data", JSONB(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_by", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("config_type"),
    )


def downgrade() -> None:
    op.drop_table("configs")
    op.drop_table("logs")
    op.drop_table("pre_registered_users")
