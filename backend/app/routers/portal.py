"""Routes for the client-portal business handlers.

Each route loads the corresponding `lambdas/client_portal/<name>/lambda_function.py`
handler and invokes it through the event shim. Handlers are unchanged from Centrix.
"""

import importlib
import json

from fastapi import APIRouter, Request, Response

from app.audit_preview import lambda_handler as audit_preview_handler
from app.event_shim import invoke
from app.prototype_flow import auto_close_approved_quotation
from app.quotation_exporter import link_exporter

router = APIRouter(prefix="/portal", tags=["portal"])


def _handler(name: str):
    mod = importlib.import_module(f"lambdas.client_portal.{name}.lambda_function")
    return mod.lambda_handler


# Resolve all handlers once at import time.
h = {
    name: _handler(name)
    for name in (
        "get_my_client",
        "list_my_quotations",
        "get_my_quotation",
        "create_my_quotation",
        "approve_proposal",
        "decline_quotation",
        "cancel_quotation",
        "list_quotation_agents",
        "save_quotation_rfq",
        "dispatch_quotation_rfq",
        "get_my_recommendation",
        "get_my_quotation_history",
        "get_my_quotation_documents",
        "add_my_quotation_document",
        "trigger_my_quotation_extraction",
        "list_my_exporters",
        "create_my_exporter",
        "list_my_shipments",
        "get_my_shipment",
    )
}


# --- Client -----------------------------------------------------------------
@router.get("/clients/me")
async def get_my_client(request: Request):
    return await invoke(h["get_my_client"], request)


# --- Exporters --------------------------------------------------------------
@router.get("/exporters")
async def list_my_exporters(request: Request):
    return await invoke(h["list_my_exporters"], request)


@router.post("/exporters")
async def create_my_exporter(request: Request):
    return await invoke(h["create_my_exporter"], request)


# --- Quotations -------------------------------------------------------------
@router.get("/quotations")
async def list_my_quotations(request: Request):
    return await invoke(h["list_my_quotations"], request)


@router.post("/quotations")
async def create_my_quotation(request: Request):
    body = await request.json() if await request.body() else {}
    resp = await invoke(h["create_my_quotation"], request)

    # The copied handler ignores exporter_id (Centrix attaches the exporter later,
    # via the analyst). Link it here so the portal's "select exporter" step on the
    # new-quotation form actually persists. See app/quotation_exporter.py.
    exporter_id = body.get("exporter_id") if isinstance(body, dict) else None
    if resp.status_code == 201 and exporter_id:
        payload = json.loads(resp.body)
        if link_exporter(payload["quotation"]["id"], exporter_id):
            payload["quotation"]["exporter_id"] = exporter_id
            return Response(
                content=json.dumps(payload),
                status_code=201,
                media_type="application/json",
            )
    return resp


@router.get("/quotations/{id}")
async def get_my_quotation(request: Request, id: str):
    return await invoke(h["get_my_quotation"], request, {"id": id})


@router.post("/quotations/{id}/proposals/{proposal_id}/approve")
async def approve_proposal(request: Request, id: str, proposal_id: str):
    resp = await invoke(h["approve_proposal"], request, {"id": id, "proposal_id": proposal_id})
    # PROTOTYPE happy-path: after the client approves, simulate the Freitas
    # analyst auto-approving/closing the quotation (APROVADA_PELO_CLIENTE ->
    # FECHADA) so it moves to "Aprovadas" instead of waiting in "Escolha sua
    # proposta". See app/prototype_flow.py for the full rationale (guard rail is
    # intentionally simplified out in this prototype). Then return the fresh
    # detail so the UI reflects the closed/approved state.
    if resp.status_code == 200:
        auto_close_approved_quotation(id)
        return await invoke(h["get_my_quotation"], request, {"id": id})
    return resp


@router.post("/quotations/{id}/decline")
async def decline_quotation(request: Request, id: str):
    return await invoke(h["decline_quotation"], request, {"id": id})


@router.post("/quotations/{id}/cancel")
async def cancel_quotation(request: Request, id: str):
    return await invoke(h["cancel_quotation"], request, {"id": id})


# --- RFQ --------------------------------------------------------------------
@router.get("/quotations/{id}/agents")
async def list_quotation_agents(request: Request, id: str):
    return await invoke(h["list_quotation_agents"], request, {"id": id})


@router.put("/quotations/{id}/rfq")
async def save_quotation_rfq(request: Request, id: str):
    return await invoke(h["save_quotation_rfq"], request, {"id": id})


@router.post("/quotations/{id}/rfq/dispatch")
async def dispatch_quotation_rfq(request: Request, id: str):
    return await invoke(h["dispatch_quotation_rfq"], request, {"id": id})


# --- Recommendation / history / documents -----------------------------------
@router.get("/quotations/{id}/recommendation")
async def get_my_recommendation(request: Request, id: str):
    return await invoke(h["get_my_recommendation"], request, {"id": id})


@router.get("/quotations/{id}/history")
async def get_my_quotation_history(request: Request, id: str):
    return await invoke(h["get_my_quotation_history"], request, {"id": id})


@router.get("/quotations/{id}/attachments")
async def get_my_quotation_documents(request: Request, id: str):
    return await invoke(h["get_my_quotation_documents"], request, {"id": id})


@router.post("/quotations/{id}/documents/upload-url")
async def add_my_quotation_document(request: Request, id: str):
    return await invoke(h["add_my_quotation_document"], request, {"id": id})


@router.post("/quotations/{id}/trigger-extraction")
async def trigger_my_quotation_extraction(request: Request, id: str):
    return await invoke(h["trigger_my_quotation_extraction"], request, {"id": id})


# --- Audit preview (MOCK) ---------------------------------------------------
# MOCK - Auditoria real (Camada de Auditoria de Frete/Fatura) é produto separado,
# sequenciado após GE go-live. Este preview existe apenas para visualização
# conceitual no debate de produto. O handler mora em `app/audit_preview.py`, e
# não em `lambdas/client_portal/`, justamente porque fabrica o valor realizado —
# ver a docstring de lá.
@router.get("/quotations/{id}/audit-preview")
async def get_my_quotation_audit_preview(request: Request, id: str):
    return await invoke(audit_preview_handler, request, {"id": id})


# --- Shipments (GE) ---------------------------------------------------------
# Read-only: the client follows the shipment its approved quotation generated,
# but every operational change stays with the analyst's GE module.
@router.get("/shipments")
async def list_my_shipments(request: Request):
    return await invoke(h["list_my_shipments"], request)


@router.get("/shipments/{id}")
async def get_my_shipment(request: Request, id: str):
    return await invoke(h["get_my_shipment"], request, {"id": id})
