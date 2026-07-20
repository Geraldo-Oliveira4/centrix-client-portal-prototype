import uuid
from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from shared.database.models.quotation.client import QuotationClient
from shared.database.models.quotation.enums import (
    CargaPerigosa,
    Currency,
    DimensaoUnidade,
    ExtractionStatus,
    GuardRailDecision,
    Modal,
    PesoUnidade,
    PriceOrPerformance,
    QuotationState,
    ServiceType,
    TipoContainer,
    TipoCotacao,
    TipoEmbalagem,
    TipoEmbarque,
)
from shared.database.models.quotation.proposal import Proposal
from shared.database.models.quotation.quotation import Quotation
from shared.database.models.quotation.quotation_equipment import QuotationEquipment
from shared.database.models.quotation.quotation_log import QuotationLog
from shared.database.models.quotation.quotation_volume import QuotationVolume
from shared.database.repositories import quotation_equipment_repository, quotation_volume_repository

# Audit-log action recorded for quotations opened through the client portal
# self-service flow. Re-exported by shared.domain.quotation_creation — lives
# here (not there) so this module doesn't have to import the domain layer
# just to filter on it.
ACTION_QUOTATION_CREATED_BY_PORTAL = "quotation_created_by_portal"

# Fields strictly required before entering COTANDO state (RF-COT-025).
# Imported by quotation_state_machine to avoid duplicate definitions.
COTANDO_REQUIRED_FIELDS = [
    "origin",
    "incoterm",
    "insurance_required",
    "product",
    "stackability",
    "declared_value",
]

# Full set used for the UX completeness percentage — includes non-blocking fields.
_COMPLETENESS_FIELDS = ["client_id"] + COTANDO_REQUIRED_FIELDS + [
    "service_type",
    "modal",
    "desired_deadline",
]

# Higher value = higher complexity = higher urgency
_INCOTERM_PRIORITY_WEIGHT = {
    "DDP": 40,
    "DAP": 35,
    "CIF": 30,
    "CFR": 25,
    "FOB": 20,
    "FCA": 15,
    "EXW": 10,
}

# Divisors to convert L×W×H (in source unit) to m³.
# 1 cm³ = 1e-6 m³, 1 mm³ = 1e-9 m³, 1 in³ ≈ 1.639e-5 m³
_DIM_TO_M3_DIVISOR: dict[str, float] = {
    "CM": 1_000_000,
    "MM": 1_000_000_000,
    "M": 1,
    "POL": 61_023.7,
}


def _generate_reference(session: Session) -> str:
    """Generate the next sequential reference in COT-YYYY-XXXX format.

    Locks the latest row to prevent concurrent duplicates. The unique
    constraint on the reference column is the final safety net.
    """
    year = datetime.now(timezone.utc).year
    last_reference = session.execute(
        select(Quotation.reference)
        .where(Quotation.reference.op("~")(rf"^COT-{year}-\d{{4}}$"))
        .order_by(Quotation.reference.desc())
        .limit(1)
        .with_for_update()
    ).scalar()
    next_seq = int(last_reference.split("-")[-1]) + 1 if last_reference else 1
    return f"COT-{year}-{next_seq:04d}"


def calculate_completeness(quotation: Quotation) -> float:
    """Return completeness percentage (0–100) based on the mandatory fields.

    Fields required for COTANDO: client_id, origin, incoterm, insurance_required,
    product, stackability, declared_value.
    """
    applicable = list(_COMPLETENESS_FIELDS)
    if quotation.agente_define_local_coleta:
        applicable = [f for f in applicable if f != "origin"]
    # When the sender is a known freight agent contact (not an importer), client_id
    # will never be set because agents are not in the clients table. Exempting it
    # prevents these quotations from being permanently stuck in AGUARDANDO_DADOS.
    if quotation.client_match_status == "agent_matched":
        applicable = [f for f in applicable if f != "client_id"]
    filled = sum(
        1 for field in applicable if getattr(quotation, field, None) is not None
    )
    return round((filled / len(applicable)) * 100, 2) if applicable else 0.0


def calculate_priority_score(quotation: Quotation, is_vip: bool = False) -> float:
    """Deterministic priority score (0–100) per RF-COT-007.

    Components:
    - Incoterm complexity:      up to 40 pts
    - Critical client (is_vip): 30 pts
    - Completeness ratio:       up to 30 pts
    """
    incoterm_pts = _INCOTERM_PRIORITY_WEIGHT.get((quotation.incoterm or "").upper(), 0)
    vip_pts = 30 if is_vip else 0
    completeness_pts = calculate_completeness(quotation) * 0.30
    return min(round(incoterm_pts + vip_pts + completeness_pts, 2), 100.0)


def create(
    session: Session,
    analyst_id: str,
    service_type: Optional[ServiceType] = None,
    modal: Optional[Modal] = None,
    tipo_embarque: Optional[TipoEmbarque] = None,
    tipo_cotacao: Optional[TipoCotacao] = None,
    data_cotacao=None,
    origin: Optional[str] = None,
    porto_embarque: Optional[str] = None,
    porto_destino: Optional[list[str]] = None,
    aeroporto_embarque: Optional[str] = None,
    aeroporto_destino: Optional[list[str]] = None,
    incluir_entrega_destino_final: Optional[bool] = None,
    incoterm: Optional[str] = None,
    product: Optional[str] = None,
    desired_deadline=None,
    data_limite_necessidade=None,
    data_prontidao=None,
    declared_value: Optional[float] = None,
    declared_value_currency: Optional[Currency] = None,
    stackability: Optional[bool] = None,
    carga_tombavel: Optional[bool] = None,
    insurance_required: Optional[bool] = None,
    destination_yard: Optional[str] = None,
    endereco_entrega_final: Optional[str] = None,
    necessidade_descarga: Optional[bool] = None,
    ncm: Optional[str] = None,
    exportador: Optional[str] = None,
    pais_procedencia: Optional[str] = None,
    peso_taxado: Optional[float] = None,
    observations: Optional[str] = None,
    carga_perigosa: Optional[CargaPerigosa] = None,
    un_number: Optional[str] = None,
    imo_class: Optional[str] = None,
    temperatura_min: Optional[float] = None,
    temperatura_max: Optional[float] = None,
    client_reference: Optional[str] = None,
    agente_define_porto_embarque: Optional[bool] = None,
    agente_define_porto_destino: Optional[bool] = None,
    agente_define_aeroporto_embarque: Optional[bool] = None,
    agente_define_aeroporto_destino: Optional[bool] = None,
    agente_define_local_coleta: Optional[bool] = None,
    ptax_negociada: Optional[str] = None,
    price_or_performance: Optional[PriceOrPerformance] = None,
    client_id: Optional[uuid.UUID] = None,
    original_email_s3_key: Optional[str] = None,
    attachments_s3_keys: Optional[dict] = None,
    is_vip: bool = False,
) -> Quotation:
    reference = _generate_reference(session)
    quotation = Quotation(
        reference=reference,
        state=QuotationState.TRIAGEM_IA,
        analyst_id=analyst_id,
        service_type=service_type,
        modal=modal,
        tipo_embarque=tipo_embarque,
        tipo_cotacao=tipo_cotacao,
        data_cotacao=data_cotacao,
        origin=origin,
        porto_embarque=porto_embarque,
        porto_destino=porto_destino,
        aeroporto_embarque=aeroporto_embarque,
        aeroporto_destino=aeroporto_destino,
        agente_define_porto_embarque=agente_define_porto_embarque,
        agente_define_porto_destino=agente_define_porto_destino,
        agente_define_aeroporto_embarque=agente_define_aeroporto_embarque,
        agente_define_aeroporto_destino=agente_define_aeroporto_destino,
        agente_define_local_coleta=agente_define_local_coleta,
        ptax_negociada=ptax_negociada,
        price_or_performance=price_or_performance,
        incluir_entrega_destino_final=incluir_entrega_destino_final,
        incoterm=incoterm,
        product=product,
        desired_deadline=desired_deadline,
        data_limite_necessidade=data_limite_necessidade,
        data_prontidao=data_prontidao,
        declared_value=declared_value,
        declared_value_currency=declared_value_currency,
        stackability=stackability,
        carga_tombavel=carga_tombavel,
        insurance_required=insurance_required,
        destination_yard=destination_yard,
        endereco_entrega_final=endereco_entrega_final,
        necessidade_descarga=necessidade_descarga,
        ncm=ncm,
        exportador=exportador,
        pais_procedencia=pais_procedencia,
        peso_taxado=peso_taxado,
        observations=observations,
        carga_perigosa=carga_perigosa,
        un_number=un_number,
        imo_class=imo_class,
        temperatura_min=temperatura_min,
        temperatura_max=temperatura_max,
        client_reference=client_reference,
        client_id=client_id,
        original_email_s3_key=original_email_s3_key,
        attachments_s3_keys=attachments_s3_keys or {},
    )
    quotation.completeness_score = calculate_completeness(quotation)
    quotation.priority_score = calculate_priority_score(quotation, is_vip=is_vip)
    session.add(quotation)
    session.flush()
    return quotation


def get(
    session: Session,
    quotation_id: uuid.UUID,
    *,
    for_update: bool = False,
) -> Optional[Quotation]:
    if for_update:
        return session.execute(
            select(Quotation).where(Quotation.id == quotation_id).with_for_update()
        ).scalar_one_or_none()
    return session.get(Quotation, quotation_id)


def get_by_reference(session: Session, reference: str) -> Optional[Quotation]:
    """Look up a quotation by its human-readable reference (e.g. COT-2026-0042)."""
    return session.execute(
        select(Quotation).where(Quotation.reference == reference)
    ).scalar_one_or_none()


def update_s3_keys(
    session: Session,
    quotation_id: uuid.UUID,
    original_email_s3_key: Optional[str] = None,
    attachments_s3_keys: Optional[dict] = None,
) -> Optional[Quotation]:
    quotation = session.get(Quotation, quotation_id)
    if quotation is None:
        return None
    if original_email_s3_key is not None:
        quotation.original_email_s3_key = original_email_s3_key
    if attachments_s3_keys is not None:
        quotation.attachments_s3_keys = attachments_s3_keys
    quotation.updated_at = datetime.now(timezone.utc)
    session.flush()
    return quotation


def update_extraction(
    session: Session,
    quotation_id: uuid.UUID,
    extracted_fields: dict,
    confidence_scores: dict,
    extraction_model: str,
    is_vip: bool = False,
) -> Optional[Quotation]:
    """Apply AI-extracted fields to a quotation and recalculate scores."""
    quotation = session.get(Quotation, quotation_id)
    if quotation is None:
        return None

    field_setters = {
        "origin": str,
        "incoterm": str,
        "product": str,
        "client_reference": str,
        "exportador": str,
        "pais_procedencia": str,
        "un_number": str,
        "imo_class": str,
        "porto_embarque": str,
        "porto_destino": lambda v: [v] if isinstance(v, str) else (v if isinstance(v, list) else None),
        "aeroporto_embarque": str,
        "aeroporto_destino": lambda v: [v] if isinstance(v, str) else (v if isinstance(v, list) else None),
        "declared_value": float,
        "temperatura_min": float,
        "temperatura_max": float,
        "stackability": bool,
        "carga_tombavel": bool,
    }

    for field_name, cast_fn in field_setters.items():
        value = extracted_fields.get(field_name)
        if value is not None:
            setattr(quotation, field_name, cast_fn(value))

    # Enum conversions
    modal_value = extracted_fields.get("modal")
    if modal_value:
        try:
            quotation.modal = Modal(modal_value)
        except ValueError:
            pass

    service_type_value = extracted_fields.get("service_type")
    if service_type_value:
        try:
            quotation.service_type = ServiceType(service_type_value)
        except ValueError:
            pass

    tipo_embarque_value = extracted_fields.get("tipo_embarque")
    if tipo_embarque_value:
        try:
            quotation.tipo_embarque = TipoEmbarque(tipo_embarque_value)
        except ValueError:
            pass

    carga_perigosa_value = extracted_fields.get("carga_perigosa")
    if carga_perigosa_value:
        try:
            quotation.carga_perigosa = CargaPerigosa(carga_perigosa_value)
        except ValueError:
            pass

    declared_value_currency_value = extracted_fields.get("declared_value_currency")
    if declared_value_currency_value:
        try:
            quotation.declared_value_currency = Currency(declared_value_currency_value)
        except ValueError:
            pass

    # Date/datetime conversions
    deadline_value = extracted_fields.get("desired_deadline")
    if deadline_value:
        try:
            d = date.fromisoformat(deadline_value)
            quotation.desired_deadline = datetime(
                d.year, d.month, d.day, tzinfo=timezone.utc
            )
        except ValueError:
            pass

    prontidao_value = extracted_fields.get("data_prontidao")
    if prontidao_value:
        try:
            quotation.data_prontidao = date.fromisoformat(prontidao_value)
        except ValueError:
            pass

    volumes_data = extracted_fields.get("volumes")
    if volumes_data and isinstance(volumes_data, list):
        for vol in volumes_data:
            raw_quantity = vol.get("quantity")
            quantity = int(raw_quantity) if isinstance(raw_quantity, (int, float)) and raw_quantity >= 1 else 1
            peso_bruto = vol.get("peso_bruto")
            comprimento = vol.get("comprimento")
            largura = vol.get("largura")
            altura = vol.get("altura")
            dim_unit_str = (vol.get("dimensao_unidade") or "CM").upper()
            embalagem_str = vol.get("embalagem")
            volume_m3 = vol.get("volume_m3")  # use AI value if provided

            # Resolve DimensaoUnidade enum
            try:
                dim_unit = DimensaoUnidade(dim_unit_str)
            except ValueError:
                dim_unit = DimensaoUnidade.CM

            # Calculate volume_m3 from dimensions when the AI did not provide it
            if volume_m3 is None and comprimento and largura and altura:
                divisor = _DIM_TO_M3_DIVISOR.get(dim_unit_str, _DIM_TO_M3_DIVISOR["CM"])
                volume_m3 = (comprimento * largura * altura) / divisor

            if peso_bruto and comprimento and largura and altura:
                embalagem = None
                if embalagem_str:
                    try:
                        normalized = embalagem_str.upper().replace(" ", "_").replace("-", "_")
                        embalagem = TipoEmbalagem(normalized)
                    except ValueError:
                        pass
                quotation_volume_repository.create(
                    session,
                    quotation_id=quotation_id,
                    quantity=quantity,
                    embalagem=embalagem,
                    peso_bruto=peso_bruto,
                    peso_unidade=PesoUnidade.KG,
                    comprimento=comprimento,
                    largura=largura,
                    altura=altura,
                    dimensao_unidade=dim_unit,
                    volume_m3=volume_m3,
                )

    equipments_data = extracted_fields.get("equipments")
    if equipments_data and isinstance(equipments_data, list):
        for eq in equipments_data:
            quantity = eq.get("quantity")
            tipo_container_str = eq.get("tipo_container")
            peso_bruto = eq.get("peso_bruto")
            volume_m3 = eq.get("volume_m3")

            if quantity and tipo_container_str:
                tipo_container = None
                try:
                    normalized = tipo_container_str.upper().replace(" ", "_").replace("-", "_")
                    tipo_container = TipoContainer(normalized)
                except ValueError:
                    pass
                if tipo_container:
                    quotation_equipment_repository.create(
                        session,
                        quotation_id=quotation_id,
                        quantity=quantity,
                        tipo_container=tipo_container,
                        peso_bruto=peso_bruto,
                        volume_m3=volume_m3,
                    )

    quotation.confidence_scores = confidence_scores
    quotation.extraction_status = ExtractionStatus.COMPLETED
    quotation.extraction_model = extraction_model
    quotation.extracted_at = datetime.now(timezone.utc)
    quotation.completeness_score = calculate_completeness(quotation)
    quotation.priority_score = calculate_priority_score(quotation, is_vip=is_vip)
    quotation.updated_at = datetime.now(timezone.utc)

    session.flush()
    return quotation


def get_all(
    session: Session,
    state: Optional[QuotationState] = None,
    client_id: Optional[uuid.UUID] = None,
    analyst_id: Optional[str] = None,
    priority_min: Optional[float] = None,
    search: Optional[str] = None,
) -> list[Quotation]:


    stmt = select(Quotation)

    if search is not None:
        stmt = stmt.outerjoin(
            QuotationClient, QuotationClient.id == Quotation.client_id
        )
    if state is not None:
        stmt = stmt.where(Quotation.state == state)
    if client_id is not None:
        stmt = stmt.where(Quotation.client_id == client_id)
    if analyst_id is not None:
        stmt = stmt.where(Quotation.analyst_id == analyst_id)
    if priority_min is not None:
        stmt = stmt.where(Quotation.priority_score >= priority_min)
    if search is not None:
        stmt = stmt.where(
            or_(
                Quotation.reference.ilike(f"%{search}%"),
                Quotation.origin.ilike(f"%{search}%"),
                QuotationClient.name.ilike(f"%{search}%"),
            )
        )

    # COALESCE makes nulls sort last on both PostgreSQL and SQLite
    priority_order = func.coalesce(Quotation.priority_score, 0).desc()
    stmt = stmt.order_by(priority_order, Quotation.created_at.desc())
    return list(session.execute(stmt).scalars().all())


def get_kanban(
    session: Session, search: Optional[str] = None
) -> dict[str, list[tuple[Quotation, int]]]:
    """Return quotations grouped by state with proposal counts, each column ordered by priority descending.

    Args:
        search: Optional search term to filter by reference or client_reference (case-insensitive, partial match).

    Returns:
        Dict mapping state value to list of tuples (quotation, proposal_count).
    """


    # Subquery to count latest proposals per quotation.
    # Only is_latest=True rows are counted so the kanban number matches
    # what the analyst sees in the proposal detail view (which also filters
    # by is_latest). Superseded versions (older submissions from the same
    # agent) must not inflate the displayed count.
    proposal_count_subq = (
        select(
            Proposal.quotation_id.label("quotation_id"),
            func.count(Proposal.id).label("proposal_count"),
        )
        .where(Proposal.is_latest == True)
        .group_by(Proposal.quotation_id)
        .subquery()
    )

    # Main query with left join to include quotations with 0 proposals
    stmt = (
        select(
            Quotation,
            func.coalesce(proposal_count_subq.c.proposal_count, 0).label("proposal_count"),
        )
        .outerjoin(
            proposal_count_subq,
            Quotation.id == proposal_count_subq.c.quotation_id,
        )
    )

    if search:
        search_term = f"%{search}%"
        stmt = stmt.where(
            or_(
                Quotation.reference.ilike(search_term),
                Quotation.client_reference.ilike(search_term),
            )
        )

    stmt = stmt.order_by(func.coalesce(Quotation.priority_score, 0).desc())

    results = session.execute(stmt).all()

    kanban: dict[str, list[tuple[Quotation, int]]] = {
        state.value: [] for state in QuotationState
    }
    for quotation, proposal_count in results:
        kanban[quotation.state.value].append((quotation, proposal_count))

    return kanban


def get_reminder_sent_token_ids(
    session: Session, quotation_ids: list[uuid.UUID]
) -> dict[uuid.UUID, set[str]]:
    """Return a map of quotation_id → set of token_ids that already received a reminder.

    Single query instead of one get_logs call per quotation — avoids N+1 in the reminder batch.
    """
    if not quotation_ids:
        return {}
    rows = session.execute(
        select(QuotationLog.quotation_id, QuotationLog.details).where(
            QuotationLog.quotation_id.in_(quotation_ids),
            QuotationLog.action == "rfq_reminder_sent",
            QuotationLog.details.isnot(None),
        )
    ).all()
    result: dict[uuid.UUID, set[str]] = {}
    for quotation_id, details in rows:
        token_id = details.get("token_id")
        if token_id:
            result.setdefault(quotation_id, set()).add(token_id)
    return result


def get_active_with_deadline_in_window(
    session: Session,
    states: set[QuotationState],
    window_start: datetime,
    window_end: datetime,
) -> list[Quotation]:
    """Return active quotations whose desired_deadline falls within [window_start, window_end]."""
    return list(
        session.execute(
            select(Quotation).where(
                Quotation.state.in_(states),
                Quotation.desired_deadline.isnot(None),
                Quotation.desired_deadline >= window_start,
                Quotation.desired_deadline <= window_end,
            )
        )
        .scalars()
        .all()
    )


def batch_fetch_portal_approved(session: Session, quotation_ids: list[uuid.UUID]) -> set[uuid.UUID]:
    """Return the subset of quotation_ids that have a client_approved_proposal log entry."""
    if not quotation_ids:
        return set()
    result = session.execute(
        select(QuotationLog.quotation_id).distinct()
        .where(QuotationLog.quotation_id.in_(quotation_ids))
        .where(QuotationLog.action == 'client_approved_proposal')
    ).scalars().all()
    return set(result)


def batch_fetch_created_by_portal(
    session: Session, quotation_ids: list[uuid.UUID], user_id: Optional[str] = None
) -> set[uuid.UUID]:
    """Return the subset of quotation_ids created through the portal.

    When user_id is given, narrows further to quotations created by that
    specific portal user (used by list_my_quotations for "created_by_me").
    """
    if not quotation_ids:
        return set()
    query = (
        select(QuotationLog.quotation_id).distinct()
        .where(QuotationLog.quotation_id.in_(quotation_ids))
        .where(QuotationLog.action == ACTION_QUOTATION_CREATED_BY_PORTAL)
    )
    if user_id is not None:
        query = query.where(QuotationLog.user_id == user_id)
    result = session.execute(query).scalars().all()
    return set(result)


def was_created_by_portal(session: Session, quotation_id: uuid.UUID) -> bool:
    """Return True when the quotation was created through the client portal.

    Single-quotation counterpart of batch_fetch_created_by_portal, used by the
    portal auto-advance to restrict itself to portal-origin quotations.
    """
    return bool(batch_fetch_created_by_portal(session, [quotation_id]))


def batch_fetch_state_transition_dates(
    session: Session,
    quotation_ids: list[uuid.UUID],
    new_states: list[str],
) -> dict[uuid.UUID, dict[str, datetime]]:
    """Return the most recent transition timestamp into each of `new_states`.

    Reads the immutable audit log (`centrix_quotation_logs`) and, for every
    quotation, records the latest `created_at` of the transition into each
    requested target state. A quotation can enter (e.g.) ENVIADA_CLIENTE more
    than once across its lifecycle, so the newest occurrence is authoritative.

    This is a FALLBACK only: the durable `sent_at`/`closed_at`/`declined_at`
    columns on the quotation are the source of truth (stamped by the state
    machine). The log-derived value is used to fill a column that is null —
    e.g. pre-existing rows whose transition predates the columns, or any
    transition that bypassed the stamp.

    Returns a dict mapping quotation_id -> {new_state: datetime}. Only states
    that actually occurred appear in the inner dict.
    """
    if not quotation_ids or not new_states:
        return {}

    rows = session.execute(
        select(
            QuotationLog.quotation_id,
            QuotationLog.new_state,
            func.max(QuotationLog.created_at),
        )
        .where(QuotationLog.quotation_id.in_(quotation_ids))
        .where(QuotationLog.new_state.in_(new_states))
        .group_by(QuotationLog.quotation_id, QuotationLog.new_state)
    ).all()

    dates_by_quotation: dict[uuid.UUID, dict[str, datetime]] = {}
    for quotation_id, new_state, transitioned_at in rows:
        dates_by_quotation.setdefault(quotation_id, {})[new_state] = transitioned_at
    return dates_by_quotation


def count_by_client(session: Session, client_id: uuid.UUID) -> int:
    """Return the total number of quotations linked to a client (any state)."""
    return session.query(Quotation).filter(Quotation.client_id == client_id).count()


def count_by_exporter(session: Session, exporter_id: uuid.UUID) -> int:
    """Return the total number of quotations linked to an exporter (any state)."""
    return session.query(Quotation).filter(Quotation.exporter_id == exporter_id).count()


def get_logs(session: Session, quotation_id: uuid.UUID) -> list[QuotationLog]:
    return list(
        session.execute(
            select(QuotationLog)
            .where(QuotationLog.quotation_id == quotation_id)
            .order_by(QuotationLog.created_at.asc())
        )
        .scalars()
        .all()
    )


def append_log(
    session: Session,
    quotation_id: uuid.UUID,
    action: str,
    user_id: str,
    previous_state: Optional[str] = None,
    new_state: Optional[str] = None,
    details: Optional[dict] = None,
) -> QuotationLog:
    """Append an immutable audit entry. Never UPDATE or DELETE QuotationLog rows."""
    log = QuotationLog(
        quotation_id=quotation_id,
        action=action,
        user_id=user_id,
        previous_state=previous_state,
        new_state=new_state,
        details=details,
    )
    session.add(log)
    session.flush()
    return log


def set_guard_rail_decision(
    session: Session,
    quotation: Quotation,
    decision: GuardRailDecision,
    reviewed_by: str,
    block_reason: Optional[str] = None,
) -> Quotation:
    """Persist the analyst's guard-rail decision (ARB-2449).

    Records the actor and a timestamp for the history. RELEASED clears any prior
    block reason; BLOCKED stores the mandatory justification. The block also moves
    the quotation from APROVADA_PELO_CLIENTE back to ENVIADA_CLIENTE (handled by
    the block handler); this call only touches the decision columns.
    """
    quotation.guard_rail_decision = decision
    quotation.guard_rail_block_reason = (
        block_reason if decision == GuardRailDecision.BLOCKED else None
    )
    quotation.guard_rail_reviewed_by = reviewed_by
    quotation.guard_rail_reviewed_at = datetime.now(timezone.utc)
    session.flush()
    return quotation


def reset_guard_rail_decision(session: Session, quotation: Quotation) -> Quotation:
    """Return the guard rail to a pending (unreviewed) state (ARB-2449).

    Called when the client (re)approves a proposal: any prior analyst decision and
    block reason are cleared so the fresh selection is reviewed from scratch in
    APROVADA_PELO_CLIENTE. Reviewer/timestamp are cleared too — the pending review
    has no actor yet.
    """
    quotation.guard_rail_decision = None
    quotation.guard_rail_block_reason = None
    quotation.guard_rail_reviewed_by = None
    quotation.guard_rail_reviewed_at = None
    session.flush()
    return quotation


def _copy_list(value: Optional[list]) -> Optional[list]:
    """Defensive copy of a JSONB list column, preserving None."""
    return list(value) if value else None


def duplicate(
    session: Session,
    source_id: uuid.UUID,
    analyst_id: str,
    recotacao_motivo: Optional[str] = None,
    modal: Optional[Modal] = None,
) -> Optional[Quotation]:
    """Clone a quotation and its cargo records into a new TRIAGEM_IA quotation.

    Copies all configuration fields (client, route, cargo specs, agent preferences)
    but resets state, scores, extraction metadata, and S3 references. Sets
    originated_from_id to track lineage.

    Args:
        source_id: UUID of the quotation to clone.
        analyst_id: Cognito sub of the requesting analyst.
        recotacao_motivo: Optional free-text reason (used for re-cotacao flow).
        modal: Optional modal override. If provided and different from source,
               modal-specific scalar fields (porto/aeroporto) are reset. Cargo
               records are cloned by compatibility with the target modal:
               volumes carry over between AEREO and MARITIMO (LCL); equipments
               (containers) only exist in MARITIMO (FCL) and are dropped when
               the target modal is AEREO.

    Returns:
        The newly created Quotation, or None if the source was not found.
    """
    source = session.get(Quotation, source_id)
    if source is None:
        return None

    # Determine effective modal
    effective_modal = modal if modal is not None else source.modal
    modal_changed = modal is not None and modal != source.modal

    reference = _generate_reference(session)

    # Base fields always copied
    clone = Quotation(
        reference=reference,
        state=QuotationState.TRIAGEM_IA,
        analyst_id=analyst_id,
        service_type=source.service_type,
        modal=effective_modal,
        tipo_cotacao=source.tipo_cotacao,
        data_cotacao=source.data_cotacao,
        origin=source.origin,
        incluir_entrega_destino_final=source.incluir_entrega_destino_final,
        incoterm=source.incoterm,
        product=source.product,
        desired_deadline=source.desired_deadline,
        data_limite_necessidade=source.data_limite_necessidade,
        data_prontidao=source.data_prontidao,
        declared_value=source.declared_value,
        declared_value_currency=source.declared_value_currency,
        stackability=source.stackability,
        carga_tombavel=source.carga_tombavel,
        insurance_required=source.insurance_required,
        endereco_entrega_final=source.endereco_entrega_final,
        necessidade_descarga=source.necessidade_descarga,
        ncm=source.ncm,
        exportador=source.exportador,
        pais_procedencia=source.pais_procedencia,
        peso_taxado=source.peso_taxado,
        observations=source.observations,
        carga_perigosa=source.carga_perigosa,
        un_number=source.un_number,
        imo_class=source.imo_class,
        temperatura_min=source.temperatura_min,
        temperatura_max=source.temperatura_max,
        client_reference=source.client_reference,
        agente_define_porto_embarque=source.agente_define_porto_embarque,
        agente_define_porto_destino=source.agente_define_porto_destino,
        agente_define_aeroporto_embarque=source.agente_define_aeroporto_embarque,
        agente_define_aeroporto_destino=source.agente_define_aeroporto_destino,
        agente_define_local_coleta=source.agente_define_local_coleta,
        ptax_negociada=source.ptax_negociada,
        price_or_performance=source.price_or_performance,
        client_id=source.client_id,
        originated_from_id=source_id,
        recotacao_motivo=recotacao_motivo,
    )

    # Handle modal-specific fields
    if modal_changed:
        if effective_modal == Modal.AEREO:
            # Was MARITIMO, now AEREO: clear maritime-specific fields
            clone.tipo_embarque = None
            clone.porto_embarque = None
            clone.porto_destino = None
            clone.destination_yard = None
            # Keep air fields
            clone.aeroporto_embarque = source.aeroporto_embarque
            clone.aeroporto_destino = _copy_list(source.aeroporto_destino)
        elif effective_modal == Modal.MARITIMO:
            # Was AEREO, now MARITIMO: clear air-specific fields
            clone.aeroporto_embarque = None
            clone.aeroporto_destino = None
            # Keep maritime fields
            clone.tipo_embarque = source.tipo_embarque
            clone.porto_embarque = source.porto_embarque
            clone.porto_destino = _copy_list(source.porto_destino)
            clone.destination_yard = source.destination_yard
    else:
        # Same modal: preserve all modal-specific fields
        clone.tipo_embarque = source.tipo_embarque
        clone.porto_embarque = source.porto_embarque
        clone.porto_destino = _copy_list(source.porto_destino)
        clone.aeroporto_embarque = source.aeroporto_embarque
        clone.aeroporto_destino = _copy_list(source.aeroporto_destino)
        clone.destination_yard = source.destination_yard

    clone.completeness_score = calculate_completeness(clone)
    clone.priority_score = calculate_priority_score(clone)
    session.add(clone)
    session.flush()

    # Clone cargo records by compatibility with the effective modal, not by
    # "modal changed at all". Volumes are the cargo representation shared by
    # AEREO and MARITIMO (LCL), so they always carry over. Equipments
    # (containers) only exist in MARITIMO (FCL); they are dropped whenever the
    # target modal is AEREO, since air freight has no container concept.
    #
    # Cargo is fetched through the repositories: Quotation has no ORM
    # relationship to its equipments/volumes, so attribute access on `source`
    # would never return the records.
    if effective_modal == Modal.MARITIMO:
        for eq in quotation_equipment_repository.list_by_quotation(session, source_id):
            session.add(QuotationEquipment(
                quotation_id=clone.id,
                quantity=eq.quantity,
                tipo_container=eq.tipo_container,
                volume_m3=eq.volume_m3,
                peso_bruto=eq.peso_bruto,
                peso_unidade=eq.peso_unidade,
            ))

    for vol in quotation_volume_repository.list_by_quotation(session, source_id):
        session.add(QuotationVolume(
            quotation_id=clone.id,
            quantity=vol.quantity,
            embalagem=vol.embalagem,
            peso_bruto=vol.peso_bruto,
            peso_unidade=vol.peso_unidade,
            comprimento=vol.comprimento,
            largura=vol.largura,
            altura=vol.altura,
            dimensao_unidade=vol.dimensao_unidade,
            volume_m3=vol.volume_m3,
            inspecao_iof=vol.inspecao_iof,
        ))

    session.flush()
    return clone
