"""Prototype-only flow simplifications.

>>> LEIA ISTO (para o time/Claude do cliente) <<<

No Centrix de produção, quando o cliente aprova uma proposta pelo portal, a
cotação vai para o estado APROVADA_PELO_CLIENTE e **para ali**, aguardando um
analista da Freitas revisar e fechar (é o ponto do "guard rail" — ARB-2449).
Por isso, no fluxo real, o card continua na coluna "Escolha sua proposta"
mesmo depois do cliente aprovar.

Neste PROTÓTIPO simulamos o "happy path": assim que o cliente aprova, fazemos
automaticamente o papel do analista aprovando/fechando a cotação
(APROVADA_PELO_CLIENTE -> FECHADA). Assim o card anda para "Aprovadas" e o
fluxo segue em frente, sem precisar de um backoffice de analista.

O que fica de fora de propósito (simplificado nesta versão):
  - O guard rail da Freitas (retenção para revisão de alto valor / bloqueio).
  - Qualquer etapa manual do analista entre a escolha do cliente e o
    fechamento da cotação.

Nada disso altera os handlers originais do Centrix (em `lambdas/`): a
auto-aprovação vive só aqui, na camada do protótipo, e é chamada pelo router
depois que o handler de aprovação do cliente roda com sucesso.
"""

import uuid

from shared.database.connection import get_session
from shared.database.models.quotation.enums import QuotationState
from shared.database.repositories import quotation_repository
from shared.domain import quotation_state_machine

# Ator fictício usado no log de auditoria para as transições que, no fluxo real,
# seriam feitas por um analista da Freitas.
PROTOTYPE_ANALYST_ACTOR = "prototype-analyst"

# Ação registrada no histórico da cotação para a aprovação automática. O
# histórico do portal já mostra a entrada porque FECHADA é um marco visível ao
# cliente (ver serialize_client_history em shared/portal_helpers.py), então o
# cliente vê a cotação como aprovada/finalizada pela Freitas.
AUTO_APPROVE_ACTION = "analyst_auto_approved_selection"


def auto_close_approved_quotation(quotation_id: str) -> bool:
    """Simula o analista aprovando: APROVADA_PELO_CLIENTE -> FECHADA.

    Chamada logo após o handler `approve_proposal` do cliente ter sucesso. Só
    age se a cotação estiver realmente em APROVADA_PELO_CLIENTE (idempotente e
    seguro se for chamada por engano). Retorna True se fechou a cotação.
    """
    qid = uuid.UUID(quotation_id)
    with get_session() as session:
        quotation = quotation_repository.get(session, qid, for_update=True)
        if quotation is None or quotation.state != QuotationState.APROVADA_PELO_CLIENTE:
            return False

        # A transição para FECHADA não exige contexto quando vem de
        # APROVADA_PELO_CLIENTE (o winning_agent_id já foi gravado na aprovação
        # do cliente) e dispara o provisionamento de GE (Processo + Embarque),
        # tudo dentro desta mesma transação local.
        result = quotation_state_machine.transition(
            session,
            quotation,
            QuotationState.FECHADA,
            PROTOTYPE_ANALYST_ACTOR,
            action=AUTO_APPROVE_ACTION,
        )
        return bool(result.get("success"))
