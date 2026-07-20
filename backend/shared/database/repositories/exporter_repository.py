import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from shared.database.models.quotation.enums import ExporterCargoProfile
from shared.database.models.quotation.exporter import Exporter


def create(
    session: Session,
    name: str,
    endereco: Optional[str] = None,
    particularidades: Optional[str] = None,
    cargo_profile: ExporterCargoProfile = ExporterCargoProfile.GERAL,
    contact_email: Optional[str] = None,
) -> Exporter:
    exporter = Exporter(
        name=name,
        endereco=endereco,
        particularidades=particularidades,
        cargo_profile=cargo_profile,
        contact_email=contact_email,
    )
    session.add(exporter)
    session.flush()
    return exporter


def get(session: Session, exporter_id: uuid.UUID) -> Optional[Exporter]:
    return session.get(Exporter, exporter_id)


def get_by_ids(
    session: Session, exporter_ids: list[uuid.UUID]
) -> dict[uuid.UUID, Exporter]:
    """Batch version of `get` — fetches many exporters in a single query and
    returns them keyed by id. Missing ids are simply absent from the dict.
    """
    if not exporter_ids:
        return {}
    exporters = (
        session.query(Exporter)
        .filter(Exporter.id.in_(exporter_ids))
        .all()
    )
    return {e.id: e for e in exporters}


def get_all(
    session: Session,
    name: Optional[str] = None,
) -> list[Exporter]:
    query = session.query(Exporter)

    if name is not None:
        query = query.filter(Exporter.name.ilike(f"%{name}%"))

    return list(query.order_by(Exporter.name).all())


def update(
    session: Session,
    exporter_id: uuid.UUID,
    name: Optional[str] = None,
    endereco: Optional[str] = None,
    particularidades: Optional[str] = None,
    cargo_profile: Optional[ExporterCargoProfile] = None,
    contact_email: Optional[str] = None,
) -> Optional[Exporter]:
    exporter = session.get(Exporter, exporter_id)
    if exporter is None:
        return None

    if name is not None:
        exporter.name = name
    if endereco is not None:
        exporter.endereco = endereco
    if particularidades is not None:
        exporter.particularidades = particularidades
    if cargo_profile is not None:
        exporter.cargo_profile = cargo_profile
    if contact_email is not None:
        exporter.contact_email = contact_email

    exporter.updated_at = datetime.now(timezone.utc)
    session.flush()
    return exporter


def delete(session: Session, exporter_id: uuid.UUID) -> bool:
    """Delete an exporter. Quotations linking to it have exporter_id set to
    NULL (SET NULL FK constraint) — they are not deleted.
    """
    exporter = session.get(Exporter, exporter_id)
    if exporter is None:
        return False
    session.delete(exporter)
    session.flush()
    return True
