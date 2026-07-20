import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from shared.database.models.quotation.cotacao_auditoria import CotacaoAuditoria
from shared.database.models.quotation.enums import AuditAcaoTomada, AuditResultado, AuditResolucaoTipo


def create(
    session: Session,
    cotacao_id: uuid.UUID,
    momento: int,
    resultado: AuditResultado,
    acao_tomada: AuditAcaoTomada,
    divergencias: list,
    agente_carga_id: Optional[uuid.UUID] = None,
) -> CotacaoAuditoria:
    record = CotacaoAuditoria(
        cotacao_id=cotacao_id,
        momento=momento,
        agente_carga_id=agente_carga_id,
        resultado=resultado,
        divergencias=divergencias,
        acao_tomada=acao_tomada,
    )
    session.add(record)
    session.flush()
    return record


def list_by_cotacao(
    session: Session,
    cotacao_id: uuid.UUID,
    momento: Optional[int] = None,
) -> list[CotacaoAuditoria]:
    q = session.query(CotacaoAuditoria).filter(
        CotacaoAuditoria.cotacao_id == cotacao_id
    )
    if momento is not None:
        q = q.filter(CotacaoAuditoria.momento == momento)
    return q.order_by(CotacaoAuditoria.timestamp.desc()).all()


def get_latest(
    session: Session,
    cotacao_id: uuid.UUID,
    momento: int,
) -> Optional[CotacaoAuditoria]:
    return (
        session.query(CotacaoAuditoria)
        .filter(
            CotacaoAuditoria.cotacao_id == cotacao_id,
            CotacaoAuditoria.momento == momento,
        )
        .order_by(CotacaoAuditoria.timestamp.desc())
        .first()
    )


def resolve(
    session: Session,
    auditoria_id: uuid.UUID,
    resolvido_por: str,
    resolucao_tipo: AuditResolucaoTipo,
    observacao: Optional[str] = None,
) -> Optional[CotacaoAuditoria]:
    record = session.get(CotacaoAuditoria, auditoria_id)
    if record is None:
        return None
    record.resolvido_por = resolvido_por
    record.resolvido_em = datetime.now(timezone.utc)
    record.resolucao_tipo = resolucao_tipo
    if observacao is not None:
        record.observacao = observacao
    session.flush()
    return record
