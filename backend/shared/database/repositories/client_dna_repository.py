import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from shared.database.models.quotation.client_dna import QuotationClientDna
from shared.database.models.quotation.enums import (
    InsuranceResponsibility,
    LogisticsType,
    Modal,
    PriceOrPerformance,
    ServiceType,
    TipoEmbarque,
)


def create(
    session: Session,
    client_id: uuid.UUID,
    service_type: ServiceType = ServiceType.IMPORTACAO,
    modality: Optional[Modal] = None,
    tipo_embarque: Optional[TipoEmbarque] = None,
    logistics_type: Optional[LogisticsType] = None,
    default_agents: Optional[dict] = None,
    destination_yard: Optional[str] = None,
    insurance_responsibility: Optional[InsuranceResponsibility] = None,
    quotation_particularities: Optional[str] = None,
    dangerous_cargo_shipper: Optional[bool] = None,
    price_or_performance: Optional[PriceOrPerformance] = None,
    cargo_profile: Optional[str] = None,
    contact_name: Optional[str] = None,
    contact_email: Optional[str] = None,
    assigned_analyst: Optional[str] = None,
    exige_oea: Optional[bool] = None,
    preferred_embarque_local: Optional[str] = None,
    anvisa_restrictions: Optional[dict] = None,
    destination_yard_aereo: Optional[str] = None,
    destination_yard_maritimo_fcl: Optional[str] = None,
    destination_yard_maritimo_lcl: Optional[str] = None,
) -> QuotationClientDna:
    dna = QuotationClientDna(
        client_id=client_id,
        service_type=service_type,
        modality=modality,
        tipo_embarque=tipo_embarque,
        logistics_type=logistics_type,
        default_agents=default_agents,
        destination_yard=destination_yard,
        insurance_responsibility=insurance_responsibility,
        quotation_particularities=quotation_particularities,
        dangerous_cargo_shipper=dangerous_cargo_shipper,
        price_or_performance=price_or_performance,
        cargo_profile=cargo_profile,
        contact_name=contact_name,
        contact_email=contact_email,
        assigned_analyst=assigned_analyst,
        exige_oea=exige_oea,
        preferred_embarque_local=preferred_embarque_local,
        anvisa_restrictions=anvisa_restrictions,
        destination_yard_aereo=destination_yard_aereo,
        destination_yard_maritimo_fcl=destination_yard_maritimo_fcl,
        destination_yard_maritimo_lcl=destination_yard_maritimo_lcl,
        updated_at=datetime.now(timezone.utc),
    )
    session.add(dna)
    session.flush()
    return dna


def get_by_client(
    session: Session,
    client_id: uuid.UUID,
    service_type: Optional[ServiceType] = None,
) -> Optional[QuotationClientDna]:
    """Return the client's DNA for the given operation.

    service_type falls back to IMPORTACAO so callers without an operation
    context (or quotations with a null service_type) keep resolving a DNA.
    """
    return (
        session.query(QuotationClientDna)
        .filter(
            QuotationClientDna.client_id == client_id,
            QuotationClientDna.service_type == (service_type or ServiceType.IMPORTACAO),
        )
        .first()
    )


def get_by_quotation(session: Session, quotation) -> Optional[QuotationClientDna]:
    """Return the client's DNA for a quotation's client and operation.

    Centralizes the client_id-guard + service_type resolution repeated across
    lambdas that need the DNA in quotation context (audit, RFQ, autofill).
    Returns None when the quotation isn't linked to a client yet.
    """
    if not quotation.client_id:
        return None
    return get_by_client(session, quotation.client_id, quotation.service_type)


def get_all_by_client(session: Session, client_id: uuid.UUID) -> list[QuotationClientDna]:
    """Return every DNA (one per operation) for a client, ordered by service_type."""
    return (
        session.query(QuotationClientDna)
        .filter(QuotationClientDna.client_id == client_id)
        .order_by(QuotationClientDna.service_type)
        .all()
    )


def update(
    session: Session,
    client_id: uuid.UUID,
    service_type: ServiceType = ServiceType.IMPORTACAO,
    modality: Optional[Modal] = None,
    tipo_embarque: Optional[TipoEmbarque] = None,
    logistics_type: Optional[LogisticsType] = None,
    default_agents: Optional[dict] = None,
    destination_yard: Optional[str] = None,
    insurance_responsibility: Optional[InsuranceResponsibility] = None,
    quotation_particularities: Optional[str] = None,
    dangerous_cargo_shipper: Optional[bool] = None,
    price_or_performance: Optional[PriceOrPerformance] = None,
    cargo_profile: Optional[str] = None,
    contact_name: Optional[str] = None,
    contact_email: Optional[str] = None,
    assigned_analyst: Optional[str] = None,
    exige_oea: Optional[bool] = None,
    preferred_embarque_local: Optional[str] = None,
    anvisa_restrictions: Optional[dict] = None,
    destination_yard_aereo: Optional[str] = None,
    destination_yard_maritimo_fcl: Optional[str] = None,
    destination_yard_maritimo_lcl: Optional[str] = None,
) -> Optional[QuotationClientDna]:
    dna = (
        session.query(QuotationClientDna)
        .filter(
            QuotationClientDna.client_id == client_id,
            QuotationClientDna.service_type == service_type,
        )
        .first()
    )
    if dna is None:
        return None

    if modality is not None:
        dna.modality = modality
    if tipo_embarque is not None:
        dna.tipo_embarque = tipo_embarque
    if logistics_type is not None:
        dna.logistics_type = logistics_type
    if default_agents is not None:
        dna.default_agents = default_agents
    if destination_yard is not None:
        dna.destination_yard = destination_yard
    if insurance_responsibility is not None:
        dna.insurance_responsibility = insurance_responsibility
    if quotation_particularities is not None:
        dna.quotation_particularities = quotation_particularities
    if dangerous_cargo_shipper is not None:
        dna.dangerous_cargo_shipper = dangerous_cargo_shipper
    if price_or_performance is not None:
        dna.price_or_performance = price_or_performance
    if cargo_profile is not None:
        dna.cargo_profile = cargo_profile
    if contact_name is not None:
        dna.contact_name = contact_name
    if contact_email is not None:
        dna.contact_email = contact_email
    if assigned_analyst is not None:
        dna.assigned_analyst = assigned_analyst
    if exige_oea is not None:
        dna.exige_oea = exige_oea
    if preferred_embarque_local is not None:
        dna.preferred_embarque_local = preferred_embarque_local
    if anvisa_restrictions is not None:
        dna.anvisa_restrictions = anvisa_restrictions
    if destination_yard_aereo is not None:
        dna.destination_yard_aereo = destination_yard_aereo
    if destination_yard_maritimo_fcl is not None:
        dna.destination_yard_maritimo_fcl = destination_yard_maritimo_fcl
    if destination_yard_maritimo_lcl is not None:
        dna.destination_yard_maritimo_lcl = destination_yard_maritimo_lcl

    dna.updated_at = datetime.now(timezone.utc)
    session.flush()
    return dna


def upsert(
    session: Session,
    client_id: uuid.UUID,
    service_type: ServiceType,
    **fields,
) -> QuotationClientDna:
    """Update the client's DNA for an operation, creating it if it doesn't exist.

    Used by the single-client PUT so editing an operation that was never
    populated (e.g. a client created before the split) just creates it.
    """
    dna = update(session, client_id, service_type, **fields)
    if dna is None:
        dna = create(session, client_id, service_type, **fields)
    return dna


def bulk_update(
    session: Session,
    client_ids: list[uuid.UUID],
    service_types: list[ServiceType],
    **fields,
) -> dict:
    """Apply the same partial DNA update to many clients and operations at once.

    Reuses update() per (client, service_type), so the None-means-do-not-touch
    semantics match the single-client PUT. A (client, operation) pair without an
    existing DNA record is skipped and reported instead of being created.

    Each pair runs in its own SAVEPOINT: an unexpected error (e.g. a data issue
    specific to one client) rolls back only that pair and is reported in
    `failed`, instead of aborting every update already applied in the same
    request — the caller otherwise has no way to tell how many of N clients
    actually got the update when something fails mid-batch.
    """
    updated: list[dict] = []
    skipped: list[dict] = []
    failed: list[dict] = []
    for client_id in client_ids:
        for service_type in service_types:
            entry = {"client_id": client_id, "service_type": service_type}
            try:
                with session.begin_nested():
                    dna = update(session, client_id, service_type, **fields)
            except Exception as e:
                failed.append({**entry, "error": str(e)})
                continue
            (updated if dna is not None else skipped).append(entry)
    return {"updated": updated, "skipped": skipped, "failed": failed}
