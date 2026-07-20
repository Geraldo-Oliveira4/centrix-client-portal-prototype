"""Portal RFQ helpers — pre-set agent eligibility for client-portal dispatch.

The client portal is self-service but not open-ended: a portal customer may only
target freight agents that Freitas has pre-selected for them, stored in
`QuotationClientDna.default_agents` (a JSONB list of agent UUIDs, historically
also seen as a dict of {label: uuid}). The client picks a subset of that list —
they never register a new agent (spec section 3).

These helpers are pure/data-level so they can be unit-tested without Graph or
email side effects: normalisation of the DNA list, agent loading, and validation
of a client-selected subset against the pre-set list.
"""

import uuid
from typing import NamedTuple, Optional

from sqlalchemy.orm import Session

from shared.database.repositories import freight_agent_repository


class AgentSelectionResult(NamedTuple):
    """Outcome of validating a client agent selection against the pre-set list.

    `ok` is True only when at least one agent was selected and every selected
    agent is in the pre-set list. Otherwise `reason` explains which rule failed
    ("empty" or "out_of_list") and `invalid_ids` lists the offending agents.
    """

    ok: bool
    normalised: list[str]
    invalid_ids: list[str]
    reason: Optional[str]  # "empty" | "out_of_list" | None


def resolve_eligible_agent_ids(dna) -> list[str]:
    """Normalise `dna.default_agents` into a de-duplicated list of string UUIDs.

    `default_agents` may be stored as a list of UUID strings or as a dict of
    {label: uuid}. Returns an empty list when the client has no DNA or no
    pre-set agents.
    """
    if dna is None or not dna.default_agents:
        return []

    raw = dna.default_agents
    if isinstance(raw, dict):
        values = list(raw.values())
    elif isinstance(raw, list):
        values = raw
    else:
        return []

    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        key = str(value)
        if key and key not in seen:
            seen.add(key)
            result.append(key)
    return result


def load_eligible_agents(session: Session, dna) -> list:
    """Fetch the FreightAgent records for the client's pre-set agents.

    IDs that no longer resolve to an agent are skipped silently — the pre-set
    list is curated by Freitas and may reference an agent that was later removed.
    """
    agents = []
    for raw_id in resolve_eligible_agent_ids(dna):
        try:
            agent_uuid = uuid.UUID(raw_id)
        except (ValueError, TypeError):
            continue
        agent = freight_agent_repository.get(session, agent_uuid)
        if agent is not None:
            agents.append(agent)
    return agents


def validate_selected_agents(
    selected_ids: list, eligible_ids: list[str]
) -> AgentSelectionResult:
    """Validate a client-selected agent list against the pre-set eligible list.

    See AgentSelectionResult. An empty selection fails with reason "empty"; a
    selection containing an agent outside the pre-set list fails with reason
    "out_of_list" and the offending ids. A valid selection is de-duplicated.
    """
    eligible = set(eligible_ids)
    normalised = [str(a) for a in selected_ids if str(a)]
    if not normalised:
        return AgentSelectionResult(ok=False, normalised=[], invalid_ids=[], reason="empty")
    invalid = [a for a in normalised if a not in eligible]
    if invalid:
        return AgentSelectionResult(
            ok=False, normalised=[], invalid_ids=invalid, reason="out_of_list"
        )
    # De-duplicate while preserving order.
    seen: set[str] = set()
    unique = [a for a in normalised if not (a in seen or seen.add(a))]
    return AgentSelectionResult(ok=True, normalised=unique, invalid_ids=[], reason=None)
