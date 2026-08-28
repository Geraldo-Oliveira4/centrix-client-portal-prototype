/**
 * Chave unica que liga/desliga a marcacao de proveniencia (real x ilustrativo)
 * nos DOIS cards da Comparacao de Propostas: Confiabilidade e Mercado.
 *
 * Decisao de produto de 28/08/2026: clientes reais ja estao vendo o prototipo, e
 * ali a distincao visivel estranha mais do que ajuda. Alinha esses dois cards ao
 * padrao que o Mapa segue desde o Prompt 15.
 *
 * ESCOPO. So esses dois cards. `ProvenanceBadge` continua existindo e em uso na
 * Auditoria, no Mapa e no resto do portal — nada disso muda por causa daqui. E
 * `tracking_is_mock` (Meus Embarques) nao e afetado: aquele declara rastreamento
 * de demonstracao, contrato separado e ainda obrigatorio.
 *
 * COMO REVERTER: trocar este `false` por `true`. Os selos voltam, e com eles a
 * moldura tracejada dos blocos ilustrativos — nenhum call site precisa mudar. O
 * que NAO volta pelo flag sao os rodapes que existiam so para declarar
 * proveniencia: eles foram removidos como texto, nao escondidos.
 */
export const SHOW_PROPOSAL_PROVENANCE: boolean = false;
