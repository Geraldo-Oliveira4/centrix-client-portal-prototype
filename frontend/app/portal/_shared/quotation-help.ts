// O "?" dos campos da Nova cotação (30/09/2026). Um lugar só, usado pela Nova
// cotação e pelo formulário de correção. Curto e com EXEMPLO: a dúvida de quem
// para no campo é "o que eu ponho aqui?", não a definição do termo.
//
// NCM e temperatura mínima só aparecem quando o hardblock os pede (DAP/DDP e
// carga refrigerada); o "?" vai junto.

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
  ncm:
    'Código fiscal da mercadoria, com 8 dígitos, que define os impostos no destino. Está na invoice ou com o seu despachante. Ex.: 8517.62.77.',
  temperatura_min:
    'A menor temperatura que a carga aceita durante o transporte, em °C. Ex.: -18 para congelados; 2 para resfriados.',
  declared_value:
    'Valor da mercadoria na invoice comercial, na moeda da invoice. Serve para o seguro e os impostos. Ex.: USD 48.000,00.',
};
