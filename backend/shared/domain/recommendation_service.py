"""Recommendation service — scoring engine for freight agent proposals.

Layer 1 (V1): cross-check requested vs offered.

Nota IA v2 (ARB-2478, Victor Orsi 07/07 — client contractual liability for
quotation errors motivated a more robust, fully-local model): a single
unified weight set now applies to every quotation. price_or_performance no
longer selects a preset — see WEIGHT_PRESETS docstring.

Scoring criteria (all weighted):
    cost (28%), transit time (22%), route/connections (18%),
    frequency (14%), free time (10%), validity (8%)

Validity is now a weighted criterion, not an eliminatory pre-filter, EXCEPT
for the expired case which remains a hard exclusion (an expired proposal is
not commercially usable, not merely risky):
    - expired (0 business days remaining): excluded from comparativo entirely
    - at risk / ok: scored via validity_score — closer to expiry scores lower,
      naturally deprioritized by the weighted formula instead of hard-blocked

Validity thresholds — used only to classify validade_status (ok/em_risco) for
display, not for scoring — (calibrated with Orsi, 2026-05-25):
    - Maritime (MARITIMO): VALIDITY_RISK_THRESHOLD_MARITIME = 7 business days
    - Air (AEREO): VALIDITY_RISK_THRESHOLD_AIR = 3 business days
    - Unknown modal: defaults to maritime (stricter threshold)

Frequency scale (calibrated 2026-05-27):
    - Diária    = 100 — daily service; best possible schedule reliability
    - Semanal   =  80 — weekly or N-times-per-week (covers "1 a 2 vezes por semana",
                        "4 voos por semana", etc.)
    - Quinzenal =  50 — bi-weekly
    - Mensal    =  25 — monthly
    - Sem info  =   0 — unknown / not provided

Route scale (calibrated 07/2026, ARB-2478): the client only distinguishes direct
vs. transshipment routes today (route_type — no connection-count field exists),
so this is a coarse proxy for "quanto menos conexoes, menor risco":
    - DIRETA     = 100 — no transshipment
    - TRANSBORDO =  40 — materially riskier (delay, rollover, missed connection
                         window, extra cost) but not worthless
    - Not informed =  0 — same "missing info is penalized" convention as frequency

Free time and validity are range-normalized (like cost/transit) across the
proposals being compared — more days remaining is better, missing data is
treated as 0 days (worst case), matching the frequency/route convention.

PTAX normalization (2026-05-27):
    All proposals in a comparison are converted to BRL using a single reference PTAX
    equal to the maximum ptax_percentual among eligible proposals (or _FALLBACK_PTAX
    when none is provided). This prevents an agent from appearing cheaper by submitting
    a lower exchange rate than competitors.
"""

import unicodedata
import uuid
from collections import Counter
from dataclasses import dataclass
from datetime import date
from typing import Optional

from sqlalchemy.orm import Session

from shared.database.models.quotation.enums import RouteType, Severity
from shared.observability import logger
from shared.database.models.quotation.freight_agent import FreightAgent
from shared.database.models.quotation.proposal import Proposal
from shared.database.models.quotation.proposal_score import ProposalScore
from shared.database.models.quotation.recommendation_override import RecommendationOverride
from shared.database.repositories import (
    audit_flag_repository,
    freight_agent_repository,
    proposal_repository,
    proposal_score_repository,
    quotation_repository,
    recommendation_override_repository,
)
from shared.domain.currency_utils import (
    _FALLBACK_PTAX,
    apply_ptax_markup,
    normalize_to_brl,
    parse_negotiated_ptax_percent,
)
from shared.lambda_helpers import UNKNOWN_AGENT_NAME, resolve_agent_name
from shared.services import bacen_ptax_service

_BLOCK_SEVERITIES = {Severity.HIGH, Severity.CRITICAL}

# Business days thresholds for "at risk" validity (calibrated with Orsi, 2026-05-25).
# Maritime needs a longer lead time for logistics re-routing.
VALIDITY_RISK_THRESHOLD_MARITIME = 7
VALIDITY_RISK_THRESHOLD_AIR = 3

WEIGHT_PRESETS: dict[str, dict[str, float]] = {
    # Unified model (Victor Orsi, 07/07, ARB-2478) — replaces the previous
    # preco/prazo/default split by quotation.price_or_performance. The two new
    # criteria (route, free_time) and the validity-as-weighted-criterion change
    # do not vary by price/performance intent, so a single weight set now
    # applies to every quotation. price_or_performance stays on the client
    # DNA/quotation record for RFQ display purposes (rfq_validation.py) but no
    # longer affects recommendation scoring.
    "default": {
        "cost": 0.28,
        "transit": 0.22,
        "route": 0.18,
        "frequency": 0.14,
        "free_time": 0.10,
        "validity": 0.08,
    },
}

VALIDADE_OK = "ok"
VALIDADE_EM_RISCO = "em_risco"
VALIDADE_EXPIRADA = "expirada"


@dataclass
class RecommendationResult:
    scores: list[ProposalScore]
    validade_status_by_proposal: dict[uuid.UUID, str]
    frequency_score_by_proposal: dict[uuid.UUID, float]
    recommended_proposal_id: Optional[uuid.UUID]
    recommendation_text: Optional[str]
    override: Optional[RecommendationOverride]
    is_overridden: bool


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

def normalize_proposal_cost_to_brl(proposal: Proposal, ptax_override: float | None = None) -> float:
    """Convert the full proposal cost to BRL by summing each component at its own currency.

    Uses individual freight_value + taxes_breakdown components so mixed-currency
    proposals (e.g. freight in USD, local fees in BRL) are compared accurately.
    Proposals with no freight_currency default to USD (standard for international freight).

    ptax_override: when provided, overrides each proposal's own ptax_percentual.
    Pass this from calculate_and_persist so all proposals in a comparison use the
    same exchange rate, preventing agents from gaming the cost ranking by submitting
    a lower PTAX than competitors.
    """
    if ptax_override is not None:
        ptax = ptax_override
    else:
        ptax = float(proposal.ptax_percentual) if proposal.ptax_percentual else None
    fc = (proposal.freight_currency or "USD").upper()

    total_brl = normalize_to_brl(float(proposal.freight_value), fc, ptax)

    taxes = proposal.taxes_breakdown or {}
    currency_map = proposal.taxes_currency_breakdown or {}
    for key, value in taxes.items():
        tax_currency = (currency_map.get(key) or fc).upper()
        total_brl += normalize_to_brl(float(value), tax_currency, ptax)

    return total_brl


def compute_comparison_ptax(proposals: list[Proposal]) -> float | None:
    """Return the reference USD/BRL PTAX for a set of proposals.

    Uses the maximum submitted PTAX so no agent can appear artificially cheaper
    by quoting a lower exchange rate than competitors — every proposal's USD
    components are converted at the most conservative (highest) rate seen in the
    quotation. Returns None when no proposal submitted a PTAX (callers then fall
    back to the per-currency default inside normalize_to_brl).

    Single source of truth shared by the recommendation engine, the analyst
    proposals list, and the client portal view so the BRL total is identical
    everywhere.
    """
    submitted_ptaxes = [
        float(p.ptax_percentual) for p in proposals if p.ptax_percentual is not None
    ]
    return max(submitted_ptaxes) if submitted_ptaxes else None


def _resolve_negotiated_ptax(quotation) -> float | None:
    """Return the effective USD/BRL PTAX when the quotation has a negotiated markup.

    Composition: BCB PTAX of the day + the percentage recorded in
    quotation.ptax_negociada (e.g. "1%"). Falls back to _FALLBACK_PTAX when the
    BCB API is unreachable so the conversion never silently drops to 1:1.
    """
    if quotation is None:
        return None
    raw = getattr(quotation, "ptax_negociada", None)
    percent = parse_negotiated_ptax_percent(raw)
    if percent is None:
        return None

    daily = bacen_ptax_service.get_daily_ptax("USD")
    if daily is None:
        logger.warning(
            "BCB PTAX unavailable; using fallback for negotiated rate",
            extra={"ptax_negociada": raw},
        )
        daily = _FALLBACK_PTAX

    return apply_ptax_markup(daily, percent)


def resolve_comparison_ptax(quotation, proposals: list[Proposal]) -> float | None:
    """Return the single reference PTAX to use for a quotation.

    When the analyst recorded a negotiated PTAX markup, the effective rate
    (daily PTAX + markup) overrides the agents' submitted rates so every
    proposal is compared on the same basis. Otherwise, fall back to the
    highest PTAX submitted by agents.
    """
    negotiated = _resolve_negotiated_ptax(quotation)
    if negotiated is not None:
        return negotiated
    return compute_comparison_ptax(proposals)


def _linear_normalize(value: float, low: float, high: float, invert: bool = False) -> float:
    """Map value from [low, high] to [0, 100]. invert=True means lower is better."""
    if high == low:
        return 100.0
    normalized = (value - low) / (high - low) * 100.0
    return (100.0 - normalized) if invert else normalized


def _business_days_remaining(validity: date) -> int:
    """Count business days (Mon–Fri) from today up to validity date, exclusive of today."""
    today = date.today()
    if validity <= today:
        return 0
    count = 0
    current = today
    while current < validity:
        current = date.fromordinal(current.toordinal() + 1)
        if current.weekday() < 5:
            count += 1
    return count


def _compute_validity_status(proposal: Proposal, threshold: int) -> str:
    """Classify proposal validity as ok / em_risco / expirada.

    threshold: minimum business days remaining before a proposal is flagged at-risk.
    Use VALIDITY_RISK_THRESHOLD_MARITIME (7) or VALIDITY_RISK_THRESHOLD_AIR (3).
    """
    if not proposal.validity:
        # No date provided: treat as at-risk (cannot confirm validity window).
        return VALIDADE_EM_RISCO
    days = _business_days_remaining(proposal.validity)
    if days == 0:
        return VALIDADE_EXPIRADA
    if days < threshold:
        return VALIDADE_EM_RISCO
    return VALIDADE_OK


def _normalize_text(text: str) -> str:
    """Lowercase and strip diacritical marks for accent-insensitive keyword matching."""
    return "".join(
        c for c in unicodedata.normalize("NFD", text.lower())
        if unicodedata.category(c) != "Mn"
    )


def _parse_frequency_score(frequencia: Optional[str]) -> float:
    """Convert free-text frequency to a 0–100 score.

    Scale (calibrated 2026-05-27):
        Diária  = 100  — daily sailings/flights; best possible frequency
        Semanal =  80  — weekly or N-times-per-week (e.g. "1 a 2 vezes por semana",
                         "4 voos por semana"); covers any text containing "seman"
        Quinzenal = 50 — bi-weekly
        Mensal  =  25  — monthly
        Sem info =   0 — unknown / not provided

    Text is lowercased and stripped of accents before matching so "Diária",
    "diária", and "diario" all hit the "diari" branch. "diari" must be checked
    before "seman" because the order controls the priority.
    """
    if not frequencia or not frequencia.strip():
        return 0.0
    text = _normalize_text(frequencia)
    if "diari" in text:  # diaria, diario, diariamente (accent-normalized)
        return 100.0
    if "seman" in text:
        return 80.0
    if "quizen" in text or "quinzen" in text or "15" in text:
        return 50.0
    if "mens" in text or "30" in text:
        return 25.0
    return 0.0


def _scoring_weights() -> dict[str, float]:
    """Return the unified scoring weights (ARB-2478, Victor Orsi 07/07).

    price_or_performance no longer selects a variant preset — see the
    WEIGHT_PRESETS docstring.
    """
    return WEIGHT_PRESETS["default"]


def _parse_route_score(route_type: Optional[RouteType]) -> float:
    """Convert route_type to a 0-100 score. See module docstring for the scale."""
    if route_type == RouteType.DIRETA:
        return 100.0
    if route_type == RouteType.TRANSBORDO:
        return 40.0
    return 0.0


def _resolve_free_time_days(proposal: Proposal) -> float:
    """Free time in days, or 0 when not declared (missing info is penalized)."""
    return float(proposal.free_time_dias) if proposal.free_time_dias is not None else 0.0


def _validity_days_for_scoring(proposal: Proposal) -> int:
    """Business days remaining, used as the raw input to the weighted validity
    criterion. Missing validity is treated as 0 (worst case), matching the
    free_time/frequency 'missing info is penalized' convention.
    """
    if not proposal.validity:
        return 0
    return _business_days_remaining(proposal.validity)


def _build_recommendation_text(
    proposal: Proposal,
    agent: FreightAgent,
    score: ProposalScore,
    quotation,
) -> str:
    currency = proposal.freight_currency or "BRL"
    total = float(proposal.total_value)
    transit = proposal.transit_time
    total_s = f"{currency} {total:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

    validity_info = ""
    if proposal.validity:
        validity_info = f", válida até {proposal.validity.strftime('%d/%m/%Y')}"

    freq = float(score.frequency_score) if score.frequency_score is not None else 0.0
    route = float(score.route_score) if score.route_score is not None else 0.0
    free_time = float(score.free_time_score) if score.free_time_score is not None else 0.0
    validity = float(score.validity_score) if score.validity_score is not None else 0.0

    return (
        f"Esta rota oferece o melhor custo-benefício com frete total de "
        f"{total_s} e transit time de {transit} dias{validity_info}.\n\n"
        f"Pontuação geral: {float(score.total_score):.0f}/100 "
        f"(custo: {float(score.cost_score):.0f}, "
        f"prazo: {float(score.transit_score):.0f}, "
        f"rota: {route:.0f}, "
        f"frequência: {freq:.0f}, "
        f"free time: {free_time:.0f}, "
        f"validade: {validity:.0f}).\n\n"
        f"Critérios usados: preço, transit time, rota/conexões, frequência de embarques, "
        f"free time e validade da cotação.\n"
        f"Agente de cargas: {agent.name}."
    )


def _compute_scores(
    scoreable: list,
    eligibility: dict,
    bounds: dict[str, tuple[float, float]],
    weights: dict[str, float],
    validade_status_by_proposal: dict[uuid.UUID, str],
    comparison_ptax: float | None = None,
) -> list[dict]:
    """Return score dicts ready for DB persistence, including all weighted criteria.

    bounds: {"cost": (min, max), "transit": (min, max), "free_time": (min, max),
             "validity": (min, max)} across eligible proposals — see
             _compute_score_bounds. Route and frequency use a fixed 0-100 scale
             instead (see module docstring), so they are not part of bounds.

    comparison_ptax: single exchange rate used for all proposals; prevents agents from
    appearing cheaper by submitting a lower PTAX than competitors.
    """
    cost_min, cost_max = bounds["cost"]
    transit_min, transit_max = bounds["transit"]
    free_time_min, free_time_max = bounds["free_time"]
    validity_min, validity_max = bounds["validity"]

    score_dicts: list[dict] = []

    for p in scoreable:
        is_eligible, ineligibility_reason = eligibility[p.id]
        frequency_score = _parse_frequency_score(p.frequencia)
        route_score = _parse_route_score(p.route_type)
        validade_status = validade_status_by_proposal[p.id]

        if not is_eligible:
            score_dicts.append({
                "proposal_id": p.id,
                "is_eligible": False,
                "ineligibility_reason": ineligibility_reason,
                "cost_score": None,
                "transit_score": None,
                "validity_score": None,
                "frequency_score": round(frequency_score, 2),
                "route_score": round(route_score, 2),
                "free_time_score": None,
                "total_score": None,
                "validade_status": validade_status,
                "posicao_ranking": None,
                "motivo": None,
            })
            continue

        cost_brl = normalize_proposal_cost_to_brl(p, ptax_override=comparison_ptax)
        cost_score = _linear_normalize(cost_brl, cost_min, cost_max, invert=True)
        transit_score = _linear_normalize(
            float(p.transit_time), float(transit_min), float(transit_max), invert=True
        )
        free_time_score = _linear_normalize(
            _resolve_free_time_days(p), free_time_min, free_time_max, invert=False
        )
        validity_score = _linear_normalize(
            float(_validity_days_for_scoring(p)), float(validity_min), float(validity_max), invert=False
        )
        total_score = (
            weights["cost"] * cost_score
            + weights["transit"] * transit_score
            + weights["route"] * route_score
            + weights["frequency"] * frequency_score
            + weights["free_time"] * free_time_score
            + weights["validity"] * validity_score
        )

        score_dicts.append({
            "proposal_id": p.id,
            "is_eligible": True,
            "ineligibility_reason": None,
            "cost_score": round(cost_score, 2),
            "transit_score": round(transit_score, 2),
            "validity_score": round(validity_score, 2),
            "frequency_score": round(frequency_score, 2),
            "route_score": round(route_score, 2),
            "free_time_score": round(free_time_score, 2),
            "total_score": round(total_score, 2),
            "validade_status": validade_status,
            "posicao_ranking": None,  # filled by _add_rankings
            "motivo": None,           # filled by _add_rankings
        })

    return score_dicts


def _rank_map(eligible: list[dict], key: str) -> dict:
    """Map proposal_id -> 1-based rank by the given score key (higher score = better rank)."""
    ordered = sorted(eligible, key=lambda d: d[key] or 0.0, reverse=True)
    return {d["proposal_id"]: i + 1 for i, d in enumerate(ordered)}


def _add_rankings(score_dicts: list[dict]) -> None:
    """Compute overall and per-criterion rankings. Mutates score_dicts in place."""
    eligible = [d for d in score_dicts if d["is_eligible"] and d["total_score"] is not None]
    if not eligible:
        return

    by_total = sorted(eligible, key=lambda d: d["total_score"], reverse=True)
    for rank, d in enumerate(by_total, 1):
        d["posicao_ranking"] = rank

    cost_rank = _rank_map(eligible, "cost_score")
    transit_rank = _rank_map(eligible, "transit_score")
    route_rank = _rank_map(eligible, "route_score")
    freq_rank = _rank_map(eligible, "frequency_score")
    free_time_rank = _rank_map(eligible, "free_time_score")
    validity_rank = _rank_map(eligible, "validity_score")

    for d in eligible:
        pid = d["proposal_id"]
        d["motivo"] = (
            f"Custo: {cost_rank[pid]}º lugar | "
            f"Prazo: {transit_rank[pid]}º lugar | "
            f"Rota: {route_rank[pid]}º lugar | "
            f"Frequência: {freq_rank[pid]}º lugar | "
            f"Free Time: {free_time_rank[pid]}º lugar | "
            f"Validade: {validity_rank[pid]}º lugar"
        )


# ---------------------------------------------------------------------------
# Private helpers (continued)
# ---------------------------------------------------------------------------

def _resolve_effective_recommendation(
    override,
    best_proposal_id: Optional[uuid.UUID],
    best_text: Optional[str],
    scoreable: list,
    agents_by_id: dict,
    scores_by_proposal: dict,
    quotation,
) -> tuple[Optional[uuid.UUID], Optional[str], bool]:
    """Apply an operator override on top of the algorithmic recommendation.

    Returns (effective_proposal_id, effective_text, is_overridden).
    When no override is active, returns the algorithmic best unchanged.
    """
    if not (override and override.proposal_id):
        return best_proposal_id, best_text, False

    override_proposal = next(
        (p for p in scoreable if p.id == override.proposal_id), None
    )
    override_agent = agents_by_id.get(override_proposal.agent_id) if override_proposal else None
    override_score = scores_by_proposal.get(override.proposal_id)

    if override_proposal and override_agent and override_score:
        text = _build_recommendation_text(override_proposal, override_agent, override_score, quotation)
    else:
        text = (
            f"Recomendacao manual: agente {override.agent_name}.\n"
            f"Justificativa: {override.justification}"
        )

    return override.proposal_id, text, True


def _classify_validity(latest: list, validity_threshold: int) -> dict:
    """Map each proposal id to its validity status (OK / em risco / expirada)."""
    return {p.id: _compute_validity_status(p, validity_threshold) for p in latest}


def _resolve_eligibility(session: Session, scoreable: list) -> dict:
    """Map each scoreable proposal id to (is_eligible, reason).

    Unresolved HIGH/CRITICAL audit flags make a proposal ineligible for recommendation.
    """
    eligibility: dict[uuid.UUID, tuple[bool, Optional[str]]] = {}
    for p in scoreable:
        flags = audit_flag_repository.list_by_proposal(session, p.id)
        blocking = [f for f in flags if f.severity in _BLOCK_SEVERITIES and not f.resolved]
        if blocking:
            rule_names = ", ".join(f.rule_name for f in blocking[:3])
            eligibility[p.id] = (False, f"Flags nao resolvidas de severidade alta/critica: {rule_names}")
        else:
            eligibility[p.id] = (True, None)
    return eligibility


def _compute_score_bounds(
    eligible_proposals: list, comparison_ptax: float | None
) -> dict[str, tuple[float, float]]:
    """Return {"cost", "transit", "free_time", "validity"} -> (min, max) across
    eligible proposals — the range each is normalized against in _compute_scores.

    Route and frequency are excluded: they use a fixed 0-100 scale (see module
    docstring), not range-normalization.
    """
    def _bounds(values: list) -> tuple[float, float]:
        return (min(values), max(values)) if values else (0.0, 0.0)

    costs = [normalize_proposal_cost_to_brl(p, ptax_override=comparison_ptax) for p in eligible_proposals]
    transits = [p.transit_time for p in eligible_proposals]
    free_times = [_resolve_free_time_days(p) for p in eligible_proposals]
    validities = [_validity_days_for_scoring(p) for p in eligible_proposals]

    return {
        "cost": _bounds(costs),
        "transit": _bounds(transits),
        "free_time": _bounds(free_times),
        "validity": _bounds(validities),
    }


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def calculate_and_persist(session: Session, quotation_id: uuid.UUID) -> RecommendationResult:
    """Calculate scores for all latest proposals, persist them, and return the result."""
    quotation = quotation_repository.get(session, quotation_id)
    if quotation is None:
        return RecommendationResult(
            scores=[],
            validade_status_by_proposal={},
            frequency_score_by_proposal={},
            recommended_proposal_id=None,
            recommendation_text=None,
            override=None,
            is_overridden=False,
        )

    weights = _scoring_weights()

    # Validity threshold depends on modal: maritime needs a longer lead time.
    modal_val = quotation.modal
    if modal_val is not None:
        is_maritime = modal_val.value.upper() == "MARITIMO"
    else:
        is_maritime = True  # unknown modal → stricter (maritime) threshold
    validity_threshold = (
        VALIDITY_RISK_THRESHOLD_MARITIME if is_maritime else VALIDITY_RISK_THRESHOLD_AIR
    )

    # list_by_quotation defaults to latest_only=True — only is_latest=True rows
    # are returned; no secondary Python filter needed.
    latest = proposal_repository.list_by_quotation(session, quotation_id)

    # Detect data integrity violations — more than one is_latest per agent signals
    # a missed supersede. Warn loudly so the anomaly is visible in CloudWatch.
    agent_counts = Counter(p.agent_id for p in latest)
    duplicates = {str(k): v for k, v in agent_counts.items() if v > 1}
    if duplicates:
        logger.warning(
            "duplicate_is_latest_proposals_detected",
            extra={"quotation_id": str(quotation_id), "duplicates": duplicates},
        )

    agents_by_id: dict[uuid.UUID, FreightAgent] = {}
    for p in latest:
        if p.agent_id not in agents_by_id:
            agent = freight_agent_repository.get(session, p.agent_id)
            if agent:
                agents_by_id[p.agent_id] = agent

    # Step 1: validity pre-filter — expired proposals are excluded from scoring entirely
    validade_status_by_proposal = _classify_validity(latest, validity_threshold)
    scoreable = [p for p in latest if validade_status_by_proposal[p.id] != VALIDADE_EXPIRADA]

    # Step 2: audit-flag eligibility — unresolved HIGH/CRITICAL flags block recommendation
    eligibility = _resolve_eligibility(session, scoreable)
    eligible_proposals = [p for p in scoreable if eligibility[p.id][0]]

    # Single reference PTAX across eligible proposals so no agent appears artificially
    # cheaper by submitting a lower exchange rate than competitors. When the analyst
    # set a negotiated PTAX markup, use the daily BCB rate + markup instead.
    comparison_ptax: float | None = resolve_comparison_ptax(quotation, eligible_proposals)

    bounds = _compute_score_bounds(eligible_proposals, comparison_ptax)

    # Step 3: compute weighted scores (all 6 criteria, including validity)
    score_dicts = _compute_scores(
        scoreable, eligibility,
        bounds,
        weights, validade_status_by_proposal,
        comparison_ptax=comparison_ptax,
    )
    _add_rankings(score_dicts)

    persisted = proposal_score_repository.upsert_for_quotation(
        session, quotation_id, score_dicts
    )

    scores_by_proposal: dict[uuid.UUID, ProposalScore] = {
        s.proposal_id: s for s in persisted
    }

    # Step 4: find recommended proposal — must be eligible (audit-flag block).
    # Validity is no longer a hard gate here: it is weighted into total_score
    # (validity_score), so an at-risk proposal is naturally deprioritized
    # rather than excluded outright. Expired proposals never reach `persisted`
    # at all (excluded from `scoreable` upstream).
    best_proposal_id: Optional[uuid.UUID] = None
    best_score = -1.0
    for s in persisted:
        if not s.is_eligible or s.total_score is None:
            continue
        ts = float(s.total_score)
        if ts > best_score:
            best_score = ts
            best_proposal_id = s.proposal_id

    recommendation_text: Optional[str] = None
    if best_proposal_id is not None:
        best_proposal = next((p for p in scoreable if p.id == best_proposal_id), None)
        best_agent = agents_by_id.get(best_proposal.agent_id) if best_proposal else None
        best_score_row = scores_by_proposal.get(best_proposal_id)
        if best_proposal and best_agent and best_score_row:
            recommendation_text = _build_recommendation_text(
                best_proposal, best_agent, best_score_row, quotation
            )

    override = recommendation_override_repository.get_latest(session, quotation_id)

    effective_proposal_id, effective_text, is_overridden = _resolve_effective_recommendation(
        override=override,
        best_proposal_id=best_proposal_id,
        best_text=recommendation_text,
        scoreable=scoreable,
        agents_by_id=agents_by_id,
        scores_by_proposal=scores_by_proposal,
        quotation=quotation,
    )

    # Build in-memory dicts for backward compatibility with RecommendationResult consumers.
    frequency_score_by_proposal: dict[uuid.UUID, float] = {
        s.proposal_id: float(s.frequency_score) if s.frequency_score is not None else 0.0
        for s in persisted
    }

    return RecommendationResult(
        scores=persisted,
        validade_status_by_proposal=validade_status_by_proposal,
        frequency_score_by_proposal=frequency_score_by_proposal,
        recommended_proposal_id=effective_proposal_id,
        recommendation_text=effective_text,
        override=override,
        is_overridden=is_overridden,
    )


def trigger_if_enough_proposals(quotation_id: uuid.UUID, logger) -> None:
    """Auto-trigger scoring when enough proposals exist for comparison.

    Runs in a separate DB session so failure never aborts the caller's
    transaction. Non-blocking — logs a WARNING on failure and returns.

    Called by every proposal-creation path after its primary session closes.
    The threshold (>= 2 proposals) ensures at least one comparison is possible.
    """
    from shared.database.connection import get_session
    from shared.database.repositories import proposal_repository as _prop_repo
    try:
        with get_session() as rec_session:
            latest = _prop_repo.list_by_quotation(rec_session, quotation_id)
            if len(latest) >= 2:
                calculate_and_persist(rec_session, quotation_id)
                logger.info("recommendation_recalculated_on_proposal_arrival")
                _auto_advance_portal(rec_session, quotation_id, logger)
    except Exception as exc:
        logger.warning(
            "Recommendation auto-trigger failed (non-blocking)",
            extra={"error": str(exc)},
        )


def _auto_advance_portal(session, quotation_id, log) -> None:
    """Advance a portal-origin quotation toward ENVIADA_CLIENTE once the
    recommendation is ready. No-op for internal quotations so the analyst's
    manual "Enviar ao Cliente" step is preserved (ARB-2451).

    Imports are local to avoid a module-load cycle (state machine and this
    module both depend on quotation_repository).
    """
    from shared.database.repositories import quotation_repository
    from shared.domain import quotation_state_machine

    if not quotation_repository.was_created_by_portal(session, quotation_id):
        return
    quotation = quotation_repository.get(session, quotation_id)
    if quotation is None:
        return
    final_state = quotation_state_machine.auto_advance_portal_to_client(session, quotation)
    if final_state:
        log.info("portal_quotation_auto_advanced", extra={"state": final_state})


def compute_lowest_badges(scores: list) -> tuple[dict[str, bool], dict[str, bool]]:
    """Derive "cheapest"/"fastest" badges from persisted scores, scoped to
    eligible proposals only (ineligible/expired proposals have cost_score=
    transit_score=None, per calculate_score_dicts, and are naturally excluded).

    Returns (is_lowest_cost_by_proposal_id, is_lowest_transit_by_proposal_id),
    both keyed by str(proposal_id) so callers can look up directly against
    already-serialized (JSON-safe) proposal dicts.
    """
    eligible_scores = [s for s in scores if s.is_eligible and s.cost_score is not None]
    max_cost_score = max((float(s.cost_score) for s in eligible_scores), default=None)
    max_transit_score = max((float(s.transit_score) for s in eligible_scores if s.transit_score is not None), default=None)

    is_lowest_cost: dict[str, bool] = {}
    is_lowest_transit: dict[str, bool] = {}
    for s in scores:
        cost_s = float(s.cost_score) if s.cost_score is not None else None
        transit_s = float(s.transit_score) if s.transit_score is not None else None
        is_lowest_cost[str(s.proposal_id)] = (
            cost_s is not None and max_cost_score is not None and cost_s >= max_cost_score
        )
        is_lowest_transit[str(s.proposal_id)] = (
            transit_s is not None and max_transit_score is not None and transit_s >= max_transit_score
        )
    return is_lowest_cost, is_lowest_transit


def serialize_result(result: RecommendationResult, agents_by_proposal: dict) -> dict:
    """Serialize a RecommendationResult to a JSON-safe dict for Lambda responses."""
    is_lowest_cost, is_lowest_transit = compute_lowest_badges(result.scores)

    scores_out = []
    for s in result.scores:
        agent_name = agents_by_proposal.get(s.proposal_id, UNKNOWN_AGENT_NAME)
        pid = str(s.proposal_id)
        scores_out.append({
            "proposal_id": pid,
            "agent_name": agent_name,
            "is_eligible": s.is_eligible,
            "ineligibility_reason": s.ineligibility_reason,
            "cost_score": float(s.cost_score) if s.cost_score is not None else None,
            "transit_score": float(s.transit_score) if s.transit_score is not None else None,
            "frequency_score": float(s.frequency_score) if s.frequency_score is not None else None,
            "route_score": float(s.route_score) if s.route_score is not None else None,
            "free_time_score": float(s.free_time_score) if s.free_time_score is not None else None,
            "validity_score": float(s.validity_score) if s.validity_score is not None else None,
            "total_score": float(s.total_score) if s.total_score is not None else None,
            "validade_status": s.validade_status or VALIDADE_OK,
            "posicao_ranking": s.posicao_ranking,
            "motivo": s.motivo,
            "is_recommended": s.proposal_id == result.recommended_proposal_id,
            "is_lowest_cost": is_lowest_cost[pid],
            "is_lowest_transit": is_lowest_transit[pid],
        })

    override_out = None
    if result.override:
        o = result.override
        override_out = {
            "id": str(o.id),
            "proposal_id": str(o.proposal_id) if o.proposal_id else None,
            "agent_name": o.agent_name,
            "justification": o.justification,
            "overridden_by": o.overridden_by,
            "created_at": o.created_at.isoformat(),
        }

    return {
        "recommended_proposal_id": (
            str(result.recommended_proposal_id) if result.recommended_proposal_id else None
        ),
        "recommendation_text": result.recommendation_text,
        "is_overridden": result.is_overridden,
        "override": override_out,
        "scores": scores_out,
    }


def calculate_and_serialize(session: Session, quotation_id: uuid.UUID) -> dict:
    """Recalculate, persist and serialize the recommendation in one call.

    Bundles the score calculation with the agent-name lookup + serialization so
    the analyst and portal recommendation handlers share the exact same body
    assembly (the recommendation panel is identical on both surfaces).
    """
    result = calculate_and_persist(session, quotation_id)
    latest = [p for p in proposal_repository.list_by_quotation(session, quotation_id) if p.is_latest]
    agents_by_proposal = {
        p.id: resolve_agent_name(freight_agent_repository.get(session, p.agent_id))
        for p in latest
    }
    return serialize_result(result, agents_by_proposal)
