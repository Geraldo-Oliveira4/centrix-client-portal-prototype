"""End-to-end test suite for the client-portal prototype.

Exercises every portal endpoint against the running FastAPI backend and asserts
the exact behaviour of the original Centrix handlers: status codes, state
transitions, portal bucket mapping, privacy-field omissions, RFQ eligibility
rules, anti-enumeration 404s, and the offline mocks (local S3, no-op email).

Prerequisites:
    - A freshly seeded database (docker compose up + make migrate + make seed)
    - The backend running on http://localhost:8000 (make run)

Run:
    .venv/bin/python -m scripts.e2e_test
"""

import json
import os
import sys
import urllib.error
import urllib.request
import uuid

from dotenv import load_dotenv

load_dotenv()

BASE = os.environ.get("E2E_BASE_URL", "http://localhost:8000")

# ---------------------------------------------------------------------------
# Tiny assert framework
# ---------------------------------------------------------------------------

_results: list[tuple[bool, str, str]] = []


def check(name: str, ok: bool, detail: str = "") -> bool:
    _results.append((ok, name, detail))
    mark = "PASS" if ok else "FAIL"
    line = f"[{mark}] {name}"
    if detail and not ok:
        line += f"  -> {detail}"
    print(line)
    return ok


def req(method: str, path: str, body=None):
    url = f"{BASE}{path}"
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Content-Type": "application/json", "Authorization": "Bearer prototype"}
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r) as resp:
            raw = resp.read().decode()
            return resp.status, (json.loads(raw) if raw else {})
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            return e.code, {"_raw": raw}


def put_bytes(path: str, content: bytes):
    r = urllib.request.Request(f"{BASE}{path}", data=content, method="PUT")
    with urllib.request.urlopen(r) as resp:
        return resp.status


def get_bytes(url: str):
    with urllib.request.urlopen(url) as resp:
        return resp.status, resp.read()


# ---------------------------------------------------------------------------
# Foreign-client fixture (for ownership / anti-enumeration tests)
# ---------------------------------------------------------------------------

def _make_foreign_quotation() -> str:
    from shared.database.connection import get_session
    from shared.database.models.quotation.client import QuotationClient
    from shared.database.models.quotation.enums import ClientTier, QuotationState
    from shared.database.models.quotation.quotation import Quotation

    with get_session() as session:
        existing = (
            session.query(QuotationClient)
            .filter(QuotationClient.name == "OUTRO CLIENTE")
            .first()
        )
        if existing:
            cid = existing.id
        else:
            cid = uuid.uuid4()
            session.add(QuotationClient(
                id=cid, name="OUTRO CLIENTE", email="outro@x.local",
                company_code="OUTRO", tier=ClientTier.MANTER, is_vip=False,
            ))
            session.flush()
        qid = uuid.uuid4()
        session.add(Quotation(
            id=qid, reference=f"COT-FOREIGN-{str(qid)[:8]}",
            state=QuotationState.ENVIADA_CLIENTE, client_id=cid,
        ))
        return str(qid)


def _make_foreign_exporter() -> str:
    """An exporter owned by another client, plus a global (analyst-managed,
    client_id NULL) one. Neither may ever surface in the portal's exporter list.
    Returns the foreign client's exporter id.
    """
    from shared.database.connection import get_session
    from shared.database.models.quotation.client import QuotationClient
    from shared.database.models.quotation.enums import ClientTier, ExporterCargoProfile
    from shared.database.models.quotation.exporter import Exporter

    with get_session() as session:
        other = (
            session.query(QuotationClient)
            .filter(QuotationClient.name == "OUTRO CLIENTE")
            .first()
        )
        if other is None:
            other_id = uuid.uuid4()
            session.add(QuotationClient(
                id=other_id, name="OUTRO CLIENTE", email="outro@x.local",
                company_code="OUTRO", tier=ClientTier.MANTER, is_vip=False,
            ))
            session.flush()
        else:
            other_id = other.id

        eid = uuid.uuid4()
        session.add(Exporter(
            id=eid, client_id=other_id, name=f"EXPORTADOR RIVAL {str(eid)[:8]}",
            cargo_profile=ExporterCargoProfile.GERAL,
        ))
        session.add(Exporter(
            id=uuid.uuid4(), client_id=None,
            name=f"EXPORTADOR GLOBAL {str(uuid.uuid4())[:8]}",
            cargo_profile=ExporterCargoProfile.GERAL,
        ))
        return str(eid)


def _make_foreign_shipment() -> str:
    """A Processo + Embarque owned by another client. It must never surface in
    the portal's shipment list, and fetching it by id must 404 exactly like a
    non-existent one. Returns the foreign processo id (the portal's `id`).
    """
    from shared.database.connection import get_session
    from shared.database.models.quotation.client import QuotationClient
    from shared.database.models.quotation.enums import ClientTier
    from shared.database.models.shipment.enums import EmbarqueState
    from shared.database.repositories import (
        embarque_repository,
        processo_repository,
    )

    with get_session() as session:
        other = (
            session.query(QuotationClient)
            .filter(QuotationClient.name == "OUTRO CLIENTE")
            .first()
        )
        if other is None:
            other_id = uuid.uuid4()
            session.add(QuotationClient(
                id=other_id, name="OUTRO CLIENTE", email="outro@x.local",
                company_code="OUTRO", tier=ClientTier.MANTER, is_vip=False,
            ))
            session.flush()
        else:
            other_id = other.id

        processo = processo_repository.create(session, client_id=other_id)
        embarque_repository.create(
            session, processo_id=processo.id, estado=EmbarqueState.SOLICITADO
        )
        return str(processo.id)


# ---------------------------------------------------------------------------
# Test suite
# ---------------------------------------------------------------------------

def run():
    print(f"== E2E against {BASE} ==\n")

    # --- A. Auth / client -------------------------------------------------
    st, me = req("GET", "/portal/clients/me")
    client = me.get("client", me)
    check("A1 GET /clients/me -> 200", st == 200, str(st))
    check("A2 client has id/name/email", all(k in client for k in ("id", "name", "email")), str(client))
    check("A3 client omits internal fields (tier/is_vip/sector)",
          not any(k in client for k in ("tier", "is_vip", "sector")), str(client.keys()))

    # --- B. List / kanban (fixed-count asserts, before mutations) ---------
    st, lst = req("GET", "/portal/quotations")
    buckets = lst.get("buckets", {})
    counts = {k: len(v) for k, v in buckets.items()}
    check("B1 GET /quotations -> 200", st == 200, str(st))
    check("B2 total == 6", lst.get("total") == 6, str(lst.get("total")))
    check("B3 bucket counts match seed",
          counts == {"aguardando_dados": 0, "buscando_propostas": 1,
                     "aguardando_aprovacao": 2, "finalizadas": 2, "cancelada": 1},
          str(counts))
    check("B4 bucket_order",
          lst.get("bucket_order") == ["aguardando_dados", "buscando_propostas", "aguardando_aprovacao"],
          str(lst.get("bucket_order")))
    check("B5 summary counts",
          lst.get("summary") == {"aprovar_propostas": 2, "aguardando_propostas": 1},
          str(lst.get("summary")))
    aprov = buckets["aguardando_aprovacao"]
    card = aprov[0]
    check("B6 card has reference/state/best_proposal/proposals_count",
          all(k in card for k in ("reference", "state", "best_proposal", "proposals_count")),
          str(list(card.keys())))
    check("B7 card guard_rail_active present and False",
          card.get("guard_rail_active") is False, str(card.get("guard_rail_active")))

    enviada = [c for c in aprov if c["state"] == "ENVIADA_CLIENTE"]
    check("B8 two ENVIADA_CLIENTE cards for approve/decline", len(enviada) >= 2, str(len(enviada)))
    q_approve = enviada[0]["id"]
    q_decline = enviada[1]["id"]
    q_cotando = buckets["buscando_propostas"][0]["id"]
    fechada_card = [c for c in buckets["finalizadas"] if c["state"] == "FECHADA"][0]
    q_fechada = fechada_card["id"]

    # Terminal timestamps: the portal "Histórico" tab dates and filters closed
    # quotations by them (FECHADA -> closed_at, DECLINADA -> declined_at).
    declinada_card = [c for c in buckets["finalizadas"] if c["state"] == "DECLINADA"][0]
    check("B9 closed cards expose closed_at / declined_at",
          fechada_card.get("closed_at") is not None
          and declinada_card.get("declined_at") is not None,
          f"closed_at={fechada_card.get('closed_at')} declined_at={declinada_card.get('declined_at')}")

    # --- C. Detail --------------------------------------------------------
    st, det = req("GET", f"/portal/quotations/{q_approve}")
    q = det.get("quotation", {})
    check("C1 GET detail -> 200", st == 200, str(st))
    check("C2 detail has reference + 2 proposals", q.get("reference") and len(q.get("proposals", [])) == 2,
          f"ref={q.get('reference')} n={len(q.get('proposals', []))}")
    prop = (q.get("proposals") or [{}])[0]
    check("C3 proposal has total_brl/score/is_cheapest/is_fastest/agent",
          all(k in prop for k in ("total_brl", "score", "is_cheapest", "is_fastest", "agent")),
          str(list(prop.keys())))
    check("C4 detail omits internal fields",
          not any(k in q for k in ("analyst_id", "sender_email", "confidence_scores", "priority_score")),
          "internal field leaked")
    st, _ = req("GET", "/portal/quotations/not-a-uuid")
    check("C5 invalid uuid -> 400", st == 400, str(st))
    st, _ = req("GET", f"/portal/quotations/{uuid.uuid4()}")
    check("C6 random uuid -> 404", st == 404, str(st))

    # --- D. Recommendation ------------------------------------------------
    st, rec = req("GET", f"/portal/quotations/{q_approve}/recommendation")
    check("D1 recommendation -> 200", st == 200, str(st))
    check("D2 has recommended_proposal_id + scores",
          bool(rec.get("recommended_proposal_id")) and "scores" in rec, str(list(rec.keys())))

    # --- E. History -------------------------------------------------------
    st, hist = req("GET", f"/portal/quotations/{q_approve}/history")
    items = hist.get("items", [])
    check("E1 history -> 200", st == 200, str(st))
    check("E2 history items present, no user_id leaked",
          len(items) >= 1 and all("user_id" not in it for it in items), str(items[:1]))

    # --- F. Documents (local S3 mock) -------------------------------------
    st, up = req("POST", f"/portal/quotations/{q_approve}/documents/upload-url", {"filename": "doc.pdf"})
    check("F1 upload-url -> 200 with url+s3_key",
          st == 200 and up.get("upload_url") and up.get("s3_key"), str(up))
    content = b"%PDF-1.4 prototype test file"
    put_path = up["upload_url"].replace(BASE, "")
    put_st = put_bytes(put_path, content)
    check("F2 PUT file to local S3 -> 200", put_st == 200, str(put_st))
    gst, gbytes = get_bytes(up["upload_url"])
    check("F3 GET file back matches bytes", gst == 200 and gbytes == content, f"{gst} {len(gbytes)}b")
    st, att = req("GET", f"/portal/quotations/{q_approve}/attachments")
    names = [i.get("filename") for i in att.get("items", [])]
    check("F4 attachments lists uploaded doc", st == 200 and "doc.pdf" in names, str(names))
    st, _ = req("POST", f"/portal/quotations/{q_approve}/documents/upload-url", {"filename": "malware.exe"})
    check("F5 bad extension -> 400", st == 400, str(st))

    # --- G. Create quotation + RFQ montage/dispatch -----------------------
    # Full payload: includes the fields COTANDO_REQUIRED_FIELDS needs
    # (insurance_required, declared_value) so the quotation can advance to
    # COTANDO on dispatch — exactly what the portal form collects.
    create_body = {
        "source": "manual", "service_type": "IMPORTACAO", "modal": "MARITIMO",
        "tipo_embarque": "FCL", "incoterm": "FCA", "product": "Produto E2E",
        "origin": "Shanghai, China", "porto_destino": ["Santos"],
        "desired_deadline": "2026-09-01", "insurance_required": True,
        "declared_value": 48000, "declared_value_currency": "USD",
    }
    st, cr = req("POST", "/portal/quotations", create_body)
    newq = cr.get("quotation", {})
    new_id = newq.get("id")
    check("G1 create quotation -> 201", st == 201, str(st))
    check("G2 new quotation state TRIAGEM_IA + upload_urls present",
          newq.get("state") == "TRIAGEM_IA" and "upload_urls" in cr, str(newq.get("state")))
    st, lst2 = req("GET", "/portal/quotations")
    check("G3 total incremented to 7", lst2.get("total") == 7, str(lst2.get("total")))
    st, ag = req("GET", f"/portal/quotations/{new_id}/agents")
    agents = ag.get("agents", [])
    check("G4 agents from DNA (3), not dispatched",
          st == 200 and len(agents) == 3 and ag.get("rfq_dispatched") is False, str(len(agents)))
    two_ids = [a["id"] for a in agents[:2]]
    st, sv = req("PUT", f"/portal/quotations/{new_id}/rfq", {"agents_targeted": two_ids})
    check("G5 save RFQ -> 200 with 2 targets",
          st == 200 and len(sv.get("rfq", {}).get("agents_targeted", [])) == 2, f"{st} {sv}")
    st, bad = req("PUT", f"/portal/quotations/{new_id}/rfq", {"agents_targeted": [str(uuid.uuid4())]})
    check("G6 RFQ with agent outside pre-set list -> 422", st == 422, str(st))
    st, disp = req("POST", f"/portal/quotations/{new_id}/rfq/dispatch", {})
    check("G7 dispatch RFQ -> 200/207", st in (200, 207), f"{st} {disp}")
    st, det2 = req("GET", f"/portal/quotations/{new_id}")
    check("G8 quotation advanced to COTANDO after dispatch",
          det2.get("quotation", {}).get("state") == "COTANDO", str(det2.get("quotation", {}).get("state")))
    st, _ = req("PUT", f"/portal/quotations/{new_id}/rfq", {"agents_targeted": two_ids})
    check("G9 save RFQ after dispatch -> 409", st == 409, str(st))

    # --- H. Approve -------------------------------------------------------
    st, d = req("GET", f"/portal/quotations/{q_approve}")
    pid = d["quotation"]["proposals"][0]["id"]
    st, ap = req("POST", f"/portal/quotations/{q_approve}/proposals/{pid}/approve", {})
    apq = ap.get("quotation", {})
    # PROTOTYPE: approval auto-closes (analyst simulated) -> FECHADA, so the card
    # moves to "Aprovadas" instead of lingering in "Escolha sua proposta".
    check("H1 approve -> 200, auto-closed to FECHADA (prototype happy path)",
          st == 200 and apq.get("state") == "FECHADA", f"{st} {apq.get('state')}")
    winner = [p for p in apq.get("proposals", []) if p["id"] == pid]
    check("H2 approved proposal marked is_winner",
          bool(winner) and winner[0].get("is_winner") is True, str(winner[:1]))
    st, _ = req("POST", f"/portal/quotations/{q_approve}/proposals/{pid}/approve", {})
    check("H3 re-approve (already closed) -> 409", st == 409, str(st))
    st, _ = req("POST", f"/portal/quotations/{q_decline}/proposals/{uuid.uuid4()}/approve", {})
    check("H4 approve wrong proposal -> 404", st == 404, str(st))

    # --- I. Decline -------------------------------------------------------
    st, dc = req("POST", f"/portal/quotations/{q_decline}/decline", {"decline_reason": "PRECO"})
    check("I1 decline -> 200, state DECLINADA",
          st == 200 and dc.get("quotation", {}).get("state") == "DECLINADA",
          f"{st} {dc.get('quotation', {}).get('state')}")
    st, _ = req("POST", f"/portal/quotations/{q_cotando}/decline", {})
    check("I2 decline missing reason -> 400", st == 400, str(st))
    st, _ = req("POST", f"/portal/quotations/{q_cotando}/decline", {"decline_reason": "NOPE"})
    check("I3 decline invalid reason -> 400", st == 400, str(st))

    # --- J. Cancel --------------------------------------------------------
    st, cn = req("POST", f"/portal/quotations/{q_cotando}/cancel", {})
    check("J1 cancel COTANDO -> 200, state CANCELADO",
          st == 200 and cn.get("quotation", {}).get("state") == "CANCELADO",
          f"{st} {cn.get('quotation', {}).get('state')}")
    st, _ = req("POST", f"/portal/quotations/{q_fechada}/cancel", {})
    check("J2 cancel terminal (FECHADA) -> 409", st == 409, str(st))

    # --- K. Trigger extraction (no-op mock) -------------------------------
    st, ex = req("POST", f"/portal/quotations/{new_id}/trigger-extraction", {})
    check("K1 trigger-extraction -> 200 queued", st == 200 and ex.get("status") == "queued", str(ex))
    st, _ = req("POST", f"/portal/quotations/{uuid.uuid4()}/trigger-extraction", {})
    check("K2 trigger-extraction random uuid -> 404", st == 404, str(st))

    # --- L. Ownership / anti-enumeration ----------------------------------
    foreign = _make_foreign_quotation()
    st, _ = req("GET", f"/portal/quotations/{foreign}")
    check("L1 GET foreign quotation -> 404 (not 403)", st == 404, str(st))
    st, _ = req("POST", f"/portal/quotations/{foreign}/decline", {"decline_reason": "PRECO"})
    check("L2 decline foreign -> 404", st == 404, str(st))
    st, _ = req("POST", f"/portal/quotations/{foreign}/cancel", {})
    check("L3 cancel foreign -> 404", st == 404, str(st))
    st, _ = req("POST", f"/portal/quotations/{foreign}/proposals/{uuid.uuid4()}/approve", {})
    check("L4 approve foreign -> 404", st == 404, str(st))

    # --- M. Auth stubs ----------------------------------------------------
    st, tok = req("POST", "/portal/auth/login", {"email": "x", "password": "y"})
    check("M1 auth/login stub -> 200 token bundle",
          st == 200 and tok.get("access_token") and "user" in tok, str(list(tok.keys())))
    st, _ = req("POST", "/portal/auth/refresh-token", {"refresh_token": "x"})
    check("M2 auth/refresh-token stub -> 200", st == 200, str(st))

    # --- N. Exporters (portal self-service registration) ------------------
    st, exp_list = req("GET", "/portal/exporters")
    check("N1 GET /exporters -> 200 empty for fresh seed",
          st == 200 and exp_list.get("total") == 0, str(exp_list))

    st, created = req("POST", "/portal/exporters", {
        "name": "Exportador E2E",
        "endereco": "Rua Teste 100",
        "particularidades": "Coleta com agendamento",
        "cargo_profile": "PERIGOSA",
        "contact_email": "e2e@exportador.local",
    })
    exporter = created.get("exporter", {})
    exporter_id = exporter.get("id")
    check("N2 POST /exporters -> 201", st == 201, str(st))
    check("N3 created exporter echoes fields",
          exporter.get("name") == "Exportador E2E"
          and exporter.get("cargo_profile") == "PERIGOSA"
          and exporter.get("contact_email") == "e2e@exportador.local",
          str(exporter))
    check("N4 exporter payload omits client_id (owner never leaks)",
          "client_id" not in exporter, str(list(exporter.keys())))

    st, exp_list = req("GET", "/portal/exporters")
    check("N5 GET /exporters lists the new exporter",
          st == 200 and exp_list.get("total") == 1
          and exp_list["items"][0]["id"] == exporter_id,
          str(exp_list))

    st, _ = req("POST", "/portal/exporters", {"name": "exportador e2e"})
    check("N6 duplicate name (case-insensitive) -> 409", st == 409, str(st))
    st, _ = req("POST", "/portal/exporters", {"name": "   "})
    check("N7 blank name -> 400", st == 400, str(st))
    st, _ = req("POST", "/portal/exporters", {"name": "X", "cargo_profile": "NUCLEAR"})
    check("N8 invalid cargo_profile -> 400", st == 400, str(st))

    # Ownership: another client's exporter and the analyst-managed global rows
    # must be invisible to this portal user.
    foreign_exporter = _make_foreign_exporter()
    st, exp_list = req("GET", "/portal/exporters")
    names = [i["name"] for i in exp_list.get("items", [])]
    check("N9 foreign + global exporters excluded from list",
          st == 200 and exp_list.get("total") == 1
          and not any(n.startswith(("EXPORTADOR RIVAL", "EXPORTADOR GLOBAL")) for n in names),
          str(names))

    # Linking on quotation creation (app/quotation_exporter.py).
    st, q = req("POST", "/portal/quotations", {
        "source": "manual", "modal": "MARITIMO", "product": "Carga E2E exportador",
        "exporter_id": exporter_id,
    })
    check("N10 create quotation with own exporter -> 201 and linked",
          st == 201 and q.get("quotation", {}).get("exporter_id") == exporter_id,
          str(q.get("quotation", {}).get("exporter_id")))

    st, q = req("POST", "/portal/quotations", {
        "source": "manual", "modal": "AEREO", "product": "Carga E2E rival",
        "exporter_id": foreign_exporter,
    })
    check("N11 foreign exporter is refused but quotation still created",
          st == 201 and q.get("quotation", {}).get("exporter_id") is None,
          str(q.get("quotation", {}).get("exporter_id")))

    st, q = req("POST", "/portal/quotations", {
        "source": "manual", "modal": "AEREO", "product": "Carga E2E sem exportador",
    })
    check("N12 quotation without exporter still works -> 201",
          st == 201 and q.get("quotation", {}).get("exporter_id") is None, str(st))

    # --- O. Shipments / GE (read-only tracking) ---------------------------
    st, sh = req("GET", "/portal/shipments")
    items = sh.get("items", [])
    seeded = [i for i in items if i["referencia"].startswith("EMB-")]
    check("O1 GET /shipments -> 200 with the seeded shipments",
          st == 200 and len(seeded) >= 3, f"{st} {len(items)}")

    # The seed plants a shipment for every GE state family; every item must carry
    # a state from the real EmbarqueState enum.
    valid_states = {
        "solicitado", "aguardando_prontidao", "coletado", "analise_booking",
        "embarcado", "postergado", "booking_divergente",
    }
    check("O2 every estado belongs to EmbarqueState",
          all(i["estado"] in valid_states for i in items),
          str([i["estado"] for i in items]))

    # The enriched demo seed covers the full spread so the world map and list
    # show variety: all five happy-path states plus at least one exception.
    seeded_states = {i["estado"] for i in items}
    happy_path = {
        "solicitado", "aguardando_prontidao", "coletado",
        "analise_booking", "embarcado",
    }
    check("O2b seed covers all happy-path states + an exception",
          happy_path.issubset(seeded_states)
          and bool(seeded_states & {"postergado", "booking_divergente"}),
          str(sorted(seeded_states)))

    check("O3 by_estado counts match the item list",
          sh.get("by_estado", {}).get("embarcado", 0) >= 1
          and sum(sh.get("by_estado", {}).values()) == len(items),
          str(sh.get("by_estado")))

    # Urgent cargo sorts first (Processo.carga_urgente desc, created_at desc).
    urgent_positions = [n for n, i in enumerate(items) if i["carga_urgente"]]
    check("O4 urgent shipments sort first",
          urgent_positions == list(range(len(urgent_positions))),
          str(urgent_positions))

    # Ponte 1: approving a proposal (section H) closes the quotation, and the
    # state machine provisions a Processo + Embarque from it. That shipment must
    # now be visible to the client that approved it.
    from_approval = [i for i in items if i.get("quotation_id") == q_approve]
    check("O5 approving a quotation provisioned a visible shipment",
          len(from_approval) == 1 and from_approval[0]["estado"] == "solicitado",
          str(from_approval))

    # Internal ERP routing id is never exposed to the client.
    check("O6 inova_processo_id omitted from the portal payload",
          all("inova_processo_id" not in i for i in items), str(items[:1]))

    shipment_id = items[0]["id"]
    st, det = req("GET", f"/portal/shipments/{shipment_id}")
    ship = det.get("shipment", {})
    check("O7 GET /shipments/{id} -> 200 with detail fields",
          st == 200 and ship.get("id") == shipment_id
          and "containers" in ship and "agente" in ship,
          f"{st} {list(ship)}")

    check("O8 detail carries no transition history (none exists in the DB)",
          "history" not in ship and "timeline" not in ship, str(list(ship)))

    st, _ = req("GET", f"/portal/shipments/{uuid.uuid4()}")
    check("O9 unknown shipment -> 404", st == 404, str(st))
    st, _ = req("GET", "/portal/shipments/not-a-uuid")
    check("O10 malformed shipment id -> 400", st == 400, str(st))

    # Anti-enumeration: another client's shipment is indistinguishable from a
    # non-existent one, and never leaks into the list.
    foreign_shipment = _make_foreign_shipment()
    st, _ = req("GET", f"/portal/shipments/{foreign_shipment}")
    check("O11 foreign shipment -> 404 (anti-enumeration)", st == 404, str(st))
    st, sh2 = req("GET", "/portal/shipments")
    check("O12 foreign shipment excluded from the list",
          st == 200 and all(i["id"] != foreign_shipment for i in sh2.get("items", [])),
          str(len(sh2.get("items", []))))

    # --- P. Audit preview (MOCK, conceptual only) -------------------------
    # Guards the honesty contract of app/audit_preview.py: the quoted value is
    # real, everything derived from the fabricated "realized" value is flagged.
    st, ap1 = req("GET", f"/portal/quotations/{q_approve}/audit-preview")
    preview = ap1.get("audit_preview", {})
    check("P1 audit-preview on a closed quotation -> 200",
          st == 200 and preview.get("is_mock") is True, f"{st} {preview}")

    check("P2 every fabricated field is prefixed mock_",
          {"mock_realized_value_brl", "mock_variation_pct", "mock_difference_brl",
           "mock_divergence_detected"}.issubset(preview)
          and "realized_value_brl" not in preview,
          str(sorted(preview)))

    check("P3 quoted value comes from the winning proposal (real data)",
          preview.get("quoted_value_source") == "winning_proposal"
          and preview.get("quoted_value_brl", 0) > 0,
          str(preview.get("quoted_value_brl")))

    # The quoted value must equal the total_brl the detail screen already shows
    # for the winner — a mismatch would print two different R$ on one page.
    st, det = req("GET", f"/portal/quotations/{q_approve}")
    winner_brl = next(
        (p["total_brl"] for p in det["quotation"]["proposals"] if p.get("is_winner")),
        None,
    )
    check("P4 quoted value matches the winner total_brl on the detail screen",
          winner_brl is not None
          and abs(winner_brl - preview.get("quoted_value_brl", 0)) < 0.01,
          f"{winner_brl} vs {preview.get('quoted_value_brl')}")

    # Fabricated variation stays inside the declared band and is arithmetically
    # consistent with the quoted value.
    pct = preview.get("mock_variation_pct")
    expected_realized = round(
        preview["quoted_value_brl"] * (1 + pct / 100.0), 2
    )
    check("P5 mock variation within the -3%..+8% band and arithmetically consistent",
          -3.0 <= pct <= 8.0
          and abs(preview["mock_realized_value_brl"] - expected_realized) < 0.01,
          f"{pct} {preview.get('mock_realized_value_brl')} vs {expected_realized}")

    check("P6 divergence flag agrees with the 5% threshold",
          preview["mock_divergence_detected"] == (abs(pct) > preview["divergence_threshold_pct"]),
          f"{pct} {preview['mock_divergence_detected']}")

    check("P7 disclaimer states the value is illustrative",
          "ilustrativo" in preview.get("disclaimer", "").lower(),
          preview.get("disclaimer", ""))

    # Deterministic: same quotation, same numbers on every call. A demo that
    # reshuffles the figure on refresh reads as a live measurement.
    st, ap2 = req("GET", f"/portal/quotations/{q_approve}/audit-preview")
    check("P8 preview is deterministic across calls",
          ap2.get("audit_preview") == preview, str(ap2.get("audit_preview")))

    # Not-closed quotations have no winning proposal to compare against.
    st, _ = req("GET", f"/portal/quotations/{q_cotando}/audit-preview")
    check("P9 audit-preview on a non-closed quotation -> 409", st == 409, str(st))

    st, _ = req("GET", f"/portal/quotations/{foreign}/audit-preview")
    check("P10 audit-preview on a foreign quotation -> 404 (anti-enumeration)",
          st == 404, str(st))
    st, _ = req("GET", f"/portal/quotations/{uuid.uuid4()}/audit-preview")
    check("P11 audit-preview on an unknown quotation -> 404", st == 404, str(st))

    # The seeded closed quotation must land above the threshold, so the
    # "Divergência detectada" badge is guaranteed on screen for the demo. This
    # is why the mock is seeded from the reference (stable across seeds) and not
    # from the UUID (redrawn on every `make seed`) — see app/audit_preview.py.
    st, ap3 = req("GET", f"/portal/quotations/{q_fechada}/audit-preview")
    seeded = ap3.get("audit_preview", {})
    check("P12 seeded closed quotation deterministically shows a divergence",
          st == 200 and seeded.get("mock_divergence_detected") is True,
          f"{st} {seeded.get('mock_variation_pct')}")

    # --- Summary ----------------------------------------------------------
    passed = sum(1 for ok, _, _ in _results if ok)
    total = len(_results)
    print(f"\n== {passed}/{total} checks passed ==")
    failed = [(n, d) for ok, n, d in _results if not ok]
    if failed:
        print("\nFAILURES:")
        for n, d in failed:
            print(f"  - {n}: {d}")
        sys.exit(1)
    print("ALL PASS")


if __name__ == "__main__":
    run()
