import json
import os
import re
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from enum import Enum
from typing import Any


# ---------------------------------------------------------------------------
# Response helpers
# ---------------------------------------------------------------------------


def get_allowed_origin() -> str:
    return os.getenv("ALLOWED_ORIGIN", "*")


def build_response(status_code: int, body: Any) -> dict:
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": get_allowed_origin(),
            "Access-Control-Allow-Credentials": "true",
            "Cache-Control": "no-store, no-cache, must-revalidate",
        },
        "body": json.dumps(body),
    }


def get_user_id(event: dict) -> str | None:
    return (
        event.get("requestContext", {})
        .get("authorizer", {})
        .get("jwt", {})
        .get("claims", {})
        .get("sub")
    )


def _get_jwt_groups(event: dict) -> list[str]:
    """Extract Cognito groups from the JWT claims, normalised to a list.

    Cognito serialises `cognito:groups` either as a JSON-array string
    (`"[portal]"`) or as a space-separated string (`"portal internal"`)
    depending on token type. Both shapes are handled here.
    """
    claims = (
        event.get("requestContext", {})
        .get("authorizer", {})
        .get("jwt", {})
        .get("claims", {})
    )
    raw = claims.get("cognito:groups")
    if raw is None:
        return []
    if isinstance(raw, list):
        return [g for g in raw if g]
    s = str(raw).strip()
    if not s:
        return []
    if s.startswith("[") and s.endswith("]"):
        s = s[1:-1]
    return [g.strip() for g in s.replace(",", " ").split() if g.strip()]


def require_portal_group(event: dict) -> tuple[str | None, dict | None]:
    """Authorize a request to a /portal/* route.

    Requires the JWT `cognito:groups` claim to contain `portal`. Returns
    (user_id, None) on success or (None, error_response) on failure.

    Usage:
        sub, err = require_portal_group(event)
        if err:
            return err
    """
    sub = get_user_id(event)
    if not sub:
        return None, build_response(401, {"error": "Unauthorized"})
    if "portal" not in _get_jwt_groups(event):
        return None, build_response(403, {"error": "Forbidden"})
    return sub, None


def reject_portal_group(event: dict) -> tuple[str | None, dict | None]:
    """Authorize a request to an internal route.

    Rejects callers whose JWT `cognito:groups` claim contains `portal`.
    Pre-existing staff users carry no groups at all — they pass. Newly
    registered staff carry `internal` — they also pass. Only portal
    customers are blocked.

    Returns (user_id, None) on success or (None, error_response) on failure.
    """
    sub = get_user_id(event)
    if not sub:
        return None, build_response(401, {"error": "Unauthorized"})
    if "portal" in _get_jwt_groups(event):
        return None, build_response(403, {"error": "Forbidden"})
    return sub, None


# ---------------------------------------------------------------------------
# Input parsing helpers
# ---------------------------------------------------------------------------


def parse_path_uuid(event: dict, param: str) -> tuple[uuid.UUID | None, dict | None]:
    """Extract and parse a UUID path parameter from the Lambda event.

    Returns (uuid, None) on success or (None, error_response) on failure.
    Usage: resource_id, err = parse_path_uuid(event, "id"); if err: return err
    """
    value = (event.get("pathParameters") or {}).get(param)
    if not value:
        return None, build_response(400, {"error": f"Missing path parameter: {param}"})
    try:
        return uuid.UUID(value), None
    except ValueError:
        return None, build_response(400, {"error": f"Invalid {param} format"})


def parse_body(event: dict) -> tuple[dict | None, dict | None]:
    """Parse the JSON request body from the Lambda event.

    Returns (body_dict, None) on success or (None, error_response) on failure.
    Usage: body, err = parse_body(event); if err: return err
    """
    try:
        return json.loads(event.get("body") or "{}"), None
    except json.JSONDecodeError:
        return None, build_response(400, {"error": "Invalid JSON body"})


def parse_optional_number(body: dict, field: str, cast_fn: type) -> tuple[Any, Any]:
    """Parse an optional numeric field from a request body.

    Returns (parsed_value_or_None, error_response_or_None).
    Usage: value, err = parse_optional_number(body, "ptax_percentual", float); if err: return err
    """
    if body.get(field) is None:
        return None, None
    try:
        return cast_fn(body[field]), None
    except (TypeError, ValueError):
        type_label = "an integer" if cast_fn is int else "a number"
        return None, build_response(400, {"error": f"{field} must be {type_label}"})


def coerce_taxes_breakdown(taxes: dict) -> dict:
    """Coerce all values in a taxes_breakdown dict to float, dropping None entries.

    Intended for AI extraction paths where the caller has already validated that
    the input is a dict. Does not raise — skips keys with None values silently.
    """
    return {k: float(v) for k, v in taxes.items() if v is not None}


def parse_taxes_breakdown(body: dict, field: str = "taxes_breakdown") -> tuple[dict | None, dict | None]:
    """Validate and coerce a taxes_breakdown field from a request body.

    Returns (coerced_dict_or_None, error_response_or_None).
    Usage: taxes, err = parse_taxes_breakdown(body); if err: return err

    Enforces:
    - field is present and is a dict
    - all values are coercible to float (returns 400 otherwise)
    - returns a new dict with float values; never mutates body in place
    """
    value = body.get(field)
    if value is None:
        return None, None
    if not isinstance(value, dict):
        return None, build_response(400, {"error": f"{field} must be an object"})
    try:
        return {k: float(v) for k, v in value.items()}, None
    except (TypeError, ValueError):
        return None, build_response(400, {"error": f"{field} values must be numeric"})


def parse_uuid(value: str | None) -> uuid.UUID | None:
    """Parse a UUID string. Returns None if empty. Raises ValueError on invalid format."""
    if not value:
        return None
    try:
        return uuid.UUID(value)
    except ValueError:
        raise ValueError(f"Invalid UUID format: '{value}'")


def parse_enum(enum_class: type[Enum], value: Any) -> Enum | None:
    """Parse a raw value into an enum member, raising ValueError on invalid input."""
    if value is None:
        return None
    try:
        return enum_class(value)
    except ValueError:
        raise ValueError(f"Invalid value '{value}' for {enum_class.__name__}")


def validate_enum_field(
    field_name: str, raw: Any, enum_class: type[Enum]
) -> tuple[Enum | None, str | None]:
    """Validate a raw string against an enum class.

    Returns (parsed_member, None) on success or (None, error_message) on failure.
    The error message includes the list of valid values and uses the field_name
    so callers (handlers and guards) can forward it directly without reformatting.
    """
    try:
        return enum_class(raw), None
    except ValueError:
        valid = [e.value for e in enum_class]
        return None, f"Invalid {field_name} '{raw}'. Valid values: {valid}"


def parse_bool_param(field_name: str, raw: Any) -> tuple[bool | None, str | None]:
    """Validate a raw query-param string as a boolean ("true"/"false").

    Returns (parsed_bool, None) on success or (None, error_message) on failure.
    Mirrors validate_enum_field's contract so handlers treat boolean and enum
    query params consistently, and the error message lists the accepted values.
    """
    lowered = str(raw).lower()
    if lowered == "true":
        return True, None
    if lowered == "false":
        return False, None
    return None, f"Invalid {field_name} '{raw}'. Valid values: ['true', 'false']"


def parse_datetime(value: str | None) -> datetime | None:
    """Parse an ISO date or datetime string into a timezone-aware datetime.

    Accepts YYYY-MM-DD (interpreted as midnight UTC) or any ISO datetime string.
    Raises ValueError on invalid input.
    """
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except (ValueError, TypeError):
        pass
    try:
        d = date.fromisoformat(value)
        return datetime(d.year, d.month, d.day, tzinfo=timezone.utc)
    except (ValueError, TypeError):
        raise ValueError(
            f"Invalid date/datetime format '{value}'. Expected YYYY-MM-DD or ISO 8601"
        )


def parse_date(value: str | None) -> date | None:
    """Parse an ISO date string (YYYY-MM-DD), raising ValueError on invalid input."""
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except (ValueError, TypeError):
        raise ValueError(f"Invalid date format '{value}'. Expected YYYY-MM-DD")


# ---------------------------------------------------------------------------
# Serialization helpers
# ---------------------------------------------------------------------------


def _coerce(value: Any) -> Any:
    """Convert common SQLAlchemy/Python types to JSON-safe primitives.

    Recurses into dicts and lists so nested JSONB fields (e.g. taxes_breakdown)
    are fully serialized regardless of whether their inner values are Decimal,
    UUID, datetime, or Enum instances.
    """
    if value is None:
        return None
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, dict):
        return {k: _coerce(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_coerce(v) for v in value]
    return value


def _pick(obj: Any, fields: list[str]) -> dict:
    """Return a dict of coerced field values from obj."""
    return {field: _coerce(getattr(obj, field)) for field in fields}


# ---------------------------------------------------------------------------
# Serializers
# ---------------------------------------------------------------------------


def serialize_log(log) -> dict:
    result = _pick(log, ["user_id", "status", "details", "error_message"])
    result["logId"] = str(log.log_id)
    result["timestamp"] = log.timestamp.isoformat() if log.timestamp else None
    result["actionType"] = log.action_type
    return result


def serialize_user(user) -> dict:
    return _pick(user, ["id", "name", "email", "role", "created_at", "updated_at"])


def serialize_client(client) -> dict:
    return _pick(
        client,
        [
            "id",
            "name",
            "sector",
            "email",
            "company_code",
            "cnpj",
            "razao_social",
            "endereco",
            "importador",
            "adquirente",
            "importacao_direta",
            "tier",
            "is_vip",
            "created_at",
        ],
    )


def serialize_freight_agent_contact(contact) -> dict:
    return _pick(
        contact,
        [
            "id",
            "name",
            "email",
            "phone",
            "export_air",
            "import_air",
            "export_maritime",
            "import_maritime",
            "export_road",
            "import_road",
            "created_at",
            "updated_at",
        ],
    )


def serialize_freight_agent(agent) -> dict:
    result = _pick(
        agent,
        [
            "id",
            "name",
            "email",
            "preferred_channel",
            "reliability_score",
            "total_quotations",
            "error_count",
            "certificacao_oea",
            "data_validade_oea",
            "carga_imo",
            "created_at",
            "updated_at",
        ],
    )
    result["modal_regions"] = (
        [r.value for r in agent.modal_regions]
        if agent.modal_regions
        else None
    )
    if hasattr(agent, "contacts") and agent.contacts:
        result["contacts"] = [serialize_freight_agent_contact(c) for c in agent.contacts]
    else:
        result["contacts"] = []
    return result


def serialize_exporter(exporter) -> dict:
    return _pick(
        exporter,
        [
            "id",
            "name",
            "endereco",
            "particularidades",
            "cargo_profile",
            "contact_email",
            "created_at",
            "updated_at",
        ],
    )


def serialize_client_portal_contact(contact) -> dict:
    return _pick(contact, ["id", "client_id", "email", "name", "created_at"])


def serialize_quotation(
    quotation,
    analyst_name: str | None = None,
    equipments: list | None = None,
    volumes: list | None = None,
) -> dict:
    result = {
        **_pick(
            quotation,
            [
                "id",
                "reference",
                "state",
                "priority_score",
                "completeness_score",
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
                "incluir_entrega_destino_final",
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
                "necessidade_descarga",
                "ncm",
                "exportador",
                "pais_procedencia",
                "peso_taxado",
                "observations",
                "carga_perigosa",
                "un_number",
                "imo_class",
                "temperatura_min",
                "temperatura_max",
                "client_reference",
                "agente_define_porto_embarque",
                "agente_define_porto_destino",
                "agente_define_aeroporto_embarque",
                "agente_define_aeroporto_destino",
                "agente_define_local_coleta",
                "ptax_negociada",
                "price_or_performance",
                "urgency",
                "analyst_id",
                "client_id",
                "exporter_id",
                "sender_email",
                "client_match_status",
                "client_match_candidates",
                "confidence_scores",
                "extraction_status",
                "extraction_model",
                "extracted_at",
                "original_email_s3_key",
                "created_at",
                "sent_at",
                "closed_at",
                "declined_at",
                "decline_reason",
                "winning_agent_id",
                "quoted_value_usd",
                "originated_from_id",
                "recotacao_motivo",
                "updated_at",
            ],
        ),
        "analyst_name": analyst_name,
        "attachments_s3_keys": quotation.attachments_s3_keys or {},
    }
    if equipments is not None:
        result["equipments"] = [serialize_quotation_equipment(e) for e in equipments]
    if volumes is not None:
        result["volumes"] = [serialize_quotation_volume(v) for v in volumes]
    return result


def serialize_quotation_equipment(equipment) -> dict:
    return _pick(
        equipment,
        [
            "id",
            "quotation_id",
            "quantity",
            "tipo_container",
            "volume_m3",
            "peso_bruto",
            "peso_unidade",
            "created_at",
        ],
    )


def serialize_quotation_volume(volume) -> dict:
    return _pick(
        volume,
        [
            "id",
            "quotation_id",
            "quantity",
            "embalagem",
            "peso_bruto",
            "peso_unidade",
            "comprimento",
            "largura",
            "altura",
            "dimensao_unidade",
            "volume_m3",
            "inspecao_iof",
            "created_at",
        ],
    )


def serialize_container_spec(spec) -> dict:
    return _pick(
        spec,
        [
            "tipo_container",
            "comprimento_interno_mm",
            "largura_interna_mm",
            "altura_interna_mm",
            "capacidade_m3",
            "carga_maxima_kg",
            "tara_kg",
            "peso_max_total_kg",
            "updated_at",
        ],
    )


def serialize_quotation_log(log) -> dict:
    return _pick(
        log,
        [
            "id",
            "quotation_id",
            "action",
            "previous_state",
            "new_state",
            "user_id",
            "details",
            "created_at",
        ],
    )


def serialize_proposal(proposal) -> dict:
    result = {
        **_pick(
            proposal,
            [
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
                "original_email_s3_key",
                "extraction_status",
                "extraction_model",
                "extracted_at",
                "confidence_scores",
                "review_status",
                "review_reason",
                "numero_oferta",
                "ptax_percentual",
                "prazo_pagamento_dias",
                "seguro_percentual",
                "seguro_minimo",
                "frequencia",
                "free_time_dias",
                "observations",
                "carga_perigosa",
                "taxes_currency_breakdown",
                "freight_currency",
                "version",
                "is_latest",
                "is_recommended",
                "parent_proposal_id",
                "version_diff",
                "containers_priced",
                "offered_container_type",
                "deleted_at",
            ],
        ),
        "attachments_s3_keys": proposal.attachments_s3_keys or {},
        "is_deleted": proposal.deleted_at is not None,
        "has_previous_versions": (getattr(proposal, "version", 1) or 1) > 1,
    }
    if hasattr(proposal, "agent") and proposal.agent is not None:
        result["agent"] = {"id": str(proposal.agent.id), "name": proposal.agent.name}
    return result


def serialize_existing_portal_proposal(p) -> dict:
    result = _pick(
        p,
        [
            "id",
            "version",
            "numero_oferta",
            "total_value",
            "freight_value",
            "freight_currency",
            "transit_time",
            "carrier",
            "validity",
            "incoterm",
            "route_type",
            "route_detail",
            "insurance_included",
            "observations",
            "ptax_percentual",
            "prazo_pagamento_dias",
            "seguro_percentual",
            "seguro_minimo",
            "frequencia",
            "free_time_dias",
            "carga_perigosa",
            "containers_priced",
            "offered_container_type",
        ],
    )
    result["taxes_breakdown"] = p.taxes_breakdown or {}
    result["taxes_currency_breakdown"] = p.taxes_currency_breakdown or {}
    return result


def serialize_audit_flag(flag) -> dict:
    return _pick(
        flag,
        [
            "id",
            "proposal_id",
            "rule_category",
            "rule_name",
            "severity",
            "description",
            "resolved",
            "resolved_by",
            "resolved_at",
            "justification",
            "created_at",
        ],
    )


def serialize_rfq_agent_token(token) -> dict:
    return _pick(
        token,
        [
            "id",
            "agent_id",
            "revoked_at",
            "declined_at",
            "decline_reason",
        ],
    )


def serialize_rfq(rfq) -> dict:
    return _pick(
        rfq,
        [
            "id",
            "quotation_id",
            "agents_targeted",
            "template_data",
            "include_insurance",
            "destination_yard",
            "particularities",
            "dispatched_at",
            "created_at",
        ],
    )


def serialize_dna(dna) -> dict:
    return {
        **_pick(
            dna,
            [
                "id",
                "client_id",
                "service_type",
                "modality",
                "tipo_embarque",
                "logistics_type",
                "default_agents",
                "destination_yard",
                "destination_yard_aereo",
                "destination_yard_maritimo_fcl",
                "destination_yard_maritimo_lcl",
                "quotation_particularities",
                "dangerous_cargo_shipper",
                "price_or_performance",
                "cargo_profile",
                "contact_name",
                "contact_email",
                "assigned_analyst",
                "exige_oea",
                "anvisa_restrictions",
                "preferred_embarque_local",
                "updated_at",
            ],
        ),
        # insurance_responsibility is flagged as is_critical per RF-COT-101
        "insurance_responsibility": {
            "value": _coerce(dna.insurance_responsibility),
            "is_critical": True,
        },
    }


def serialize_shipment_instruction(si) -> dict:
    return {
        **_pick(
            si,
            [
                "id",
                "reference",
                "quotation_id",
                "proposal_id",
                "status",
                "exportador",
                "consignatario",
                "notificado",
                "incoterm_cotado",
                "incoterm_aprovado",
                "ptax_tipo",
                "ptax_valor",
                "incluir_seguro",
                "solicitar_agente_origem",
                "prontidao_prevista",
                "instrucoes_livres",
                "cc_emails",
                "agente_origem",
                "created_by",
                "sent_by",
                "sent_at",
                "created_at",
                "updated_at",
            ],
        ),
    }


def serialize_embarque(embarque) -> dict:
    return _pick(
        embarque,
        [
            "id",
            "processo_id",
            "estado",
            "reference",
            "created_at",
            "updated_at",
        ],
    )


def serialize_processo(processo, embarques: list | None = None) -> dict:
    result = _pick(
        processo,
        [
            "id",
            "quotation_id",
            "client_id",
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
            "created_at",
            "updated_at",
        ],
    )
    if embarques is not None:
        result["embarques"] = [serialize_embarque(e) for e in embarques]
    return result


PROCESSO_DATAS_KEYS = (
    "prontidao",
    "limite_necessidade",
    "coleta",
    "embarque",
    "chegada_destino",
)


def _serialize_processo_base(processo, embarque) -> dict:
    """Fields shared by the kanban card and the workspace detail serializers.

    Centralizing the common processo/embarque fields means a new shared field is
    added in one place instead of being duplicated across both views (where the
    two could silently drift apart). Each serializer spreads this base and adds
    its own specific fields (flattened dates on the card; nested client/agent and
    full datas dict on the detail).
    """
    return {
        "id": _coerce(processo.id),
        "referencia": embarque.reference,
        "estado": _coerce(embarque.estado),
        "incoterm": processo.incoterm,
        "modal": _coerce(processo.modal),
        "tipo_embarque": _coerce(processo.tipo_embarque),
        "tipo_despacho": _coerce(processo.tipo_despacho),
        "carga_urgente": processo.carga_urgente,
        "quotation_id": _coerce(processo.quotation_id),
        "inova_processo_id": processo.inova_processo_id,
        "created_at": _coerce(processo.created_at),
    }


def serialize_processo_kanban_item(
    processo,
    embarque,
    cliente_nome: str,
    agente_nome: "str | None" = None,
) -> dict:
    """Compact card serializer for GET /shipments/kanban."""
    datas = processo.datas or {}
    return {
        **_serialize_processo_base(processo, embarque),
        "cliente_nome": cliente_nome,
        "agente_nome": agente_nome,
        "data_prontidao": datas.get("prontidao"),
        "data_limite_necessidade": datas.get("limite_necessidade"),
    }


def serialize_processo_detail(processo, embarque, client, agent=None) -> dict:
    """Rich serializer for GET /shipments/{id} — workspace view (ARB-2274).

    Nests client and agent objects and shapes the datas JSONB into a
    fixed-key dict so the frontend always receives a predictable schema.
    """
    datas_raw = processo.datas or {}
    return {
        **_serialize_processo_base(processo, embarque),
        "cliente": {"id": _coerce(client.id), "nome": client.name},
        "agente": {"id": _coerce(agent.id), "nome": agent.name} if agent else None,
        "observacao": processo.observacao,
        "datas": {k: datas_raw.get(k) for k in PROCESSO_DATAS_KEYS},
    }


def serialize_booking(booking) -> dict | None:
    """Serializer para GET/PUT /shipments/{id}/booking."""
    if booking is None:
        return None
    return _pick(
        booking,
        [
            "id",
            "embarque_id",
            "cia_aerea_armador",
            "mawb_mbl",
            "hawb_hbl",
            "containers",
            "frete_valor",
            "seguro_valor",
            "observacao",
            "created_at",
            "updated_at",
        ],
    )


def serialize_followup(followup) -> dict:
    """Serializer para GET/POST /shipments/{id}/followups."""
    return _pick(
        followup,
        [
            "id",
            "embarque_id",
            "grupo",
            "tipo_ocorrencia",
            "nota",
            "origem",
            "responsavel_id",
            "created_at",
        ],
    )


def serialize_documento(documento, download_url: str | None = None) -> dict:
    """Serializer para GET /shipments/{id}/documentos.

    `download_url` e opcional: gerado sob demanda pelo handler (presigned GET
    com TTL curto), nunca armazenado — mesmo padrao de attachments_s3_keys.
    """
    result = _pick(
        documento,
        [
            "id",
            "embarque_id",
            "tipo_arquivo_codigo",
            "tipo_arquivo_label",
            "observacao",
            "responsavel_id",
            "inova_sequencia",
            "created_at",
        ],
    )
    result["download_url"] = download_url
    return result


# ---------------------------------------------------------------------------
# Domain helpers
# ---------------------------------------------------------------------------

UNKNOWN_AGENT_NAME: str = "Agente desconhecido"


def resolve_agent_name(agent) -> str:
    return agent.name if agent else UNKNOWN_AGENT_NAME


def has_incoterm_divergence(si) -> bool:
    """Return True when the approved Incoterm differs from the quoted one."""
    if not si.incoterm_cotado or not si.incoterm_aprovado:
        return False
    return si.incoterm_cotado.upper() != si.incoterm_aprovado.upper()


# ---------------------------------------------------------------------------
# Auth / JWT helpers
# ---------------------------------------------------------------------------


def normalize_emails(emails: list) -> list[str]:
    """Split entries that are comma-, semicolon-, or whitespace-joined email strings."""
    result = []
    for entry in emails:
        for addr in re.split(r"[,;\s]+", str(entry)):
            addr = addr.strip()
            if addr:
                result.append(addr)
    return result


# Basic RFC-5322-ish address check — good enough to reject malformed input
# (spaces, missing @, missing domain) before handing addresses to Graph, which
# rejects the entire message if a single recipient is invalid.
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def is_valid_email(addr: str) -> bool:
    return bool(_EMAIL_RE.match(addr.strip()))


def partition_emails(emails: list) -> tuple[list[str], list[str]]:
    """Normalize then split into (valid, invalid), preserving order and de-duping.

    Use before sending mail so a single malformed recipient cannot make Graph
    reject the whole message. The caller decides what to do with the invalid
    list (drop from CC, surface to the user, etc.).
    """
    valid: list[str] = []
    invalid: list[str] = []
    seen: set[str] = set()
    for addr in normalize_emails(emails):
        key = addr.lower()
        if key in seen:
            continue
        seen.add(key)
        (valid if is_valid_email(addr) else invalid).append(addr)
    return valid, invalid


def get_user_from_event(event: dict[str, Any]) -> str:
    """Extrai o username do evento da API Gateway.

    O username está disponível nas claims do JWT processado pelo authorizer.
    Retorna 'system' como fallback quando não há contexto de autenticação
    (ex.: invocações internas ou eventos sem JWT).

    Para obter o sub (UUID do usuário), use get_user_id().
    """
    return (
        event.get("requestContext", {})
        .get("authorizer", {})
        .get("jwt", {})
        .get("claims", {})
        .get("username", "system")
    )
