"""Client-scoped shipment (GE) queries for the Client Portal.

Kept apart from `processo_repository` / `embarque_repository` (the analyst GE
module, whose `list_for_kanban` is global and unfiltered) for the same reason
`portal_exporter_repository` exists: the ownership predicate lives in every
function here rather than at the call site, so a portal route can never reach a
Processo it does not own.

Mirrors the anti-enumeration rule the portal applies to quotations — a Processo
belonging to another client is indistinguishable from one that does not exist
(`get_owned` returns None for both).

The Processo is joined to its Embarque with an INNER join: a Processo carries the
commercial data (incoterm, modal, agent) while the Embarque carries the state and
the EMB- reference, and the portal has nothing to show without both. Provisioning
(`shipment_service.provision_processo_from_quotation`) always creates exactly one
Embarque per Processo, so the join does not multiply rows today; if the GE module
ever splits a Processo into several Embarques, the list turns into one row per
Embarque, which is the reading the portal wants anyway.
"""

import uuid
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from shared.database.models.quotation.freight_agent import FreightAgent
from shared.database.models.shipment.embarque import Embarque
from shared.database.models.shipment.processo import Processo


def list_by_client(
    session: Session, client_id: uuid.UUID
) -> list[tuple[Processo, Embarque, Optional[str]]]:
    """(processo, embarque, agent_name) triples owned by this client.

    The agent name is resolved in the same statement (outer join) instead of a
    per-row lookup, so the list endpoint stays a single round-trip. Ordered
    urgent-first then newest-first, matching the analyst kanban ordering.
    """
    stmt = (
        select(Processo, Embarque, FreightAgent.name)
        .join(Embarque, Embarque.processo_id == Processo.id)
        .outerjoin(FreightAgent, FreightAgent.id == Processo.agente_id)
        .where(Processo.client_id == client_id)
        .order_by(Processo.carga_urgente.desc(), Processo.created_at.desc())
    )
    return list(session.execute(stmt).all())


def get_owned(
    session: Session, processo_id: uuid.UUID, client_id: uuid.UUID
) -> Optional[tuple[Processo, Embarque, Optional[FreightAgent]]]:
    """Load a shipment only if this client owns it, else None.

    Returns the full FreightAgent (not just its name) because the detail view
    also renders the agent id. `processo_id` is the identifier the portal
    exposes as `id`, consistent with the analyst `serialize_processo_detail`.
    """
    stmt = (
        select(Processo, Embarque, FreightAgent)
        .join(Embarque, Embarque.processo_id == Processo.id)
        .outerjoin(FreightAgent, FreightAgent.id == Processo.agente_id)
        .where(Processo.id == processo_id, Processo.client_id == client_id)
    )
    row = session.execute(stmt).first()
    return tuple(row) if row is not None else None
