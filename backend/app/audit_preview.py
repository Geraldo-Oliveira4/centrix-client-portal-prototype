"""MOCK — Auditoria real (Camada de Auditoria de Frete/Fatura) é produto
separado, sequenciado após GE go-live. Este preview existe apenas para
visualização conceitual no debate de produto.

>>> LEIA ISTO ANTES DE REUSAR QUALQUER COISA DAQUI <<<

O que é REAL nesta resposta:
  - `quoted_value_brl` — o total em BRL da proposta vencedora, exatamente o
    mesmo número que o portal já mostra no banner "Cotação aprovada"
    (`serialize_proposal_for_portal` -> `total_brl`). Vem de
    `centrix_quotation_proposals`.

O que é INVENTADO:
  - `mock_realized_value_brl` e tudo que deriva dele. NÃO existe valor
    realizado em lugar nenhum deste repositório: não há fatura, não há BL, não
    há tabela de custo efetivo. O número é uma variação determinística derivada
    do hash do id da cotação — reproduzível entre requests (a mesma cotação
    sempre mostra o mesmo valor, senão a demo pisca a cada refresh), mas sem
    qualquer relação com a realidade.

Por isso este arquivo vive em `app/` (camada do protótipo) e não em
`lambdas/client_portal/`, onde ficam os handlers reais copiados/portados do
Centrix. Um endpoint que fabrica número não pertence ao mesmo lugar que os
handlers de produção; a separação de diretório é parte do aviso. Toda chave
fabricada da resposta carrega o prefixo `mock_`, e `is_mock: true` vai no topo
do payload para que nenhum consumidor possa tratar isto como auditoria.

Nenhuma tabela nova foi criada: o cálculo é em memória a partir da proposta
vencedora que já existe.
"""

import hashlib

from shared.database.connection import get_session
from shared.database.models.quotation.enums import QuotationState
from shared.database.repositories import proposal_repository
from shared.domain.recommendation_service import (
    normalize_proposal_cost_to_brl,
    resolve_comparison_ptax,
)
from shared.lambda_helpers import build_response, parse_path_uuid
from shared.observability import logger
from shared.portal_helpers import get_portal_client_id, load_owned_quotation

# Acima deste percentual de diferença a UI acende o selo "Divergência detectada".
DIVERGENCE_THRESHOLD_PCT = 5.0

# Faixa da variação fabricada, em pontos percentuais sobre o valor cotado.
# Assimétrica de propósito: no debate de produto o caso interessante é o custo
# estourar, então a cauda positiva é maior que a negativa.
_MOCK_MIN_PCT = -3.0
_MOCK_MAX_PCT = 8.0

DISCLAIMER = (
    "Valor estimado — dado ilustrativo. Não há valor realizado (fatura/BL) neste "
    "protótipo: este número é gerado para visualização conceitual da futura "
    "Camada de Auditoria de Frete/Fatura."
)


def _mock_variation_pct(seed: str) -> float:
    """Variação fabricada, determinística por cotação, dentro da faixa acima.

    MOCK. O hash serve só para espalhar as cotações pela faixa de forma estável
    — não modela nada. Duas casas decimais para o número parecer um percentual
    de verdade na tela sem fingir precisão maior que isso.

    A semente é a `reference` (COT-YYYY-NNNN), não o UUID: a referência é
    estável entre execuções do seed, então a demo mostra sempre os mesmos
    percentuais — inclusive a cotação semeada como FECHADA (COT-2026-0004)
    caindo acima do limite de divergência. Semeando pelo UUID, que é sorteado a
    cada `make seed`, o selo "Divergência detectada" apareceria ou não por
    acaso, e a tela que existe para ser debatida hoje poderia nunca aparecer.
    """
    digest = hashlib.sha256(seed.encode()).hexdigest()
    steps = int(digest[:8], 16)
    span_in_hundredths = int((_MOCK_MAX_PCT - _MOCK_MIN_PCT) * 100) + 1
    return round(_MOCK_MIN_PCT + (steps % span_in_hundredths) / 100.0, 2)


def build_audit_preview(seed: str, quoted_value_brl: float) -> dict:
    """Monta o comparativo. `quoted_value_brl` é real; o resto é fabricado."""
    variation_pct = _mock_variation_pct(seed)
    realized = round(quoted_value_brl * (1 + variation_pct / 100.0), 2)
    difference = round(realized - quoted_value_brl, 2)

    return {
        "is_mock": True,
        "disclaimer": DISCLAIMER,
        # Real — proposta vencedora.
        "quoted_value_brl": round(quoted_value_brl, 2),
        "quoted_value_source": "winning_proposal",
        # Fabricado — prefixo mock_ em tudo que não tem lastro.
        "mock_realized_value_brl": realized,
        "mock_variation_pct": variation_pct,
        "mock_difference_brl": difference,
        "mock_divergence_detected": abs(variation_pct) > DIVERGENCE_THRESHOLD_PCT,
        "divergence_threshold_pct": DIVERGENCE_THRESHOLD_PCT,
    }


def lambda_handler(event, context):
    """GET /portal/quotations/{id}/audit-preview

    Assinatura de handler Lambda para rodar pelo mesmo shim dos handlers reais
    (posse, 404 anti-enumeração e códigos de erro idênticos), mas sem morar
    junto deles — ver docstring do módulo.

    Status codes:
        200 — { audit_preview: {...} }
        400 — id malformado
        401 — JWT ausente
        403 — não é usuário do portal
        404 — cotação inexistente OU de outro cliente
        409 — cotação não está FECHADA, ou não tem proposta vencedora
        500 — erro interno
    """
    try:
        quotation_id, err = parse_path_uuid(event, "id")
        if err:
            return err

        with get_session() as session:
            client_id, err = get_portal_client_id(event, session)
            if err:
                return err

            quotation, err = load_owned_quotation(session, quotation_id, client_id)
            if err:
                return err

            # A tela só oferece a seção em cotação fechada; isto é a retaguarda.
            if quotation.state != QuotationState.FECHADA:
                return build_response(
                    409, {"error": "Audit preview is only available for closed quotations"}
                )

            winner = proposal_repository.get_winner(session, quotation.id)
            if winner is None:
                return build_response(409, {"error": "Quotation has no winning proposal"})

            # Mesma conversão que `serialize_proposal_for_portal` usa para o
            # `total_brl` exibido no banner "Cotação aprovada" — inclusive a
            # lista vazia de propostas no resolve. Reproduzir a chamada garante
            # que o valor cotado aqui bata com o que o cliente já viu na tela;
            # divergir dela seria um bug visível de R$ na mesma página.
            ptax = resolve_comparison_ptax(quotation, [])
            quoted_value_brl = normalize_proposal_cost_to_brl(winner, ptax_override=ptax)

            preview = build_audit_preview(
                quotation.reference or str(quotation.id), quoted_value_brl
            )

        return build_response(200, {"audit_preview": preview})

    except Exception:
        logger.exception("Unhandled error")
        return build_response(500, {"error": "Internal server error"})
