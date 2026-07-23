"""Linking a portal-registered exporter to a newly created quotation.

Why this lives in `app/` and not in the handler: `create_my_quotation` builds the
quotation through `shared/domain/quotation_creation.create_quotation_core`, whose
`parse_quotation_payload` has no `exporter_id` field — in Centrix the exporter is
attached later, by the analyst. Rather than diverge from that copied domain code
(see CLAUDE.md: adaptations belong in `app/`), the router links the exporter in a
second step, the same shape as `prototype_flow.auto_close_approved_quotation`.

Ownership is re-checked here against the quotation's own client_id, so a tampered
payload cannot attach another client's exporter even though the create handler
never saw the field.
"""

import uuid

from shared.database.connection import get_session
from shared.database.repositories import portal_exporter_repository, quotation_repository
from shared.observability import logger


def link_exporter(quotation_id: str, exporter_id: str) -> bool:
    """Attach `exporter_id` to the quotation when the quotation's client owns it.

    Returns True when the link was written. Returns False — without raising — when
    the id is malformed, the quotation is gone, or the exporter belongs to someone
    else: the quotation itself was already created successfully, so a bad exporter
    reference must not turn a 201 into an error. The mismatch is logged instead.
    """
    try:
        qid = uuid.UUID(quotation_id)
        eid = uuid.UUID(exporter_id)
    except (ValueError, AttributeError, TypeError):
        logger.warning("portal_exporter_link_invalid_uuid")
        return False

    with get_session() as session:
        quotation = quotation_repository.get(session, qid, for_update=True)
        if quotation is None:
            return False

        exporter = portal_exporter_repository.get_owned(
            session, eid, quotation.client_id
        )
        if exporter is None:
            logger.warning(
                "portal_exporter_link_denied",
                extra={"quotation_id": quotation_id, "exporter_id": exporter_id},
            )
            return False

        quotation.exporter_id = exporter.id
        session.flush()

    return True
