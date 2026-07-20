"""Add performance indexes for frequently filtered columns

Revision ID: 036
Revises: 035
Create Date: 2026-04-26

Indexes added:
  quotations:     state, client_id, analyst_id
  proposals:      quotation_id, agent_id
  audit_flags:    proposal_id
  rfq_tokens:     rfq_id
  equipments:     quotation_id
  volumes:        quotation_id

Note: rfq_agent_tokens.token already has a UNIQUE index from the model definition.
"""

import sqlalchemy as sa
from alembic import op

revision = "036"
down_revision = "035"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "idx_quotations_state",
        "centrix_quotation_quotations",
        ["state"],
    )
    op.create_index(
        "idx_quotations_client_id",
        "centrix_quotation_quotations",
        ["client_id"],
    )
    op.create_index(
        "idx_quotations_analyst_id",
        "centrix_quotation_quotations",
        ["analyst_id"],
    )
    op.create_index(
        "idx_proposals_quotation_id",
        "centrix_quotation_proposals",
        ["quotation_id"],
    )
    op.create_index(
        "idx_proposals_agent_id",
        "centrix_quotation_proposals",
        ["agent_id"],
    )
    op.create_index(
        "idx_audit_flags_proposal_id",
        "centrix_quotation_audit_flags",
        ["proposal_id"],
    )
    op.create_index(
        "idx_rfq_agent_tokens_rfq_id",
        "centrix_quotation_rfq_agent_tokens",
        ["rfq_id"],
    )
    op.create_index(
        "idx_equipments_quotation_id",
        "centrix_quotation_equipments",
        ["quotation_id"],
    )
    op.create_index(
        "idx_volumes_quotation_id",
        "centrix_quotation_volumes",
        ["quotation_id"],
    )


def downgrade() -> None:
    op.drop_index("idx_volumes_quotation_id", table_name="centrix_quotation_volumes")
    op.drop_index("idx_equipments_quotation_id", table_name="centrix_quotation_equipments")
    op.drop_index("idx_rfq_agent_tokens_rfq_id", table_name="centrix_quotation_rfq_agent_tokens")
    op.drop_index("idx_audit_flags_proposal_id", table_name="centrix_quotation_audit_flags")
    op.drop_index("idx_proposals_agent_id", table_name="centrix_quotation_proposals")
    op.drop_index("idx_proposals_quotation_id", table_name="centrix_quotation_proposals")
    op.drop_index("idx_quotations_analyst_id", table_name="centrix_quotation_quotations")
    op.drop_index("idx_quotations_client_id", table_name="centrix_quotation_quotations")
    op.drop_index("idx_quotations_state", table_name="centrix_quotation_quotations")
