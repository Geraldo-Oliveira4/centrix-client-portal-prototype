// Coordenadas geográficas reais dos portos que aparecem nos nossos dados.
//
// Dado ESTÁTICO e público (posição de porto não muda), não dado proprietário e
// não integração: nada aqui depende do ShipsGo. É o que permite o mapa deixar de
// ser um SVG estilizado e passar a plotar sobre geografia de verdade.
//
// O que estas coordenadas SÃO: a posição do PORTO. O que elas NÃO são: a posição
// do navio. Enquanto o `mapPoint` do ShipsGo não existir, um embarque em trânsito
// aparece no porto de origem, parado — e é o mapa inteiro que diz isso, uma vez,
// na nota de rodapé. Ver `ShipmentMap`.

export interface Port {
  /** Chave de busca, normalizada (sem acento, minúscula). */
  key: string;
  name: string;
  country: string;
  lat: number;
  lon: number;
}

// Latitude/longitude aproximadas do terminal de cada porto (fonte: coordenadas
// públicas de porto). Precisão de cidade basta: o mapa é operacional, não é carta
// náutica.
export const PORTS: Port[] = [
  // Origens que aparecem em cotação real do cliente demo.
  { key: 'shanghai', name: 'Shanghai', country: 'China', lat: 31.23, lon: 121.47 },
  { key: 'ningbo', name: 'Ningbo', country: 'China', lat: 29.87, lon: 121.55 },
  { key: 'shenzhen', name: 'Shenzhen', country: 'China', lat: 22.55, lon: 114.06 },
  { key: 'hamburg', name: 'Hamburgo', country: 'Alemanha', lat: 53.54, lon: 9.97 },
  { key: 'rotterdam', name: 'Rotterdam', country: 'Holanda', lat: 51.95, lon: 4.14 },
  { key: 'genova', name: 'Gênova', country: 'Itália', lat: 44.4, lon: 8.92 },
  { key: 'izmir', name: 'Izmir', country: 'Turquia', lat: 38.44, lon: 27.14 },
  {
    key: 'ho chi minh',
    name: 'Ho Chi Minh',
    country: 'Vietnã',
    lat: 10.76,
    lon: 106.7,
  },
  // Demais hubs do rodízio ilustrativo (ver ILLUSTRATIVE_HUBS).
  { key: 'busan', name: 'Busan', country: 'Coreia do Sul', lat: 35.1, lon: 129.04 },
  { key: 'houston', name: 'Houston', country: 'EUA', lat: 29.75, lon: -95.28 },
  {
    key: 'los angeles',
    name: 'Los Angeles',
    country: 'EUA',
    lat: 33.74,
    lon: -118.27,
  },
  { key: 'nova york', name: 'Nova York', country: 'EUA', lat: 40.68, lon: -74.15 },
  { key: 'singapura', name: 'Singapura', country: 'Singapura', lat: 1.26, lon: 103.82 },
];

/**
 * Destino único. Toda cotação aqui é IMPORTAÇÃO para o Brasil, e `porto_destino`
 * vem NULL em todas elas — Santos é escolha nossa de representação, não um dado
 * lido da cotação. Se um dia a cotação nomear o porto de destino, é aqui que a
 * resolução passa a valer também para a ponta de chegada.
 */
export const DESTINATION_PORT: Port = {
  key: 'santos',
  name: 'Santos',
  country: 'Brasil',
  lat: -23.98,
  lon: -46.3,
};

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const BY_KEY = new Map(PORTS.map((p) => [p.key, p]));

/**
 * Porto a partir do `origin` da cotação ("Ningbo, China" -> Ningbo).
 *
 * Devolve null quando a cotação não nomeia origem OU quando nomeia um porto que
 * ainda não está na tabela. Null NÃO significa "não plotar": quem chama cai no
 * hub ilustrativo (ver `illustrativeHub`), para que um porto novo apareça no mapa
 * numa posição aproximada em vez de o embarque sumir da "visão do todo". Quando
 * o porto novo for acrescentado aqui, o mesmo embarque passa a cair no lugar
 * certo sozinho.
 */
export function portFromQuotationOrigin(
  origin: string | null | undefined,
): Port | null {
  if (!origin) return null;
  const city = normalize(origin.split(',')[0] ?? '');
  if (!city) return null;
  return BY_KEY.get(city) ?? null;
}

/**
 * Rodízio de hubs para embarque sem cotação vinculada — a maioria dos processos,
 * que o analista abriu fora do portal e que por isso não têm rota registrada em
 * lugar nenhum do schema.
 *
 * A posição é ilustrativa, escolhida de forma determinística pela referência do
 * embarque (estável entre renders). Os pontos NÃO são distinguidos dos demais na
 * tela: a nota do mapa afirma, para todos, que a posição é do porto e não do
 * navio, que é a ressalva que importa aqui.
 */
export const ILLUSTRATIVE_HUBS: Port[] = [
  'shanghai',
  'hamburg',
  'los angeles',
  'busan',
  'rotterdam',
  'nova york',
  'shenzhen',
  'genova',
  'singapura',
  'houston',
]
  .map((key) => BY_KEY.get(key))
  .filter((p): p is Port => p != null);

/**
 * Índice estável em ILLUSTRATIVE_HUBS a partir da referência do embarque. Usa o
 * sufixo numérico do EMB quando existe (para embarques sequenciais se espalharem
 * por regiões), senão um hash simples da string.
 *
 * É a MESMA função que a Lista e o detalhe usam para nomear a origem do card
 * (via `shipment-origins.ts`, que hoje é só um alias deste módulo). Uma tabela
 * só: se o mapa plotasse Hamburgo e o card dissesse Rotterdam para o mesmo
 * embarque, a tela se contradiria.
 */
export function hubIndex(reference: string): number {
  const match = reference.match(/(\d+)\s*$/);
  let n: number;
  if (match) {
    n = parseInt(match[1], 10) - 1;
  } else {
    n = 0;
    for (let i = 0; i < reference.length; i += 1) {
      n = (n * 31 + reference.charCodeAt(i)) >>> 0;
    }
  }
  const size = ILLUSTRATIVE_HUBS.length;
  return ((n % size) + size) % size;
}

export function illustrativeHub(reference: string): Port {
  return ILLUSTRATIVE_HUBS[hubIndex(reference)];
}

/**
 * Porto de origem de um embarque: o da cotação quando ela existe e nomeia um
 * porto conhecido, senão o hub ilustrativo. Uma função só, para o mapa e o
 * popover nunca discordarem sobre onde o ponto está.
 */
export function originPortOf(
  reference: string,
  quotationOrigin: string | null | undefined,
): Port {
  return portFromQuotationOrigin(quotationOrigin) ?? illustrativeHub(reference);
}
