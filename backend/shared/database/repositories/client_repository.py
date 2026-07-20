import uuid
from typing import Optional

from sqlalchemy import or_
from sqlalchemy.orm import Session

from shared.database.models.quotation.client import QuotationClient
from shared.database.models.quotation.client_dna import QuotationClientDna
from shared.database.models.quotation.enums import ClientTier


def create(
    session: Session,
    name: str,
    email: str,
    sector: Optional[str] = None,
    company_code: Optional[str] = None,
    tier: ClientTier = ClientTier.MANTER,
    is_vip: bool = False,
    cnpj: Optional[str] = None,
    razao_social: Optional[str] = None,
    endereco: Optional[str] = None,
    importador: Optional[str] = None,
    adquirente: Optional[str] = None,
    importacao_direta: bool = False,
) -> QuotationClient:
    client = QuotationClient(
        name=name,
        email=email,
        sector=sector,
        company_code=company_code,
        tier=tier,
        is_vip=is_vip,
        cnpj=cnpj,
        razao_social=razao_social,
        endereco=endereco,
        importador=importador,
        adquirente=adquirente,
        importacao_direta=importacao_direta,
    )
    session.add(client)
    session.flush()
    return client


def get(session: Session, client_id: uuid.UUID) -> Optional[QuotationClient]:
    return session.get(QuotationClient, client_id)


def get_by_ids(
    session: Session, client_ids: list[uuid.UUID]
) -> dict[uuid.UUID, "QuotationClient"]:
    """Batch version of `get` — fetches many clients in a single query and
    returns them keyed by id. Use in list/kanban handlers to avoid N+1
    patterns. Missing ids are simply absent from the returned dict.
    """
    if not client_ids:
        return {}
    clients = (
        session.query(QuotationClient)
        .filter(QuotationClient.id.in_(client_ids))
        .all()
    )
    return {c.id: c for c in clients}


def get_all(
    session: Session,
    tier: Optional[ClientTier] = None,
    name: Optional[str] = None,
    analyst: Optional[str] = None,
) -> list[QuotationClient]:
    query = session.query(QuotationClient)

    if analyst is not None:
        query = query.join(
            QuotationClientDna,
            QuotationClientDna.client_id == QuotationClient.id,
        ).filter(QuotationClientDna.assigned_analyst == analyst)

    if tier is not None:
        query = query.filter(QuotationClient.tier == tier)

    if name is not None:
        query = query.filter(QuotationClient.name.ilike(f"%{name}%"))

    return list(query.all())


def get_by_email(session: Session, email: str) -> Optional[QuotationClient]:
    """Look up a client by exact email match (case-insensitive)."""
    return (
        session.query(QuotationClient)
        .filter(QuotationClient.email.ilike(email.strip()))
        .first()
    )


def get_by_email_domain(session: Session, domain: str) -> list[QuotationClient]:
    """Return all clients whose email ends with @domain (case-insensitive)."""
    return list(
        session.query(QuotationClient)
        .filter(QuotationClient.email.ilike(f"%@{domain}"))
        .all()
    )


def update(
    session: Session,
    client_id: uuid.UUID,
    name: Optional[str] = None,
    email: Optional[str] = None,
    sector: Optional[str] = None,
    company_code: Optional[str] = None,
    tier: Optional[ClientTier] = None,
    is_vip: Optional[bool] = None,
    cnpj: Optional[str] = None,
    razao_social: Optional[str] = None,
    endereco: Optional[str] = None,
    importador: Optional[str] = None,
    adquirente: Optional[str] = None,
    importacao_direta: Optional[bool] = None,
) -> Optional[QuotationClient]:
    client = session.get(QuotationClient, client_id)
    if client is None:
        return None

    if name is not None:
        client.name = name
    if email is not None:
        client.email = email
    if sector is not None:
        client.sector = sector
    if company_code is not None:
        client.company_code = company_code
    if tier is not None:
        client.tier = tier
    if is_vip is not None:
        client.is_vip = is_vip
    if cnpj is not None:
        client.cnpj = cnpj
    if razao_social is not None:
        client.razao_social = razao_social
    if endereco is not None:
        client.endereco = endereco
    if importador is not None:
        client.importador = importador
    if adquirente is not None:
        client.adquirente = adquirente
    if importacao_direta is not None:
        client.importacao_direta = importacao_direta

    session.flush()
    return client


def delete(session: Session, client_id: uuid.UUID) -> bool:
    """Delete a client and its DNA (CASCADE).

    Quotations that reference this client have their client_id set to NULL
    (SET NULL FK constraint) — they are not deleted.

    Returns True if the client existed and was deleted, False if not found.
    """
    client = session.get(QuotationClient, client_id)
    if client is None:
        return False
    session.delete(client)
    session.flush()
    return True
