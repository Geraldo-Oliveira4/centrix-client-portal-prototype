"""Mapping of internal QuotationState values to client-facing portal buckets.

The Client Portal groups quotations by lifecycle stage as the customer
perceives it, which is coarser than the analyst-side state machine. Keep
this mapping in sync with `QuotationState`: any new state must be added
here, otherwise quotations in that state will silently disappear from
the portal listing.
"""

from shared.database.models.quotation.enums import QuotationState
from shared.observability import logger


# Buckets shown to the portal user. AGUARDANDO_DADOS is its own bucket so the
# portal can surface "Aguardando Dados" as a dedicated mini-kanban column —
# the client can act on it by replying with the missing information.
BUCKET_AGUARDANDO_DADOS = "aguardando_dados"
BUCKET_BUSCANDO_PROPOSTAS = "buscando_propostas"
BUCKET_AGUARDANDO_APROVACAO = "aguardando_aprovacao"
BUCKET_FINALIZADAS = "finalizadas"
BUCKET_CANCELADA = "cancelada"

# The three active mini-kanban columns, left-to-right.
PORTAL_BUCKET_ORDER = [
    BUCKET_AGUARDANDO_DADOS,
    BUCKET_BUSCANDO_PROPOSTAS,
    BUCKET_AGUARDANDO_APROVACAO,
]

# Every bucket the serializer must populate: the three active columns plus the
# two terminal sections ("Finalizadas" and "Canceladas") rendered below them.
# The terminal buckets are kept out of PORTAL_BUCKET_ORDER so they are not
# rendered as extra columns, but they must still be populated here or
# bucket_for() would target a missing dict key. Cancelled quotations are split
# into their own bucket so the portal can surface them separately from the
# approved/declined outcomes in "Finalizadas".
PORTAL_ALL_BUCKETS = [*PORTAL_BUCKET_ORDER, BUCKET_FINALIZADAS, BUCKET_CANCELADA]

PORTAL_BUCKET: dict[QuotationState, str] = {
    QuotationState.TRIAGEM_IA: BUCKET_BUSCANDO_PROPOSTAS,
    QuotationState.COTANDO: BUCKET_BUSCANDO_PROPOSTAS,
    QuotationState.PARA_ANALISE: BUCKET_BUSCANDO_PROPOSTAS,
    QuotationState.REVISAO_AGENTE: BUCKET_BUSCANDO_PROPOSTAS,
    QuotationState.AGUARDANDO_DADOS: BUCKET_AGUARDANDO_DADOS,
    QuotationState.ENVIADA_CLIENTE: BUCKET_AGUARDANDO_APROVACAO,
    QuotationState.APROVADA_PELO_CLIENTE: BUCKET_AGUARDANDO_APROVACAO,
    QuotationState.FECHADA: BUCKET_FINALIZADAS,
    QuotationState.DECLINADA: BUCKET_FINALIZADAS,
    QuotationState.CANCELADO: BUCKET_CANCELADA,
}


def bucket_for(state: QuotationState) -> str:
    """Return the portal bucket for a quotation state.

    Falls back to BUCKET_BUSCANDO_PROPOSTAS for unknown states (defensive —
    new states should be explicitly mapped above, but defaulting prevents
    KeyErrors from breaking the listing).
    """
    bucket = PORTAL_BUCKET.get(state)
    if bucket is None:
        logger.warning("Unknown quotation state in portal mapping: %s", state)
        return BUCKET_BUSCANDO_PROPOSTAS
    return bucket
