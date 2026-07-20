"""Routes for the client-portal business handlers.

Each route loads the corresponding `lambdas/client_portal/<name>/lambda_function.py`
handler and invokes it through the event shim. Handlers are unchanged from Centrix.
"""

import importlib

from fastapi import APIRouter, Request

from app.event_shim import invoke

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
    )
}


# --- Client -----------------------------------------------------------------
@router.get("/clients/me")
async def get_my_client(request: Request):
    return await invoke(h["get_my_client"], request)


# --- Quotations -------------------------------------------------------------
@router.get("/quotations")
async def list_my_quotations(request: Request):
    return await invoke(h["list_my_quotations"], request)


@router.post("/quotations")
async def create_my_quotation(request: Request):
    return await invoke(h["create_my_quotation"], request)


@router.get("/quotations/{id}")
async def get_my_quotation(request: Request, id: str):
    return await invoke(h["get_my_quotation"], request, {"id": id})


@router.post("/quotations/{id}/proposals/{proposal_id}/approve")
async def approve_proposal(request: Request, id: str, proposal_id: str):
    return await invoke(h["approve_proposal"], request, {"id": id, "proposal_id": proposal_id})


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
