"""Batch query helpers for common multi-repository read patterns.

These functions combine multiple repository calls into a single pass, avoiding
N+1 patterns in list/kanban handlers. They return serialized dicts ready for
embedding in API responses.
"""

from shared.database.models.quotation.rfq import RFQ
from shared.database.models.quotation.rfq_agent_token import RFQAgentToken
from shared.database.repositories import (
    client_dna_repository,
    client_repository,
    exporter_repository,
    freight_agent_repository,
    user_repository,
)
from shared.lambda_helpers import serialize_client, serialize_dna


def resolve_dna_and_exporter(session, quotation) -> tuple:
    """Fetch the client DNA and linked Exporter (if any) for a single quotation.

    Shared by the RFQ lambdas (create_rfq, get_rfq, dispatch_rfq) that all
    need both ORM instances to run rfq_validation/quotation_audit_engine.
    Returns (dna, exporter) — either may be None.
    """
    dna = client_dna_repository.get_by_quotation(session, quotation)
    exporter = (
        exporter_repository.get(session, quotation.exporter_id)
        if quotation.exporter_id
        else None
    )
    return dna, exporter


def batch_fetch_clients_and_dna(session, quotations) -> tuple[dict, dict]:
    """Fetch and serialize all clients and their DNA for a list of quotations.

    Returns (clients_by_id, dna_by_client_and_service_type). clients_by_id is
    keyed by client UUID; the DNA map is keyed by (client_id, service_type)
    since a client now has one DNA per operation and quotations in the same
    list can have different service_types for the same client.
    Only fetches each client once regardless of how many quotations share it.
    """
    unique_client_ids = {q.client_id for q in quotations if q.client_id}
    clients_by_id = {}
    for cid in unique_client_ids:
        client = client_repository.get(session, cid)
        if client:
            clients_by_id[cid] = serialize_client(client)

    dna_by_client_and_service_type = {}
    for q in quotations:
        if not q.client_id or q.client_id not in clients_by_id:
            continue
        key = (q.client_id, q.service_type)
        if key in dna_by_client_and_service_type:
            continue
        dna = client_dna_repository.get_by_quotation(session, q)
        dna_by_client_and_service_type[key] = serialize_dna(dna) if dna else None
    return clients_by_id, dna_by_client_and_service_type


def batch_fetch_ge_parties(session, pairs: list) -> tuple[dict, dict]:
    """Fetch client names and agent names for a GE kanban in two queries.

    Args:
        pairs: list of (Processo, Embarque) tuples from processo_repository.list_for_kanban()

    Returns:
        (clients_by_id, agents_by_id) — both keyed by UUID, values are display name strings.
    """
    unique_client_ids = list({p.client_id for p, _ in pairs})
    unique_agent_ids = list({p.agente_id for p, _ in pairs if p.agente_id})

    clients_map = client_repository.get_by_ids(session, unique_client_ids)
    agents_map = freight_agent_repository.get_by_ids(session, unique_agent_ids)

    return (
        {cid: c.name for cid, c in clients_map.items()},
        {aid: a.name for aid, a in agents_map.items()},
    )


def batch_fetch_rfq_agent_ids(session, quotation_ids: list) -> dict:
    """Return a mapping of quotation_id (str) → list of agent_id strings.

    Performs two queries regardless of the number of quotations:
    1. Fetch RFQs for the given quotation IDs.
    2. Fetch non-revoked agent tokens for those RFQs.
    """
    if not quotation_ids:
        return {}

    rfqs = session.query(RFQ).filter(RFQ.quotation_id.in_(quotation_ids)).all()
    if not rfqs:
        return {}

    rfq_id_to_quotation_id = {r.id: r.quotation_id for r in rfqs}

    tokens = (
        session.query(RFQAgentToken)
        .filter(
            RFQAgentToken.rfq_id.in_(list(rfq_id_to_quotation_id.keys())),
            RFQAgentToken.revoked_at.is_(None),
        )
        .all()
    )

    result: dict = {}
    for token in tokens:
        qid = str(rfq_id_to_quotation_id.get(token.rfq_id, ""))
        if not qid:
            continue
        if qid not in result:
            result[qid] = []
        agent_str = str(token.agent_id)
        if agent_str not in result[qid]:
            result[qid].append(agent_str)

    return result


def batch_fetch_analyst_names(session, quotations) -> dict:
    """Fetch analyst display names for a list of quotations.

    Returns analyst_names_by_id keyed by analyst UUID (as-is, not stringified).
    Only fetches each analyst once regardless of how many quotations share them.
    """
    unique_analyst_ids = {q.analyst_id for q in quotations if q.analyst_id}
    analyst_names_by_id = {}
    for aid in unique_analyst_ids:
        analyst = user_repository.get(session, aid)
        if analyst:
            analyst_names_by_id[aid] = analyst.name
    return analyst_names_by_id
