"""fix client tier enum values

Revision ID: 003
Revises: 002
Create Date: 2026-03-17

Replaces BRONZE/SILVER/GOLD/PLATINUM with the correct 2x2 segmentation
quadrants defined in RF-COT-100: PREMIUM, POTENCIAL, CRESCIMENTO, MANTER.
"""

import sqlalchemy as sa
from alembic import op

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # PostgreSQL does not support dropping or renaming enum values directly.
    # The safe pattern is: rename old type, create new type, migrate column, drop old type.

    op.execute(sa.text("ALTER TYPE clienttier RENAME TO clienttier_old"))

    op.execute(sa.text(
        "CREATE TYPE clienttier AS ENUM ('PREMIUM', 'POTENCIAL', 'CRESCIMENTO', 'MANTER')"
    ))

    # Drop the default first — PostgreSQL cannot cast the old default value to the new type automatically.
    op.execute(sa.text(
        "ALTER TABLE centrix_quotation_clients ALTER COLUMN tier DROP DEFAULT"
    ))

    op.execute(sa.text(
        "ALTER TABLE centrix_quotation_clients "
        "ALTER COLUMN tier TYPE clienttier USING tier::text::clienttier"
    ))

    op.execute(sa.text(
        "ALTER TABLE centrix_quotation_clients "
        "ALTER COLUMN tier SET DEFAULT 'MANTER'"
    ))

    op.execute(sa.text("DROP TYPE clienttier_old"))


def downgrade() -> None:
    op.execute(sa.text("ALTER TYPE clienttier RENAME TO clienttier_old"))

    op.execute(sa.text(
        "CREATE TYPE clienttier AS ENUM ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM')"
    ))

    op.execute(sa.text(
        "ALTER TABLE centrix_quotation_clients "
        "ALTER COLUMN tier TYPE clienttier USING tier::text::clienttier"
    ))

    op.execute(sa.text(
        "ALTER TABLE centrix_quotation_clients "
        "ALTER COLUMN tier SET DEFAULT 'BRONZE'"
    ))

    op.execute(sa.text("DROP TYPE clienttier_old"))
