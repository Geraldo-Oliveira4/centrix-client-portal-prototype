"""Add offered_container_type to proposals (ARB-2477)

Revision ID: 084
Revises: 083
Create Date: 2026-07-08

Victor Orsi (07/07, confirmed 08/07) reported an agent proposal (DC Logistics)
offering a 1x20" container when the quotation explicitly requested 1x40 FR —
the PDF diverged silently and the proposal was submitted without any block.

Agents now declare the container type they are offering on the portal form.
submit_proposal blocks the submission when the quotation has at least one
declared QuotationEquipment.tipo_container and the offered type is not among
them. FCL quotations with no declared container type are exempt — the agent
remains free to offer whatever is available (Victor Orsi, 08/07).

Reuses the existing `tipocontainer` enum type (already created in migration
015 for quotation_equipment / container_specs).
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ENUM as PgEnum

revision = "084"
down_revision = "083"
branch_labels = None
depends_on = None

_tipocontainer = PgEnum(name="tipocontainer", create_type=False)


def upgrade():
    op.add_column(
        "centrix_quotation_proposals",
        sa.Column("offered_container_type", _tipocontainer, nullable=True),
    )


def downgrade():
    op.drop_column("centrix_quotation_proposals", "offered_container_type")
