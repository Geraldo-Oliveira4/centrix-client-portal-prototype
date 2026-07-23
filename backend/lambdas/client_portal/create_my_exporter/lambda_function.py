"""create_my_exporter — POST /portal/exporters

Portal-facing self-service exporter registration. The client_id is always
derived from the JWT (via portal_users table) — any client_id in the body is
ignored, exactly like create_my_quotation. The resulting row is owned by that
client and is invisible to every other portal user.

This has no analyst counterpart in `lambdas/`: the analyst catalogue
(`exporter_repository`) is global and unfiltered, so the portal gets its own
client-scoped repository rather than reusing it.

Body:
    {
        "name": "<required, max 255>",
        "endereco": "<optional, max 500>",
        "particularidades": "<optional, max 2000>",
        "cargo_profile": "GERAL" | "PERIGOSA" | "TEMP_CONTROLADA",  (optional)
        "contact_email": "<optional, max 255>"
    }

Status codes:
    201 — created; returns { exporter }
    400 — missing/invalid name, invalid cargo_profile, field too long
    401 — JWT missing
    403 — not a portal user
    409 — this client already registered an exporter with the same name
    500 — internal error
"""

from shared.database.connection import get_session
from shared.database.models.quotation.enums import ExporterCargoProfile
from shared.database.repositories import portal_exporter_repository
from shared.lambda_helpers import (
    build_response,
    parse_body,
    serialize_exporter,
    validate_enum_field,
)
from shared.observability import logger, tracer
from shared.portal_helpers import get_portal_client_id

_MAX_NAME = 255
_MAX_ENDERECO = 500
_MAX_PARTICULARIDADES = 2000
_MAX_EMAIL = 255


def _optional_text(body: dict, field: str, max_len: int) -> tuple[str | None, str | None]:
    """Normalise an optional free-text field. Blank strings collapse to None so
    the DB stores NULL rather than '' (the frontend sends '' for untouched
    inputs). Returns (value, error_message).
    """
    raw = body.get(field)
    if raw is None:
        return None, None
    if not isinstance(raw, str):
        return None, f"Field '{field}' must be a string"
    value = raw.strip()
    if not value:
        return None, None
    if len(value) > max_len:
        return None, f"Field '{field}' exceeds {max_len} characters"
    return value, None


@tracer.capture_lambda_handler
@logger.inject_lambda_context(correlation_id_path="requestContext.requestId")
def lambda_handler(event, context):
    try:
        body, err = parse_body(event)
        if err:
            return err

        raw_name = body.get("name")
        if not isinstance(raw_name, str) or not raw_name.strip():
            return build_response(400, {"error": "Field 'name' is required"})
        name = raw_name.strip()
        if len(name) > _MAX_NAME:
            return build_response(
                400, {"error": f"Field 'name' exceeds {_MAX_NAME} characters"}
            )

        endereco, err_msg = _optional_text(body, "endereco", _MAX_ENDERECO)
        if err_msg:
            return build_response(400, {"error": err_msg})
        particularidades, err_msg = _optional_text(
            body, "particularidades", _MAX_PARTICULARIDADES
        )
        if err_msg:
            return build_response(400, {"error": err_msg})
        contact_email, err_msg = _optional_text(body, "contact_email", _MAX_EMAIL)
        if err_msg:
            return build_response(400, {"error": err_msg})

        cargo_profile = ExporterCargoProfile.GERAL
        if body.get("cargo_profile") is not None:
            parsed, err_msg = validate_enum_field(
                "cargo_profile", body.get("cargo_profile"), ExporterCargoProfile
            )
            if err_msg:
                return build_response(400, {"error": err_msg})
            cargo_profile = parsed

        with get_session() as session:
            client_id, err = get_portal_client_id(event, session)
            if err:
                return err

            if portal_exporter_repository.name_exists_for_client(
                session, client_id, name
            ):
                return build_response(
                    409,
                    {"error": "Ja existe um exportador cadastrado com esse nome"},
                )

            exporter = portal_exporter_repository.create_for_client(
                session,
                client_id=client_id,
                name=name,
                endereco=endereco,
                particularidades=particularidades,
                cargo_profile=cargo_profile,
                contact_email=contact_email,
            )
            result = serialize_exporter(exporter)

        logger.info("exporter_created_by_portal", extra={"exporter_id": result["id"]})
        return build_response(201, {"exporter": result})

    except Exception:
        logger.exception("Unhandled error")
        return build_response(500, {"error": "Internal server error"})
