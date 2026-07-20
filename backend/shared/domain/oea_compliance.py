"""OEA compliance helpers for freight agent dispatch validation.

Used by dispatch_rfq and add_rfq_agents to enforce the rule that clients
with exige_oea=True may only receive quotation requests from agents holding
a valid OEA certification.
"""

from datetime import date

from shared.database.repositories import client_dna_repository, quotation_repository


def agent_has_valid_oea(agent) -> bool:
    """Return True if the agent currently holds a valid OEA certification."""
    if not agent.certificacao_oea:
        return False
    if agent.data_validade_oea is None:
        return True
    return agent.data_validade_oea >= date.today()


def check_oea_compliance(
    session,
    quotation,
    agents: list,
    quotation_uuid,
    user_id: str,
    logger=None,
) -> dict | None:
    """Return a 422 error dict if any agent violates the client OEA requirement, else None.

    Logs one audit entry per blocked agent via quotation_repository.append_log.
    The caller must return the error before generating tokens or sending emails.
    """
    dna = client_dna_repository.get_by_quotation(session, quotation)
    if not dna or not dna.exige_oea:
        return None

    blocked = []
    for agent in agents:
        if not agent_has_valid_oea(agent):
            blocked.append({"id": str(agent.id), "name": agent.name})
            quotation_repository.append_log(
                session,
                quotation_id=quotation_uuid,
                action="oea_block_attempt",
                user_id=user_id,
                details={
                    "agent_id": str(agent.id),
                    "agent_name": agent.name,
                    "motivo": "Cliente exige OEA. Agente sem certificacao OEA valida.",
                    "certificacao_oea": agent.certificacao_oea,
                    "data_validade_oea": agent.data_validade_oea.isoformat() if agent.data_validade_oea else None,
                },
            )
            if logger:
                logger.warning(
                    "OEA block: agent does not meet client OEA requirement",
                    extra={
                        "agent_id": str(agent.id),
                        "quotation_id": str(quotation_uuid),
                        "client_id": str(quotation.client_id),
                    },
                )

    if not blocked:
        return None

    return {
        "error": "Bloqueado: cliente exige certificacao OEA. Os seguintes agentes nao possuem OEA valida.",
        "blocked_agents": blocked,
    }
