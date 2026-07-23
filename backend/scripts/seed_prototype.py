"""Seed the prototype database with a demo client and sample quotations.

Creates:
  - 1 demo QuotationClient + 1 PortalUser (mapped to the auto-login DEMO_SUB)
  - 3 freight agents
  - 1 import DNA with those agents as default_agents (needed for RFQ montage)
  - ~6 quotations spanning the portal kanban buckets, some with proposals + scores
  - 7 shipments covering every GE state (5 happy-path + 2 exceptions), so the
    "Meus Embarques" list and its illustrative world map show a full spread of
    states and origin regions.

ALL data here is fictional and exists purely to demonstrate the prototype. No
real Freitas client, cargo or route is represented; the shipment origins are
suggested only in free-text notes and the map positions are approximate.

Idempotent: if the demo client already exists, the script exits without changes.

Usage (from backend/):
    make seed
    # or
    .venv/bin/python -m scripts.seed_prototype
"""

import os
import uuid
from datetime import date, datetime, timedelta, timezone

from dotenv import load_dotenv

load_dotenv()

from shared.database.connection import get_session
from shared.database.models.portal_user import PortalUser
from shared.database.models.quotation.client import QuotationClient
from shared.database.models.quotation.client_dna import QuotationClientDna
from shared.database.models.quotation.enums import (
    ClientTier,
    Currency,
    DeclineReason,
    InsuranceResponsibility,
    Modal,
    QuotationState,
    RouteType,
    ServiceType,
    TipoEmbarque,
)
from shared.database.models.quotation.freight_agent import FreightAgent
from shared.database.models.quotation.proposal import Proposal
from shared.database.models.quotation.proposal_score import ProposalScore
from shared.database.models.quotation.quotation import Quotation
from shared.database.models.quotation.quotation_log import QuotationLog
from shared.database.models.shipment.enums import EmbarqueState, TipoDespacho
from shared.database.repositories import embarque_repository, processo_repository

DEMO_SUB = os.environ.get("DEMO_PORTAL_SUB", "demo-portal-user-sub")
DEMO_EMAIL = os.environ.get("DEMO_PORTAL_EMAIL", "demo@cliente.local")
DEMO_CLIENT_NAME = "CLIENTE DEMO"

_now = datetime.now(timezone.utc)


def _agent(name: str, email: str) -> FreightAgent:
    return FreightAgent(
        id=uuid.uuid4(),
        name=name,
        email=email,
        preferred_channel="email",
        reliability_score=100.0,
        total_quotations=0,
        error_count=0,
    )


def _log(quotation_id, action: str, new_state: str, details: dict | None = None) -> QuotationLog:
    return QuotationLog(
        id=uuid.uuid4(),
        quotation_id=quotation_id,
        action=action,
        previous_state=None,
        new_state=new_state,
        user_id=DEMO_SUB,
        details=details,
    )


class _Ref:
    """Sequential COT-2026-000N reference generator."""

    def __init__(self):
        self.n = 0

    def next(self) -> str:
        self.n += 1
        return f"COT-2026-{self.n:04d}"


def _quotation(ref: str, client_id, state: QuotationState, product: str, origin: str,
               **extra) -> Quotation:
    return Quotation(
        id=uuid.uuid4(),
        reference=ref,
        state=state,
        service_type=ServiceType.IMPORTACAO,
        modal=Modal.MARITIMO,
        tipo_embarque=TipoEmbarque.FCL,
        origin=origin,
        product=product,
        client_id=client_id,
        data_cotacao=date.today(),
        desired_deadline=_now + timedelta(days=15),
        declared_value=48000.0,
        declared_value_currency=Currency.USD,
        incoterm="FOB",
        **extra,
    )


def _proposal(quotation_id, agent_id, total, freight, transit, *, is_winner=False) -> Proposal:
    return Proposal(
        id=uuid.uuid4(),
        quotation_id=quotation_id,
        agent_id=agent_id,
        total_value=total,
        freight_value=freight,
        taxes_breakdown={"THC": 180.0, "ISPS": 45.0},
        transit_time=transit,
        route_type=RouteType.DIRETA,
        carrier="Maersk",
        validity=date.today() + timedelta(days=20),
        freight_currency="USD",
        numero_oferta=f"OF-{str(agent_id)[:4].upper()}",
        frequencia="Semanal",
        ptax_percentual=2.0,
        is_winner=is_winner,
    )


def _score(quotation_id, proposal, *, cost, transit, rank) -> ProposalScore:
    return ProposalScore(
        id=uuid.uuid4(),
        quotation_id=quotation_id,
        proposal_id=proposal.id,
        is_eligible=True,
        cost_score=cost,
        transit_score=transit,
        validity_score=90.0,
        frequency_score=80.0,
        route_score=100.0,
        free_time_score=50.0,
        total_score=round(cost * 0.4 + transit * 0.3 + 90 * 0.3, 2),
        validade_status="ok",
        posicao_ranking=rank,
    )


def seed() -> None:
    with get_session() as session:
        existing = (
            session.query(QuotationClient)
            .filter(QuotationClient.name == DEMO_CLIENT_NAME)
            .first()
        )
        if existing is not None:
            print("Demo client already present — skipping seed.")
            return

        # --- Client + agents (flush so FKs from portal_user/quotations resolve)
        client_id = uuid.uuid4()
        session.add(QuotationClient(
            id=client_id,
            name=DEMO_CLIENT_NAME,
            email=DEMO_EMAIL,
            company_code="DEMO",
            tier=ClientTier.MANTER,
            is_vip=False,
        ))
        agents = [
            _agent("AGENTE ALPHA", "alpha@agentes.local"),
            _agent("AGENTE BETA", "beta@agentes.local"),
            _agent("AGENTE GAMMA", "gamma@agentes.local"),
        ]
        for a in agents:
            session.add(a)
        session.flush()

        # --- Portal user (auto-login target) -------------------------------
        session.add(PortalUser(
            id=DEMO_SUB,
            email=DEMO_EMAIL,
            name="Cliente Demo",
            client_id=client_id,
        ))

        # --- DNA (import) with default agents for RFQ montage --------------
        session.add(QuotationClientDna(
            id=uuid.uuid4(),
            client_id=client_id,
            service_type=ServiceType.IMPORTACAO,
            modality=Modal.MARITIMO,
            tipo_embarque=TipoEmbarque.FCL,
            default_agents=[str(a.id) for a in agents],
            insurance_responsibility=InsuranceResponsibility.FREITAS,
            quotation_particularities="Cliente demo do protótipo.",
            contact_name="Cliente Demo",
            contact_email=DEMO_EMAIL,
            updated_at=_now,
        ))

        ref = _Ref()

        # These models use bare ForeignKey columns (no ORM relationship), so the
        # SQLAlchemy unit of work does not derive an insert order between them.
        # Insert each dependency level explicitly: quotations -> proposals ->
        # scores/logs, flushing between levels.

        q1 = _quotation(ref.next(), client_id, QuotationState.ENVIADA_CLIENTE,
                        "Peças industriais", "Shanghai, China",
                        sent_at=_now - timedelta(days=1))
        q2 = _quotation(ref.next(), client_id, QuotationState.COTANDO,
                        "Equipamentos médicos", "Hamburg, Germany")
        q3 = _quotation(ref.next(), client_id, QuotationState.ENVIADA_CLIENTE,
                        "Tecidos", "Genova, Italy", sent_at=_now - timedelta(days=2))
        q4 = _quotation(ref.next(), client_id, QuotationState.FECHADA,
                        "Máquinas", "Ningbo, China",
                        winning_agent_id=agents[0].id, closed_at=_now)
        q5 = _quotation(ref.next(), client_id, QuotationState.DECLINADA,
                        "Produtos químicos", "Rotterdam, Netherlands",
                        decline_reason=DeclineReason.PRECO, declined_at=_now)
        q6 = _quotation(ref.next(), client_id, QuotationState.CANCELADO,
                        "Amostras", "Busan, South Korea")
        session.add_all([q1, q2, q3, q4, q5, q6])
        session.flush()

        # Proposals (level 2)
        p1a = _proposal(q1.id, agents[0].id, 3200.0, 2800.0, 32)
        p1b = _proposal(q1.id, agents[1].id, 3600.0, 3100.0, 28)
        p2 = _proposal(q2.id, agents[0].id, 4200.0, 3700.0, 30)
        p3a = _proposal(q3.id, agents[1].id, 2900.0, 2500.0, 26)
        p3b = _proposal(q3.id, agents[2].id, 3100.0, 2700.0, 24)
        p4 = _proposal(q4.id, agents[0].id, 5100.0, 4400.0, 35, is_winner=True)
        p5 = _proposal(q5.id, agents[2].id, 6100.0, 5200.0, 40)
        session.add_all([p1a, p1b, p2, p3a, p3b, p4, p5])
        session.flush()

        # Scores + logs (level 3)
        session.add_all([
            _score(q1.id, p1a, cost=100.0, transit=70.0, rank=1),
            _score(q1.id, p1b, cost=80.0, transit=100.0, rank=2),
            _score(q3.id, p3a, cost=100.0, transit=80.0, rank=1),
            _score(q3.id, p3b, cost=85.0, transit=100.0, rank=2),
        ])
        session.add_all([
            _log(q1.id, "created", "TRIAGEM_IA"),
            _log(q1.id, "proposal_received", "COTANDO",
                 {"agent_name": agents[0].name, "freight_value": 2800.0, "freight_currency": "USD"}),
            _log(q2.id, "created", "TRIAGEM_IA"),
            _log(q3.id, "created", "TRIAGEM_IA"),
            _log(q4.id, "client_approved_proposal", "APROVADA_PELO_CLIENTE",
                 {"agent_name": agents[0].name}),
            _log(q5.id, "client_declined_quotation", "DECLINADA", {"decline_reason": "PRECO"}),
            _log(q6.id, "client_cancelled_quotation", "CANCELADO"),
        ])

        # --- Shipments / GE (level 4) --------------------------------------
        # Without these the "Meus Embarques" screen is empty on a fresh demo:
        # shipments are only provisioned when the client approves a proposal
        # (quotation_state_machine -> provision_processo_from_quotation), and the
        # seed writes quotation rows directly, bypassing the state machine.
        #
        # Only q4 is FECHADA, so only the first shipment carries a quotation_id.
        # Every other shipment is left unlinked (Processo.quotation_id is nullable
        # by design) rather than promoting more quotations to FECHADA, which would
        # shift the portal bucket counts the e2e suite asserts. They stand for
        # processes the analyst opened outside the portal — a real case, and the
        # only way to show every state at once in the progress indicator.
        #
        # All fictional demo data. The whole spread exists so the "Meus Embarques"
        # list and the illustrative world map above it have variety to show: the
        # five happy-path states (solicitado -> embarcado), plus both exception
        # states (postergado, booking_divergente), across a few origin regions
        # (Asia, Europe, North America). The map pins each shipment to an
        # approximate export hub derived from its EMB reference — the regions
        # named in the notes below are illustrative, not stored coordinates.
        shipments = [
            # (quotation_id, agent, estado, carga_urgente, containers, observacao)
            (q4.id, agents[0], EmbarqueState.EMBARCADO, False,
             [{"numero": "MSKU7412589", "tipo": "40HC", "tara": 3750}],
             "Embarcado no navio MAERSK SELETAR, com origem na Asia (Shanghai)."),
            (None, agents[1], EmbarqueState.AGUARDANDO_PRONTIDAO, True,
             None, "Aguardando prontidao da carga na origem, na Europa (Hamburgo)."),
            (None, agents[2], EmbarqueState.BOOKING_DIVERGENTE, False,
             [{"numero": "TCLU9983261", "tipo": "20GP", "tara": 2200}],
             "Booking divergente do aprovado — em tratativa com o armador "
             "(rota da America do Norte, Los Angeles)."),
            (None, agents[0], EmbarqueState.SOLICITADO, False,
             None, "Embarque aberto — coletando dados de booking na Asia (Busan)."),
            (None, agents[1], EmbarqueState.COLETADO, False,
             [{"numero": "HLCU4471902", "tipo": "40GP", "tara": 3680}],
             "Carga coletada, seguindo para o porto de embarque na Europa "
             "(Roterda)."),
            (None, agents[2], EmbarqueState.ANALISE_BOOKING, True,
             [{"numero": "CMAU5590017", "tipo": "40HC", "tara": 3800}],
             "Conferindo os dados do booking com o armador — rota da America do "
             "Norte (Nova York)."),
            (None, agents[0], EmbarqueState.POSTERGADO, False,
             None, "Embarque postergado pelo armador — reprogramando a saida na "
             "Asia (Shenzhen)."),
        ]
        for age, (quotation_id, agent, estado, urgente, containers, observacao) in enumerate(
            shipments
        ):
            processo = processo_repository.create(
                session,
                client_id=client_id,
                quotation_id=quotation_id,
                incoterm="FOB",
                modal=Modal.MARITIMO,
                tipo_embarque=TipoEmbarque.FCL,
                tipo_despacho=TipoDespacho.DIRETO,
                carga_urgente=urgente,
                agente_id=agent.id,
                containers=containers,
                observacao=observacao,
            )
            # created_at defaults to now() for every row in this transaction, which
            # would leave the list ordering (urgent first, then newest first) to
            # chance. Stagger it so the demo list is deterministic.
            processo.created_at = _now - timedelta(days=age)
            embarque_repository.create(
                session, processo_id=processo.id, estado=estado
            )

        print(
            f"Seeded demo client {client_id} with 6 quotations, 3 agents "
            f"and {len(shipments)} shipments."
        )


if __name__ == "__main__":
    seed()
