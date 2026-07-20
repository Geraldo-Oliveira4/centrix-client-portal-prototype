import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from shared.database.models.quotation.shipment_instruction import ShipmentInstruction
from shared.database.models.quotation.enums import SIStatus


def _generate_reference(session: Session) -> str:
    """Generate the next sequential reference in SHP-YYYY-XXXX format.

    Locks the latest row to prevent concurrent duplicates. The unique
    constraint on the reference column is the final safety net.
    """
    year = datetime.now(timezone.utc).year
    last_reference = session.execute(
        select(ShipmentInstruction.reference)
        .where(ShipmentInstruction.reference.op("~")(rf"^SHP-{year}-\d{{4}}$"))
        .order_by(ShipmentInstruction.reference.desc())
        .limit(1)
        .with_for_update()
    ).scalar()
    next_seq = int(last_reference.split("-")[-1]) + 1 if last_reference else 1
    return f"SHP-{year}-{next_seq:04d}"


def create(
    session: Session,
    *,
    quotation_id: uuid.UUID,
    proposal_id: Optional[uuid.UUID],
    created_by: str,
    exportador: Optional[dict] = None,
    consignatario: Optional[dict] = None,
    notificado: Optional[dict] = None,
    incoterm_cotado: Optional[str] = None,
    incoterm_aprovado: Optional[str] = None,
    ptax_tipo: Optional[str] = None,
    ptax_valor: Optional[Decimal] = None,
    incluir_seguro: bool = False,
    solicitar_agente_origem: bool = False,
    prontidao_prevista: Optional[date] = None,
    instrucoes_livres: Optional[str] = None,
    cc_emails: Optional[list] = None,
) -> ShipmentInstruction:
    reference = _generate_reference(session)
    si = ShipmentInstruction(
        reference=reference,
        quotation_id=quotation_id,
        proposal_id=proposal_id,
        status=SIStatus.RASCUNHO,
        exportador=exportador,
        consignatario=consignatario,
        notificado=notificado,
        incoterm_cotado=incoterm_cotado,
        incoterm_aprovado=incoterm_aprovado,
        ptax_tipo=ptax_tipo,
        ptax_valor=ptax_valor,
        incluir_seguro=incluir_seguro,
        solicitar_agente_origem=solicitar_agente_origem,
        prontidao_prevista=prontidao_prevista,
        instrucoes_livres=instrucoes_livres,
        cc_emails=cc_emails or [],
        created_by=created_by,
    )
    session.add(si)
    session.flush()
    return si


def get_by_quotation(session: Session, quotation_id) -> Optional[ShipmentInstruction]:
    """Return the most recent SI for a quotation.

    Ordered/limited rather than scalar_one_or_none() because a quotation can
    accumulate more than one row once reopening cancels a stale SI (see
    cancel() below) — the caller decides what a CANCELADA result means.
    """
    return session.execute(
        select(ShipmentInstruction)
        .where(ShipmentInstruction.quotation_id == quotation_id)
        .order_by(ShipmentInstruction.created_at.desc())
        .limit(1)
    ).scalar_one_or_none()


def get(session: Session, si_id) -> Optional[ShipmentInstruction]:
    return session.get(ShipmentInstruction, si_id)


_UPDATABLE_FIELDS = (
    "exportador", "consignatario", "notificado", "incoterm_aprovado",
    "ptax_tipo", "ptax_valor", "incluir_seguro", "solicitar_agente_origem",
    "prontidao_prevista", "instrucoes_livres", "cc_emails", "agente_origem",
)


def update(
    session: Session,
    si: ShipmentInstruction,
    *,
    exportador: Optional[dict] = None,
    consignatario: Optional[dict] = None,
    notificado: Optional[dict] = None,
    incoterm_aprovado: Optional[str] = None,
    ptax_tipo: Optional[str] = None,
    ptax_valor: Optional[Decimal] = None,
    incluir_seguro: Optional[bool] = None,
    solicitar_agente_origem: Optional[bool] = None,
    prontidao_prevista: Optional[date] = None,
    instrucoes_livres: Optional[str] = None,
    cc_emails: Optional[list] = None,
    agente_origem: Optional[str] = None,
) -> ShipmentInstruction:
    local_values = locals()
    for field in _UPDATABLE_FIELDS:
        value = local_values.get(field)
        if value is not None:
            setattr(si, field, value)
    si.updated_at = datetime.now(timezone.utc)
    session.flush()
    return si


def cancel(session: Session, si: ShipmentInstruction) -> ShipmentInstruction:
    """Mark an SI as superseded so it no longer blocks create_shipment_instruction's
    idempotency check. Used when reopening a FECHADA quotation to switch agents."""
    si.status = SIStatus.CANCELADA
    si.updated_at = datetime.now(timezone.utc)
    session.flush()
    return si


def mark_sent(session: Session, si: ShipmentInstruction, sent_by: str) -> ShipmentInstruction:
    si.status = SIStatus.ENVIADA
    si.sent_by = sent_by
    now = datetime.now(timezone.utc)
    si.sent_at = now
    si.updated_at = now
    session.flush()
    return si
