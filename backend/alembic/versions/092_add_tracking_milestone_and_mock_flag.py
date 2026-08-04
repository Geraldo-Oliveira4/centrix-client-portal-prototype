"""Add tracking milestone + illustrative-data flag to embarques

Revision ID: 092
Revises: 091
Create Date: 2026-08-04

PROTOTYPE-ONLY migration (does not exist in Centrix). Completes migration 091
with the two columns the portal needs to (a) advance the post-departure part of
the timeline and (b) tell the client, on screen, that a given shipment's
tracking is demo data rather than a carrier feed.

    tracking_last_milestone  <- the last milestone the carrier reported, in the
                                ShipsGo vocabulary. NULL = nothing reported.
                                'OCEAN_TRANSIT' | 'ARRIVAL' | 'DISCHARGE' |
                                'AVAILABLE' map 1:1 onto the four post-embarque
                                steps of the portal timeline (Em transito,
                                Chegada, Descarregado, Liberado). Gate-in and
                                Vessel Loading are absent on purpose: those are
                                the real EmbarqueState values `coletado` and
                                `embarcado`, already stored.

    tracking_is_mock         <- TRUE marks tracking values that were fabricated
                                for the demo (scripts/topup_tracking_demo.py).
                                The portal renders the "Pre-visualizacao" seal
                                whenever it is TRUE, exactly like the audit
                                preview's `is_mock`. A real integration writes
                                FALSE/NULL, so nothing real can inherit the
                                seal and nothing fabricated can escape it.

`tracking_is_mock` is a column and not a hardcoded list of references in the
frontend on purpose: the label has to travel with the data, so a shipment that
gets real tracking later loses the seal by having the flag cleared, not by
someone remembering to edit a list.
"""

import sqlalchemy as sa
from alembic import op

revision = "092"
down_revision = "091"
branch_labels = None
depends_on = None

MILESTONES = ("OCEAN_TRANSIT", "ARRIVAL", "DISCHARGE", "AVAILABLE")


def upgrade():
    op.execute(sa.text(
        "ALTER TABLE centrix_shipment_embarques "
        "ADD COLUMN IF NOT EXISTS tracking_last_milestone VARCHAR(24), "
        "ADD COLUMN IF NOT EXISTS tracking_is_mock BOOLEAN"
    ))
    op.execute(sa.text(
        "ALTER TABLE centrix_shipment_embarques "
        "DROP CONSTRAINT IF EXISTS ck_embarques_tracking_last_milestone"
    ))
    values = ", ".join(f"'{m}'" for m in MILESTONES)
    op.execute(sa.text(
        "ALTER TABLE centrix_shipment_embarques "
        "ADD CONSTRAINT ck_embarques_tracking_last_milestone "
        "CHECK (tracking_last_milestone IS NULL "
        f"OR tracking_last_milestone IN ({values}))"
    ))


def downgrade():
    op.execute(sa.text(
        "ALTER TABLE centrix_shipment_embarques "
        "DROP CONSTRAINT IF EXISTS ck_embarques_tracking_last_milestone"
    ))
    op.drop_column("centrix_shipment_embarques", "tracking_is_mock")
    op.drop_column("centrix_shipment_embarques", "tracking_last_milestone")
