"""Add carrier-tracking fields to embarques — structure for the ShipsGo integration

Revision ID: 091
Revises: 090
Create Date: 2026-08-04

PROTOTYPE-ONLY migration (does not exist in Centrix). The Client Portal shows a
delay-risk badge and an ETA on every shipment; both need two dates the carrier
reports and neither exists anywhere in the schema today. Until the ShipsGo
integration lands (Mauro, Aug-Oct 2026) these columns stay NULL — nothing in
this repo writes them, and no seed populates them. That is deliberate: with the
columns NULL the portal renders "Pendente integração" instead of a fabricated
number.

Mapping to the ShipsGo container/BL payload, so the writer has one obvious
target when the integration is built:

    tracking_first_eta      <- the FIRST ETA the carrier ever reported
    tracking_current_eta    <- the CURRENT ETA, or the actual arrival timestamp
    tracking_eta_is_actual  <- ShipsGo `IsActual`: true when the value above is
                               a real arrival, not an estimate
    tracking_data_status    <- 'COMPLETE' | 'INCOMPLETE'. INCOMPLETE is ShipsGo
                               reporting that the carrier did not publish enough
                               data for this shipment. It is NOT the same as
                               NULL (we have not integrated yet) and the portal
                               renders the two differently.

`tracking_data_status` is a plain VARCHAR with a CHECK rather than a PG enum:
the vocabulary belongs to a third party we have not integrated with yet, and a
CHECK is far cheaper to widen than an enum type.

The delay risk itself is NOT stored — it is derived from the two dates by a pure
function in the frontend (app/portal/embarques/lib/delay-risk.ts), so the rule
lives in one place and cannot drift from what the client sees.
"""

import sqlalchemy as sa
from alembic import op

revision = "091"
down_revision = "090"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(sa.text(
        "ALTER TABLE centrix_shipment_embarques "
        "ADD COLUMN IF NOT EXISTS tracking_first_eta TIMESTAMPTZ, "
        "ADD COLUMN IF NOT EXISTS tracking_current_eta TIMESTAMPTZ, "
        "ADD COLUMN IF NOT EXISTS tracking_eta_is_actual BOOLEAN, "
        "ADD COLUMN IF NOT EXISTS tracking_data_status VARCHAR(16)"
    ))
    op.execute(sa.text(
        "ALTER TABLE centrix_shipment_embarques "
        "DROP CONSTRAINT IF EXISTS ck_embarques_tracking_data_status"
    ))
    op.execute(sa.text(
        "ALTER TABLE centrix_shipment_embarques "
        "ADD CONSTRAINT ck_embarques_tracking_data_status "
        "CHECK (tracking_data_status IS NULL "
        "OR tracking_data_status IN ('COMPLETE', 'INCOMPLETE'))"
    ))


def downgrade():
    op.execute(sa.text(
        "ALTER TABLE centrix_shipment_embarques "
        "DROP CONSTRAINT IF EXISTS ck_embarques_tracking_data_status"
    ))
    op.drop_column("centrix_shipment_embarques", "tracking_data_status")
    op.drop_column("centrix_shipment_embarques", "tracking_eta_is_actual")
    op.drop_column("centrix_shipment_embarques", "tracking_current_eta")
    op.drop_column("centrix_shipment_embarques", "tracking_first_eta")
