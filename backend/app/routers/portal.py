"""Routes for the client-portal business handlers.

Each route loads the corresponding `lambdas/client_portal/<name>/lambda_function.py`
handler and invokes it through the event shim. Handlers are unchanged from Centrix.
"""

import importlib
import json

from fastapi import APIRouter, Request, Response

from app.agent_pause import filter_paused_agents
from app.audit_preview import lambda_handler as audit_preview_handler
from app.event_shim import invoke
from app.home_layout_experiment import (
    delete_layout as home_layout_delete,
    get_layout as home_layout_get,
    put_layout as home_layout_put,
)
from app.prototype_flow import auto_close_approved_quotation
from app.quotation_exporter import link_exporter
from app.quotation_origin import annotate as annotate_origins, record_origin

router = APIRouter(prefix="/portal", tags=["portal"])


def _rewrite(resp: Response, payload) -> Response:
    """Devolve a mesma resposta com o corpo já alterado pela camada do protótipo."""
    return Response(
        content=json.dumps(payload),
        status_code=resp.status_code,
        media_type="application/json",
    )


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
        "list_my_agents",
        "get_my_preferences",
        "update_my_preferences",
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


# --- Agents e preferências (novos no protótipo) ------------------------------
# Não existem no Centrix: lá o cliente não tem tela de agentes nem edita o
# próprio perfil de operação. Ver as docstrings dos handlers e a migração 094.
@router.get("/agents")
async def list_my_agents(request: Request):
    return await invoke(h["list_my_agents"], request)


@router.get("/preferences")
async def get_my_preferences(request: Request):
    return await invoke(h["get_my_preferences"], request)


@router.put("/preferences")
async def update_my_preferences(request: Request):
    return await invoke(h["update_my_preferences"], request)


# --- Quotations -------------------------------------------------------------
@router.get("/quotations")
async def list_my_quotations(request: Request):
    resp = await invoke(h["list_my_quotations"], request)
    if resp.status_code != 200:
        return resp
    payload = json.loads(resp.body)
    cards = [card for bucket in payload.get("buckets", {}).values() for card in bucket]
    annotate_origins(cards)
    return _rewrite(resp, payload)


@router.post("/quotations")
async def create_my_quotation(request: Request):
    body = await request.json() if await request.body() else {}
    resp = await invoke(h["create_my_quotation"], request)
    if resp.status_code != 201 or not isinstance(body, dict):
        return resp

    payload = json.loads(resp.body)
    quotation = payload["quotation"]
    changed = False

    # The copied handler ignores exporter_id (Centrix attaches the exporter later,
    # via the analyst). Link it here so the portal's "select exporter" step on the
    # new-quotation form actually persists. See app/quotation_exporter.py.
    exporter_id = body.get("exporter_id")
    if exporter_id and link_exporter(quotation["id"], exporter_id):
        quotation["exporter_id"] = exporter_id
        changed = True

    # De onde veio o clique (hoje: o CTA "Cotar agora" do Radar de Preços). É uma
    # dimensão A MAIS que a tag "portal", nunca no lugar dela — a cotação
    # continua sendo `quotation_created_by_portal` para todo o resto do sistema.
    # Ver app/quotation_origin.py.
    recorded = record_origin(
        quotation["id"], body.get("portal_origin"), body.get("portal_origin_route")
    )
    if recorded:
        quotation["portal_origin"] = recorded["origin"]
        if recorded["route"]:
            quotation["portal_origin_route"] = recorded["route"]
        changed = True

    return _rewrite(resp, payload) if changed else resp


@router.get("/quotations/{id}")
async def get_my_quotation(request: Request, id: str):
    resp = await invoke(h["get_my_quotation"], request, {"id": id})
    if resp.status_code != 200:
        return resp
    payload = json.loads(resp.body)
    annotate_origins([payload.get("quotation", {})])
    return _rewrite(resp, payload)


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
    # O handler copiado devolve todos os agentes pré-aprovados no DNA. O filtro
    # de pausados entra depois dele, no `app/` — é o que torna o toggle de "Meus
    # Agentes" real em vez de decorativo. Ver `app/agent_pause.py`.
    response = await invoke(h["list_quotation_agents"], request, {"id": id})
    return filter_paused_agents(request, response)


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


# --- Home personalizavel (EXPERIMENTO INTERNO) ------------------------------
# Rota de demonstracao interna, SEPARADA da Home real (`/portal/home`), que nao
# passa por aqui e nao sabe que isto existe. Handler em
# `app/home_layout_experiment.py` — ver a docstring de la para por que o
# experimento nao mora em `lambdas/client_portal/` nem reaproveita
# `/portal/preferences`.
@router.get("/home-layout-experiment")
async def get_my_home_layout(request: Request):
    return await invoke(home_layout_get, request)


@router.put("/home-layout-experiment")
async def update_my_home_layout(request: Request):
    return await invoke(home_layout_put, request)


@router.delete("/home-layout-experiment")
async def reset_my_home_layout(request: Request):
    return await invoke(home_layout_delete, request)
