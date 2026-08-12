// Alias de compatibilidade sobre `port-coordinates.ts`.
//
// Este módulo já foi a tabela de hubs ilustrativos do portal. Com o mapa real
// (Leaflet + OpenStreetMap) as coordenadas passaram a ser de PORTOS de verdade e
// a tabela mudou de casa; os nomes antigos continuam aqui porque a Lista e o
// detalhe do embarque nomeiam a origem por eles.
//
// O ponto de manter isto como alias, e não como uma segunda tabela: o mapa e o
// card do mesmo embarque têm de nomear o mesmo porto. Duas listas divergiriam no
// primeiro porto acrescentado a uma delas — foi para evitar exatamente isso que
// este arquivo existiu desde o começo.
//
// Ao mexer em origem/porto, edite `port-coordinates.ts`. Aqui não há dado.

export type { Port as Hub } from './port-coordinates';

export {
  ILLUSTRATIVE_HUBS as ORIGINS,
  DESTINATION_PORT as DESTINATION,
  hubIndex as originIndex,
} from './port-coordinates';
