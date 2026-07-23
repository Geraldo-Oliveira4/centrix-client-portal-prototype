"""Client-scoped exporter queries for the Client Portal.

Kept apart from `exporter_repository` (the analyst catalogue, which is global and
unfiltered) so the portal can never accidentally reach a row it does not own: the
ownership predicate lives in every function here rather than at the call site.

Mirrors the anti-enumeration rule the portal applies to quotations — an exporter
belonging to another client is indistinguishable from one that does not exist.
"""

import uuid
from typing import Optional

from sqlalchemy.orm import Session

from shared.database.models.quotation.enums import ExporterCargoProfile
from shared.database.models.quotation.exporter import Exporter


def create_for_client(
    session: Session,
    client_id: uuid.UUID,
    name: str,
    endereco: Optional[str] = None,
    particularidades: Optional[str] = None,
    cargo_profile: ExporterCargoProfile = ExporterCargoProfile.GERAL,
    contact_email: Optional[str] = None,
) -> Exporter:
    """Register an exporter owned by `client_id`. Unlike the analyst
    `exporter_repository.create`, client_id is required — a portal-created
    exporter is never global.
    """
    exporter = Exporter(
        client_id=client_id,
        name=name,
        endereco=endereco,
        particularidades=particularidades,
        cargo_profile=cargo_profile,
        contact_email=contact_email,
    )
    session.add(exporter)
    session.flush()
    return exporter


def list_by_client(session: Session, client_id: uuid.UUID) -> list[Exporter]:
    """Exporters this client registered through the portal. Analyst-managed
    global rows (client_id IS NULL) are deliberately excluded: the portal only
    offers what the client entered themselves.
    """
    return list(
        session.query(Exporter)
        .filter(Exporter.client_id == client_id)
        .order_by(Exporter.name)
        .all()
    )


def get_owned(
    session: Session, exporter_id: uuid.UUID, client_id: uuid.UUID
) -> Optional[Exporter]:
    """Load an exporter only if this client owns it, else None. Used to validate
    the exporter_id a portal client attaches to a new quotation.
    """
    return (
        session.query(Exporter)
        .filter(Exporter.id == exporter_id, Exporter.client_id == client_id)
        .one_or_none()
    )


def name_exists_for_client(
    session: Session, client_id: uuid.UUID, name: str
) -> bool:
    """True when this client already registered an exporter under `name`
    (case-insensitive). The portal rejects duplicates so the selector does not
    fill up with near-identical entries the client cannot tell apart.
    """
    return (
        session.query(Exporter.id)
        .filter(Exporter.client_id == client_id, Exporter.name.ilike(name))
        .first()
        is not None
    )
