from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from shared.database.models.quotation.client import QuotationClient
from shared.database.models.quotation.enums import Modal, TipoEmbarque
from shared.database.models.quotation.freight_agent import FreightAgent
from shared.database.models.shipment.embarque import Embarque
from shared.database.models.shipment.enums import TipoDespacho
from shared.database.models.shipment.processo import Processo


def create(
    session: Session,
    *,
    client_id: uuid.UUID,
    quotation_id: Optional[uuid.UUID] = None,
    incoterm: Optional[str] = None,
    modal: Optional[Modal] = None,
    tipo_embarque: Optional[TipoEmbarque] = None,
    tipo_despacho: Optional[TipoDespacho] = None,
    carga_urgente: bool = False,
    agente_id: Optional[uuid.UUID] = None,
    containers: Optional[list] = None,
    datas: Optional[dict] = None,
    observacao: Optional[str] = None,
    inova_processo_id: Optional[str] = None,
) -> Processo:
    processo = Processo(
        client_id=client_id,
        quotation_id=quotation_id,
        incoterm=incoterm,
        modal=modal,
        tipo_embarque=tipo_embarque,
        tipo_despacho=tipo_despacho,
        carga_urgente=carga_urgente,
        agente_id=agente_id,
        containers=containers,
        datas=datas,
        observacao=observacao,
        inova_processo_id=inova_processo_id,
    )
    session.add(processo)
    session.flush()
    return processo


def get(session: Session, processo_id) -> Optional[Processo]:
    return session.get(Processo, processo_id)


def list(
    session: Session,
    *,
    client_id: Optional[uuid.UUID] = None,
    quotation_id: Optional[uuid.UUID] = None,
) -> list[Processo]:
    stmt = select(Processo)
    if client_id is not None:
        stmt = stmt.where(Processo.client_id == client_id)
    if quotation_id is not None:
        stmt = stmt.where(Processo.quotation_id == quotation_id)
    stmt = stmt.order_by(Processo.created_at.desc())
    return session.execute(stmt).scalars().all()


def list_for_kanban(
    session: Session,
    *,
    q: Optional[str] = None,
    modal: Optional[Modal] = None,
    carga_urgente: Optional[bool] = None,
) -> list[tuple["Processo", "Embarque"]]:
    """Return (processo, embarque) pairs for the GE kanban.

    Joins Processo with its Embarque so the kanban can group by estado and show
    the EMB reference without a second round-trip. Ordered by carga_urgente
    descending (urgent first) then created_at descending (newest first).

    Filters:
        q     — free-text match on EMB reference, incoterm, client name or
                agent name (case-insensitive). The ``search`` query-param alias
                is resolved into ``q`` by the lambda handler.
        modal — restrict to a single Modal.
        carga_urgente — restrict to urgent (True) or non-urgent (False) cargo.
    """
    stmt = (
        select(Processo, Embarque)
        .join(Embarque, Embarque.processo_id == Processo.id)
        .outerjoin(QuotationClient, QuotationClient.id == Processo.client_id)
        .outerjoin(FreightAgent, FreightAgent.id == Processo.agente_id)
        .order_by(Processo.carga_urgente.desc(), Processo.created_at.desc())
    )
    if q:
        search_term = f"%{q}%"
        stmt = stmt.where(
            or_(
                Embarque.reference.ilike(search_term),
                Processo.incoterm.ilike(search_term),
                QuotationClient.name.ilike(search_term),
                FreightAgent.name.ilike(search_term),
            )
        )
    if modal is not None:
        stmt = stmt.where(Processo.modal == modal)
    if carga_urgente is not None:
        stmt = stmt.where(Processo.carga_urgente.is_(carga_urgente))
    return session.execute(stmt).all()


_UPDATABLE_FIELDS = (
    "incoterm",
    "modal",
    "tipo_embarque",
    "tipo_despacho",
    "carga_urgente",
    "agente_id",
    "containers",
    "datas",
    "observacao",
    "inova_processo_id",
)


def update(session: Session, processo: Processo, **fields) -> Processo:
    for field in _UPDATABLE_FIELDS:
        if field in fields:
            setattr(processo, field, fields[field])
    processo.updated_at = datetime.now(timezone.utc)
    session.flush()
    return processo
