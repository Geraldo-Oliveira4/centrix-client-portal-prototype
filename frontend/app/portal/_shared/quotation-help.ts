// O "?" dos campos da Nova cotação (30/09/2026). Um lugar só, usado pela Nova
// cotação e pelo formulário de correção. Curto e com EXEMPLO: a dúvida de quem
// para no campo é "o que eu ponho aqui?", não a definição do termo.
//
// NCM não está aqui: o campo só existe no formulário da Cotação V2 (PR dos
// ajustes do Orsi). Quando os dois se encontrarem, acrescente o texto.

import type { ManualFormHelpField } from '../../cotacao/nova-cotacao/components/manual-form';

export const QUOTATION_HELP: Record<ManualFormHelpField, string> = {
  incoterm:
    'Quem paga e responde por cada trecho do frete. Ex.: FOB — o fornecedor entrega a carga a bordo no porto de origem, e dali em diante é com você. Está no pedido ou na proforma.',
  price_or_performance:
    'O que pesa mais na recomendação. Preço: favorece a proposta mais barata. Performance: favorece prazo e confiabilidade do agente, mesmo custando um pouco mais.',
  carga_perigosa:
    'Marque se a mercadoria tem classificação de risco (inflamável, corrosiva, baterias de lítio, aerossóis…). Confira na FISPQ/MSDS enviada pelo fornecedor.',
  un_number:
    'Número ONU da substância, com 4 dígitos, na FISPQ/MSDS. Ex.: UN1263 para tintas.',
  stackability:
    'Outras cargas podem ir por cima desta? Ex.: caixas de papelão reforçado, sim; máquinas com painel frágil, não.',
  carga_tombavel:
    'A carga pode ser deitada ou virada no manuseio? Ex.: bobinas de aço, sim; geladeiras e equipamentos com líquido, não.',
  declared_value:
    'Valor da mercadoria na invoice comercial, na moeda da invoice. Serve para o seguro e os impostos. Ex.: USD 48.000,00.',
};
