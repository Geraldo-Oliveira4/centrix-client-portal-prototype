"""Shared token-resolution + rejection-logging for public (no-JWT) quotation endpoints.

Every public handler under lambdas/quotation/ that accepts a `token` query param
follows the same shape: resolve the token, walk to its RFQ/quotation (or straight
to the quotation for client-portal tokens), reject with a structured log if any
step fails or the quotation is in a terminal state, otherwise append logger keys
and X-Ray annotations and hand back the resolved objects. This module is the
single place that sequence lives, so call sites can't drift on which fields get
logged or which token-repository variant is used.
"""

from dataclasses import dataclass
from typing import Optional

from shared.database.models.quotation.enums import QUOTATION_TERMINAL_STATES
from shared.database.models.quotation.quotation import Quotation
from shared.database.models.quotation.quotation_client_token import QuotationClientToken
from shared.database.models.quotation.rfq import RFQ
from shared.database.models.quotation.rfq_agent_token import RFQAgentToken
from shared.database.repositories import (
    quotation_client_token_repository,
    quotation_repository,
    rfq_agent_token_repository,
    rfq_repository,
)
from shared.observability import annotate_trace, logger, reject


@dataclass
class ResolvedRfqToken:
    token_record: RFQAgentToken
    rfq: RFQ
    quotation: Quotation


@dataclass
class ResolvedClientToken:
    token_record: QuotationClientToken
    quotation: Quotation


def resolve_rfq_token(
    session,
    token: str,
    *,
    check_revoked: bool = True,
    terminal_state_message: str = "This quotation is no longer accepting proposals",
) -> tuple[Optional[ResolvedRfqToken], Optional[dict]]:
    """Resolve a per-agent RFQ token to its RFQ + quotation, rejecting on any failure.

    `check_revoked=False` preserves the pre-existing behaviour of the upload/
    extraction handlers (get_public_proposal_upload_url, extract_public_proposal_pdf,
    confirm_public_proposal_upload), which historically used get_by_token() and did
    not check revocation — kept as an explicit opt-out rather than silently changed.

    Returns (ResolvedRfqToken, None) on success, or (None, error_response) on
    failure — the caller should `return` the error_response as-is. On success,
    rfq_id/agent_id/quotation_id/quotation_reference are already in the logger
    context (append_keys) and as X-Ray trace annotations.
    """
    token_record = (
        rfq_agent_token_repository.get_valid_token(session, token)
        if check_revoked
        else rfq_agent_token_repository.get_by_token(session, token)
    )
    if token_record is None:
        return None, reject(404, "invalid_token", {"error": "Invalid or expired token"}, token_prefix=token[:8])

    rfq = rfq_repository.get(session, token_record.rfq_id)
    if rfq is None:
        return None, reject(
            404, "rfq_not_found", {"error": "RFQ not found"},
            token_prefix=token[:8], agent_id=str(token_record.agent_id),
        )

    quotation = quotation_repository.get(session, rfq.quotation_id)
    if quotation is None:
        return None, reject(404, "quotation_not_found", {"error": "Quotation not found"}, rfq_id=str(rfq.id))

    logger.append_keys(
        rfq_id=str(rfq.id),
        agent_id=str(token_record.agent_id),
        quotation_id=str(quotation.id),
        quotation_reference=quotation.reference,
    )
    annotate_trace(
        quotation_reference=quotation.reference,
        quotation_id=str(quotation.id),
        agent_id=str(token_record.agent_id),
    )

    if quotation.state in QUOTATION_TERMINAL_STATES:
        return None, reject(410, "terminal_state", {"error": terminal_state_message}, quotation_state=quotation.state.value)

    return ResolvedRfqToken(token_record=token_record, rfq=rfq, quotation=quotation), None


def resolve_client_token(
    session,
    token_value: str,
    *,
    terminal_state_message: str = "This quotation is no longer active",
    for_update: bool = False,
) -> tuple[Optional[ResolvedClientToken], Optional[dict]]:
    """Resolve a client-portal token to its quotation, rejecting on any failure.

    `for_update=True` locks the quotation row for the rest of the transaction —
    use it for handlers that mutate the quotation (e.g. client approval) so
    two concurrent requests on the same token can't both pass a state/winner
    check before either commits. Read-only callers should leave it False.

    Returns (ResolvedClientToken, None) on success, or (None, error_response) on
    failure — the caller should `return` the error_response as-is.
    """
    token_record = quotation_client_token_repository.get_valid_by_token(session, token_value)
    if token_record is None:
        return None, reject(404, "invalid_token", {"error": "Invalid or expired token"}, token_prefix=token_value[:8])

    quotation = quotation_repository.get(session, token_record.quotation_id, for_update=for_update)
    if quotation is None:
        return None, reject(404, "quotation_not_found", {"error": "Quotation not found"}, token_id=str(token_record.id))

    logger.append_keys(quotation_id=str(quotation.id), quotation_reference=quotation.reference)
    annotate_trace(quotation_reference=quotation.reference, quotation_id=str(quotation.id))

    if quotation.state in QUOTATION_TERMINAL_STATES:
        return None, reject(410, "terminal_state", {"error": terminal_state_message}, quotation_state=quotation.state.value)

    return ResolvedClientToken(token_record=token_record, quotation=quotation), None
