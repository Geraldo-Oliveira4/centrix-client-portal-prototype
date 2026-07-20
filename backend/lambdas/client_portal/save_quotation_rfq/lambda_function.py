"""save_quotation_rfq — PUT /portal/quotations/{id}/rfq

Lets a portal client assemble the RFQ before dispatch: pick the target agents
(only from the pre-set list in their DNA), set the desired deadline, insurance
flag and free-text particularities. Idempotent — repeated PUTs update the same
RFQ as long as it has not been dispatched yet.

Reuses the internal RFQ machinery (`rfq_validation.validate_rfq_fields`,
`rfq_repository`) so the portal RFQ is validated exactly like the analyst one.
No exporter DNA is applied — particularities come straight from the form.

Status codes:
    200 — RFQ saved; returns { rfq, soft_warnings }
    400 — invalid payload
    401 — JWT missing
    403 — not a portal user
    404 — quotation not found OR not owned (anti-enumeration)
    409 — RFQ already dispatched (cannot be re-assembled from the portal)
    422 — selected agent outside the pre-set list, or unresolved hard blocks
    500 — internal error
"""

from shared.database.connection import get_session
from shared.database.repositories import (
    client_dna_repository,
    quotation_equipment_repository,
    rfq_repository,
)
from shared.domain.portal_rfq import resolve_eligible_agent_ids, validate_selected_agents
from shared.domain.rfq_validation import validate_rfq_fields
from shared.lambda_helpers import (
    build_response,
    parse_body,
    parse_datetime,
    parse_path_uuid,
    serialize_rfq,
)
from shared.observability import logger, tracer
from shared.portal_helpers import get_portal_client_id, load_owned_quotation


@tracer.capture_lambda_handler
@logger.inject_lambda_context(correlation_id_path="requestContext.requestId")
def lambda_handler(event, context):
    try:
        quotation_id, err = parse_path_uuid(event, "id")
        if err:
            return err

        logger.append_keys(quotation_id=str(quotation_id))

        body, err = parse_body(event)
        if err:
            return err

        with get_session() as session:
            client_id, err = get_portal_client_id(event, session)
            if err:
                return err

            quotation, err = load_owned_quotation(session, quotation_id, client_id)
            if err:
                return err

            dna = client_dna_repository.get_by_quotation(session, quotation)
            eligible_ids = resolve_eligible_agent_ids(dna)

            selection = validate_selected_agents(
                body.get("agents_targeted", []), eligible_ids
            )
            if not selection.ok:
                return build_response(422, {
                    "error": "Selecione ao menos um agente da lista pre-definida."
                    if selection.reason == "empty"
                    else "Um ou mais agentes selecionados nao estao na lista pre-definida.",
                    "invalid_agent_ids": selection.invalid_ids,
                    "eligible_agent_ids": eligible_ids,
                })
            selected = selection.normalised

            existing = rfq_repository.get_by_quotation(session, quotation_id)
            if existing is not None and existing.dispatched_at is not None:
                return build_response(409, {
                    "error": "RFQ already dispatched for this quotation",
                })

            # Optional deadline set from the RFQ form. The portal has no separate
            # quotation-edit step, so the deadline is captured here on the quotation.
            if "desired_deadline" in body:
                try:
                    quotation.desired_deadline = parse_datetime(body["desired_deadline"])
                except ValueError as exc:
                    return build_response(400, {"error": str(exc)})

            # Origin / collection point can also be completed inline from the RFQ
            # form when it was left blank at creation, so the client can resolve
            # the "origin required" hard block without a separate edit step.
            if "agente_define_local_coleta" in body:
                quotation.agente_define_local_coleta = bool(
                    body["agente_define_local_coleta"]
                )
            if "origin" in body:
                origin = body["origin"]
                quotation.origin = origin.strip() if isinstance(origin, str) else origin

            include_insurance = _resolve_insurance(quotation, body)
            particularities = body.get("particularities")

            equipments = quotation_equipment_repository.list_by_quotation(
                session, quotation_id
            )
            validation = validate_rfq_fields(quotation, dna, equipments=equipments)
            if validation["hard_blocks"]:
                return build_response(422, {
                    "error": "RFQ has unresolved hard blocks. Fix required fields before saving.",
                    "hard_blocks": validation["hard_blocks"],
                    "soft_warnings": validation["soft_warnings"],
                })

            if existing is None:
                rfq = rfq_repository.create(
                    session,
                    quotation_id=quotation_id,
                    agents_targeted=selected,
                    template_data={},
                    include_insurance=include_insurance,
                    destination_yard=quotation.destination_yard,
                    particularities=particularities,
                )
            else:
                rfq = rfq_repository.update(
                    session,
                    existing,
                    agents_targeted=selected,
                    include_insurance=include_insurance,
                    particularities=particularities,
                )

            logger.info(
                "portal_rfq_saved",
                extra={"rfq_id": str(rfq.id), "agents_targeted": len(selected)},
            )
            return build_response(200, {
                "rfq": serialize_rfq(rfq),
                "soft_warnings": validation["soft_warnings"],
            })

    except Exception:
        logger.exception("Unhandled error in save_quotation_rfq")
        return build_response(500, {"error": "Internal server error"})


def _resolve_insurance(quotation, body: dict) -> bool:
    """Resolve include_insurance for the RFQ from the portal form.

    Priority: explicit body flag, then the quotation's insurance_required,
    defaulting to False when neither is set.
    """
    if "include_insurance" in body:
        return bool(body["include_insurance"])
    if quotation.insurance_required is not None:
        return bool(quotation.insurance_required)
    return False
