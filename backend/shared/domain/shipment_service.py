"""shipment_service — cross-repository orchestration for the GE module.

Multi-repository operations belong here, not inside repository modules.
Keeping each repository focused on a single table prevents cross-import
coupling in the repository layer.
"""

from sqlalchemy.orm import Session

from shared.database.models.quotation.enums import UrgencyLevel
from shared.database.models.shipment.embarque import Embarque
from shared.database.models.shipment.enums import EmbarqueState
from shared.database.repositories import (
    client_repository,
    embarque_repository,
    freight_agent_repository,
    processo_repository,
)


def read_processo_workspace(
    session: Session, processo
) -> "tuple[Embarque, object, object | None] | tuple[None, None, None]":
    """Fetch the embarque, client, and agent needed for the workspace view.

    Used by both GET /shipments/{id} and PUT /shipments/{id} to avoid
    duplicating the same three-repository read sequence in two handlers.

    Returns (embarque, client, agent) on success, or (None, None, None) if no
    embarque exists for the processo (data integrity error — should not occur).
    """
    embarques = embarque_repository.list(session, processo_id=processo.id)
    if not embarques:
        return None, None, None
    client = client_repository.get(session, processo.client_id)
    agent = (
        freight_agent_repository.get(session, processo.agente_id)
        if processo.agente_id
        else None
    )
    return embarques[0], client, agent


def get_embarque_for_quotation(session: Session, quotation) -> Embarque | None:
    """Return the existing embarque linked to a quotation, if any.

    Used by callers that need GE data after the quotation is already closed
    (e.g. send_shipment_instruction) without re-triggering provisioning.
    """
    existing = processo_repository.list(session, quotation_id=quotation.id)
    if not existing:
        return None
    embarques = embarque_repository.list(session, processo_id=existing[0].id)
    return embarques[0] if embarques else None


def provision_processo_from_quotation(session: Session, quotation) -> tuple[Embarque, bool]:
    """Create a Processo + Embarque(SOLICITADO) from an approved quotation.

    Ponte 1 — called inside send_shipment_instruction after the quotation
    transitions to FECHADA. Must run inside the same session so the GE record
    is committed atomically with the FECHADA transition.

    Idempotent: if a Processo already exists for this quotation (e.g. Lambda
    retry), returns its existing Embarque instead of creating a duplicate.

    Returns (embarque, created). `embarque.processo` is available via the
    ORM relationship for callers that need processo-level fields (e.g.
    inova_processo_id) without a separate repository query — access it while
    the session is still open. `created=False` marks the idempotent no-op
    path, preserving the distinction callers use for logging.
    """
    if quotation.client_id is None:
        raise ValueError("Cannot create a Processo from a quotation without a client_id")

    existing = processo_repository.list(session, quotation_id=quotation.id)
    if existing:
        existing_embarques = embarque_repository.list(session, processo_id=existing[0].id)
        return existing_embarques[0], False

    processo = processo_repository.create(
        session,
        client_id=quotation.client_id,
        quotation_id=quotation.id,
        incoterm=quotation.incoterm,
        modal=quotation.modal,
        tipo_embarque=quotation.tipo_embarque,
        agente_id=quotation.winning_agent_id,
        carga_urgente=quotation.urgency == UrgencyLevel.URGENTE,
    )
    embarque = embarque_repository.create(
        session, processo_id=processo.id, estado=EmbarqueState.SOLICITADO
    )
    return embarque, True
