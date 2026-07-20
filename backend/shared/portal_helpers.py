"""Helpers specific to the Client Portal lambdas.

Kept in a separate module from `lambda_helpers.py` so the portal-only logic
(authorization gate, slim serializers) does not bloat the shared helper file
used by every internal handler.
"""

import uuid
from typing import Any

from sqlalchemy.orm import Session

from shared.database.repositories import (
    freight_agent_repository,
    portal_user_repository,
    proposal_repository,
    proposal_score_repository,
    quotation_equipment_repository,
    quotation_repository,
    quotation_volume_repository,
)
from shared.domain.recommendation_service import normalize_proposal_cost_to_brl, resolve_comparison_ptax
from shared.lambda_helpers import (
    _coerce,
    _pick,
    build_response,
    get_user_id,
    serialize_quotation_equipment,
    serialize_quotation_volume,
)
from shared.observability import logger


# ---------------------------------------------------------------------------
# Authorization
# ---------------------------------------------------------------------------


def get_portal_client_id(
    event: dict, session: Session
) -> tuple[uuid.UUID | None, dict | None]:
    """Resolve the client_id of the authenticated portal user.

    The JWT was already validated by the API Gateway authorizer paired with
    the `cognito_portal` pool (docs/refacs/cognito-dual-pool-split.md) — only
    a token minted for a portal customer can reach this handler, so `sub` is
    trustworthy without a separate group check. We only need to look the user
    up in centrix_portal_users to fetch their client_id.

    Returns (client_id, None) on success or (None, error_response) on failure.
    Usage:
        client_id, err = get_portal_client_id(event, session)
        if err:
            return err
    """
    sub = get_user_id(event)
    if not sub:
        return None, build_response(401, {"error": "Unauthorized"})

    portal_user = portal_user_repository.get(session, sub)
    if portal_user is None:
        # Drift between Cognito pool and centrix_portal_users — investigate.
        logger.warning("Portal user with sub %s not found in DB", sub)
        return None, build_response(403, {"error": "Portal user not found"})

    return portal_user.client_id, None


def load_owned_quotation(
    session: Session, quotation_id: uuid.UUID, client_id: uuid.UUID
) -> tuple[Any | None, dict | None]:
    """Load a quotation and enforce portal ownership.

    Single home for the anti-enumeration invariant: a missing quotation and a
    quotation owned by another client both return the same 404, so a portal user
    can never probe for the existence of another client's quotations.

    Usage:
        quotation, err = load_owned_quotation(session, quotation_id, client_id)
        if err:
            return err
    """
    quotation = quotation_repository.get(session, quotation_id)
    if quotation is None or quotation.client_id != client_id:
        return None, build_response(404, {"error": "Quotation not found"})
    return quotation, None


def _is_portal_route(event: dict) -> bool:
    """True when the request arrived on a /portal/* route.

    The SI lambdas are mounted twice — once under the internal `cognito`
    authorizer/pool (domain_quotations.tf) and once under `cognito_portal`
    (domain_client_portal.tf, ARB-2449 reuse). Since each authorizer only
    accepts tokens minted by its own pool, the route path is a structural
    signal of which pool issued the caller's token — more robust than reading
    `cognito:groups`, which requires every registration path to remember to
    set the group correctly.
    """
    path = event.get("requestContext", {}).get("http", {}).get("path", "")
    return path.startswith("/portal/")


def resolve_quotation_actor(
    session: Session, event: dict, quotation_id: uuid.UUID
) -> tuple[Any | None, str | None, dict | None]:
    """Authorize an action on a quotation by either an internal analyst or the
    portal client who owns it, and load the quotation once (ARB-2449 SI reuse).

    Single gate so the shipment-instruction handlers serve both audiences without
    duplicating their business logic. Returns (quotation, actor_id, None) on
    success; (None, None, error_response) on failure:

    - Internal caller (non-/portal/ route): loaded by id, 404 if missing.
    - Portal caller (/portal/ route): must own the quotation (anti-enumeration
      404), the quotation must be portal-origin, and its guard rail must not be
      actively holding the selection (423) — the client cannot self-serve while
      Freitas is reviewing.

    The actor_id is the caller's Cognito `sub` in both cases, so it is safe to use
    for `created_by`/log attribution.
    """
    sub = get_user_id(event)
    if not sub:
        return None, None, build_response(401, {"error": "Unauthorized"})

    if not _is_portal_route(event):
        quotation = quotation_repository.get(session, quotation_id)
        if quotation is None:
            return None, None, build_response(404, {"error": "Quotation not found"})
        return quotation, sub, None

    client_id, err = get_portal_client_id(event, session)
    if err:
        return None, None, err
    quotation, err = load_owned_quotation(session, quotation_id, client_id)
    if err:
        return None, None, err
    if not quotation_repository.was_created_by_portal(session, quotation_id):
        return None, None, build_response(403, {"error": "Forbidden"})

    # Import locally to avoid a module-load cycle (guard_rail imports repositories
    # that also import this module's siblings).
    from shared.domain import guard_rail

    if guard_rail.is_active(session, quotation):
        return None, None, build_response(423, guard_rail.blocked_response_body())

    return quotation, sub, None


# ---------------------------------------------------------------------------
# Slim serializers — never leak internal fields to the customer
# ---------------------------------------------------------------------------


# Fields safe to expose to the portal user. Internal-only fields (analyst_id,
# sender_email, client_match_*, confidence_scores, priority_score) are
# deliberately omitted.
_QUOTATION_PORTAL_FIELDS = [
    "id",
    "reference",
    "state",
    "service_type",
    "modal",
    "tipo_embarque",
    "tipo_cotacao",
    "data_cotacao",
    "origin",
    "porto_embarque",
    "porto_destino",
    "aeroporto_embarque",
    "aeroporto_destino",
    "incoterm",
    "product",
    "desired_deadline",
    "data_limite_necessidade",
    "data_prontidao",
    "declared_value",
    "declared_value_currency",
    "stackability",
    "carga_tombavel",
    "insurance_required",
    "destination_yard",
    "endereco_entrega_final",
    "observations",
    "carga_perigosa",
    "un_number",
    "imo_class",
    "temperatura_min",
    "temperatura_max",
    "client_reference",
    "urgency",
    "decline_reason",
    "decline_note",
    "winning_agent_id",
    "quoted_value_usd",
    "pais_procedencia",
    "peso_taxado",
    "created_at",
    "updated_at",
]


_CLIENT_PORTAL_FIELDS = ["id", "name", "email"]


_PROPOSAL_PORTAL_FIELDS = [
    "id",
    "quotation_id",
    "agent_id",
    "total_value",
    "freight_value",
    "taxes_breakdown",
    "transit_time",
    "route_type",
    "route_detail",
    "proposal_origin",
    "proposal_destination",
    "carrier",
    "validity",
    "insurance_included",
    "incoterm",
    "is_winner",
    "received_at",
    "numero_oferta",
    "ptax_percentual",
    "prazo_pagamento_dias",
    "seguro_percentual",
    "seguro_minimo",
    "frequencia",
    "observations",
    "carga_perigosa",
    "is_recommended",
    "additional_costs",
]


def serialize_client_for_portal(client: Any) -> dict:
    """Slim client serializer — omits internal commercial metadata
    (tier, is_vip, sector, company_code) that must not leak to the customer.
    """
    return _pick(client, _CLIENT_PORTAL_FIELDS)


def serialize_proposal_for_portal(
    proposal: Any, ptax_override: float | None = None, quotation: Any | None = None
) -> dict:
    """Slim proposal serializer — omits review_*, audit_flags, extraction
    metadata, and confidence scores. Embeds {agent: {id, name}} when the
    caller has loaded `proposal.agent`.

    Does NOT include is_cheapest/is_fastest — those are derived per
    quotation and added by serialize_proposals_for_portal_with_flags.

    total_brl uses normalize_proposal_cost_to_brl (the single source of truth
    shared with the recommendation engine), converting each cost component at
    its own currency. ptax_override pins the exchange rate to the conservative
    max-PTAX for the quotation so the value is identical to what the analyst
    sees in list_proposals and get_client_quotation_view. When a `quotation`
    with ptax_negociada is provided, the effective daily BCB rate + markup
    takes precedence.
    """
    result = _pick(proposal, _PROPOSAL_PORTAL_FIELDS)
    if hasattr(proposal, "agent") and proposal.agent is not None:
        result["agent"] = {
            "id": _coerce(proposal.agent.id),
            "name": proposal.agent.name,
        }

    effective_ptax = resolve_comparison_ptax(quotation, []) if quotation is not None else None
    total_brl_ptax = effective_ptax if effective_ptax is not None else ptax_override
    result["total_brl"] = round(
        normalize_proposal_cost_to_brl(proposal, ptax_override=total_brl_ptax), 2
    )
    score = getattr(proposal, "score", None)
    result["score"] = {
        "total": _coerce(score.total_score),
        "cost": _coerce(score.cost_score),
        "transit": _coerce(score.transit_score),
        "validity": _coerce(score.validity_score),
        "frequency": _coerce(score.frequency_score),
    } if score else None
    return result


def serialize_proposals_for_portal_with_flags(
    proposals: list, quotation: Any | None = None
) -> list[dict]:
    """Serialize a list of proposals (all belonging to the same quotation)
    and tag each with is_cheapest / is_fastest flags derived at runtime.

    Uses resolve_comparison_ptax so is_cheapest and total_brl are computed
    at the same conservative exchange rate as the analyst's list and the
    recommendation engine — preventing agents from gaming the ranking by
    submitting a lower PTAX than competitors. When a negotiated PTAX markup
    is set on the quotation, the effective daily BCB rate + markup is used
    instead of the agents' submitted rates.

    BRL costs are pre-computed once per proposal to avoid redundant conversion
    during both the min() selection and the per-proposal serialization.
    """
    if not proposals:
        return []
    comparison_ptax = resolve_comparison_ptax(quotation, proposals)
    brl_costs = {
        p.id: normalize_proposal_cost_to_brl(p, ptax_override=comparison_ptax)
        for p in proposals
    }
    cheapest_id = min(proposals, key=lambda p: brl_costs[p.id]).id
    fastest_id = min(proposals, key=lambda p: p.transit_time).id
    result = []
    for p in proposals:
        item = serialize_proposal_for_portal(
            p, ptax_override=comparison_ptax, quotation=quotation
        )
        item["is_cheapest"] = p.id == cheapest_id
        item["is_fastest"] = p.id == fastest_id
        result.append(item)
    return result


def _compute_quotation_totals(volumes: list) -> dict:
    """Aggregate weight (kg), volume (m³) and quantity across volume rows.
    Returns null fields when no data is present so the frontend can hide
    the section gracefully.
    """
    weight_kg = 0.0
    volume_m3 = 0.0
    qty = 0
    for v in volumes:
        q = v.quantity or 0
        weight_kg += float(v.peso_bruto or 0)
        volume_m3 += float(v.volume_m3 or 0)
        qty += q
    return {
        "weight_kg": weight_kg if weight_kg else None,
        "volume_m3": volume_m3 if volume_m3 else None,
        "qty": qty if qty else None,
    }


def build_quotation_payload(session: Session, quotation: Any) -> dict:
    """Fetch equipment, volumes and proposals for a quotation and return
    the serialized portal payload. Used by approve_proposal and
    decline_quotation to avoid duplicating the same fetch-and-serialize block.
    """
    equipments = quotation_equipment_repository.list_by_quotation(session, quotation.id)
    volumes = quotation_volume_repository.list_by_quotation(session, quotation.id)
    proposals = proposal_repository.list_by_quotation(session, quotation.id)
    scores_by_proposal = {
        s.proposal_id: s
        for s in proposal_score_repository.list_by_quotation(session, quotation.id)
    }
    for p in proposals:
        p.agent = freight_agent_repository.get(session, p.agent_id)
        p.score = scores_by_proposal.get(p.id)
    payload = serialize_quotation_for_portal(
        quotation,
        equipments=equipments,
        volumes=volumes,
        proposals_count=len(proposals),
    )
    payload["proposals"] = serialize_proposals_for_portal_with_flags(proposals, quotation=quotation)
    return payload


# ---------------------------------------------------------------------------
# Client-facing history — a curated subset of the internal quotation log.
# The analyst timeline records internal events (analyst notes, agent-review
# reasons, user ids, link generation) that must never reach the customer. We
# expose only client-relevant milestones and strip every internal detail.
# ---------------------------------------------------------------------------

# Log actions that are meaningful to the customer.
_CLIENT_VISIBLE_ACTIONS = {
    "created",
    "extraction_complete",
    "rfq_dispatched",
    "proposal_received",
    "proposal_portal_submitted",
    "client_approved_proposal",
    "client_declined_quotation",
    "client_cancelled_quotation",
    "portal_auto_advanced",
}

# State transitions worth surfacing even when the action itself is generic.
_CLIENT_MILESTONE_STATES = {"ENVIADA_CLIENTE", "FECHADA", "DECLINADA", "CANCELADO"}

# Only these detail keys are client-safe; everything else (internal notes,
# review reasons, override justifications, ids) is dropped.
_CLIENT_HISTORY_DETAIL_KEYS = {
    "agent_name",
    "freight_value",
    "freight_currency",
    "completeness_score",
    "fields_extracted",
    "decline_reason",
    "note",
}


def _is_client_visible_log(log: Any) -> bool:
    if log.action in _CLIENT_VISIBLE_ACTIONS:
        return True
    return log.new_state in _CLIENT_MILESTONE_STATES


def serialize_client_history(logs: list) -> list[dict]:
    """Filter and slim the internal quotation log for the portal timeline.

    Keeps only client-relevant milestones, strips the user id and every
    internal detail key. Never leaks analyst notes or review reasons.
    """
    items = []
    for log in logs:
        if not _is_client_visible_log(log):
            continue
        raw_details = log.details or {}
        details = {
            k: v for k, v in raw_details.items() if k in _CLIENT_HISTORY_DETAIL_KEYS
        }
        items.append({
            "id": str(log.id),
            "action": log.action,
            "previous_state": log.previous_state,
            "new_state": log.new_state,
            "details": details or None,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        })
    return items


def serialize_quotation_for_portal(
    quotation: Any,
    best_proposal: Any | None = None,
    proposals_count: int | None = None,
    equipments: list | None = None,
    volumes: list | None = None,
    ptax_override: float | None = None,
) -> dict:
    """Slim quotation serializer for the portal. Fields not in
    _QUOTATION_PORTAL_FIELDS are intentionally absent so we never leak
    analyst metadata, extraction confidence, or client-matching internals.

    `best_proposal` (optional): the proposal to highlight on the list card
    (typically the lowest-priced one). When provided, embeds the slim
    proposal under "best_proposal".

    `proposals_count` (optional): number of proposals attached to the
    quotation, used by the card ("3 propostas").

    `ptax_override` (optional): passed through to serialize_proposal_for_portal
    so the best_proposal card shows the same BRL total as the detail view.
    """
    result = _pick(quotation, _QUOTATION_PORTAL_FIELDS)
    if best_proposal is not None:
        result["best_proposal"] = serialize_proposal_for_portal(
            best_proposal, ptax_override=ptax_override, quotation=quotation
        )
    if proposals_count is not None:
        result["proposals_count"] = proposals_count
    if equipments is not None:
        result["equipments"] = [serialize_quotation_equipment(e) for e in equipments]
    if volumes is not None:
        result["volumes"] = [serialize_quotation_volume(v) for v in volumes]
        result["totals"] = _compute_quotation_totals(volumes)
    return result
