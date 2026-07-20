"""Add slack_daily_threads table

Revision ID: 059
Revises: 058
Create Date: 2026-05-21

Stores the Slack thread_ts for each day's notification thread so all
proposals received on the same day are posted as replies to a single
parent message instead of individual top-level messages.
"""

import sqlalchemy as sa
from alembic import op

revision = "059"
down_revision = "058"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "centrix_slack_daily_threads",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("channel_id", sa.String(), nullable=False),
        sa.Column("thread_ts", sa.String(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("date", "channel_id", name="uq_slack_daily_thread_date_channel"),
    )


def downgrade():
    op.drop_table("centrix_slack_daily_threads")
