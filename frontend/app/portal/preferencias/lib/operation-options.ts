// Opções dos selects do perfil de operação (Minhas Preferências).
//
// São listas de CONVENIÊNCIA, não catálogo: o backend grava texto livre nas
// colunas `preferred_port` e `default_incoterm` (migração 094) e não valida
// contra nenhuma delas. Não existe tabela de portos nem enum de incoterm no
// schema do portal, e fingir uma validação que o backend não faz seria pior do
// que assumir a lista curta.
//
// Por isso a regra ao mexer aqui: acrescentar item é seguro; REMOVER um item que
// algum cliente já salvou deixa o valor gravado fora do select e o campo
// aparecerá vazio na tela — o dado continua no banco, mas some da vista.

/** Portos e aeroportos mais usados nas operações da Freitas COMEX. */
export const PORT_OPTIONS = [
  'Santos (BRSSZ)',
  'Paranaguá (BRPNG)',
  'Itapoá (BRIOA)',
  'Itajaí (BRITJ)',
  'Navegantes (BRNVT)',
  'Rio Grande (BRRIG)',
  'Rio de Janeiro (BRRIO)',
  'Suape (BRSUA)',
  'Salvador (BRSSA)',
  'Manaus (BRMAO)',
  'Aeroporto de Guarulhos (BRGRU)',
  'Aeroporto de Viracopos (BRVCP)',
];

/** Incoterms 2020. `value` é o que vai para o banco. */
export const INCOTERM_OPTIONS = [
  { value: 'EXW', label: 'EXW — Ex Works' },
  { value: 'FCA', label: 'FCA — Free Carrier' },
  { value: 'FAS', label: 'FAS — Free Alongside Ship' },
  { value: 'FOB', label: 'FOB — Free On Board' },
  { value: 'CFR', label: 'CFR — Cost and Freight' },
  { value: 'CIF', label: 'CIF — Cost, Insurance and Freight' },
  { value: 'CPT', label: 'CPT — Carriage Paid To' },
  { value: 'CIP', label: 'CIP — Carriage and Insurance Paid To' },
  { value: 'DAP', label: 'DAP — Delivered At Place' },
  { value: 'DPU', label: 'DPU — Delivered at Place Unloaded' },
  { value: 'DDP', label: 'DDP — Delivered Duty Paid' },
];
