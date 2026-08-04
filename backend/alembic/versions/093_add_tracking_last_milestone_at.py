"""Add the date of the last reported tracking milestone

Revision ID: 093
Revises: 092
Create Date: 2026-08-04

PROTOTYPE-ONLY migration (does not exist in Centrix). Migration 092 stored WHICH
milestone the carrier last reported, but not WHEN it happened:

    tracking_last_milestone_at  <- the date the carrier reported for
                                   `tracking_last_milestone`. NULL = we do not
                                   know when (no integration, or the carrier
                                   reported the milestone without a date).

The portal needed this for the demurrage alert: when the last milestone is
'AVAILABLE' the container is sitting at the terminal accruing storage, and the
alert has to state WHEN it was released so the client can judge the urgency.
Deriving that date from `tracking_current_eta` would have been wrong — that is
the arrival at POD (or its estimate), and release happens after it.

What this column deliberately does NOT hold: the free time (demurrage/detention
free days). That is a commercial clause negotiated per client, it lives in Inova
and not in the carrier feed, so no countdown ("vence em X dias") can be computed
from tracking data. The alert states the release fact and stops there.
"""

import sqlalchemy as sa
from alembic import op

revision = "093"
down_revision = "092"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(sa.text(
        "ALTER TABLE centrix_shipment_embarques "
        "ADD COLUMN IF NOT EXISTS tracking_last_milestone_at TIMESTAMPTZ"
    ))


def downgrade():
    op.drop_column("centrix_shipment_embarques", "tracking_last_milestone_at")
