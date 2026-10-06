// Comparativo de propostas (06/10/2026) — o modelo da tela.
//
// PURO e sem o alias `@/`: roda sob `node --test` (ver comparison-model.test.ts),
// mesma razão de `embarques/lib/delay-risk.ts`.
//
// TOTAIS SÃO CALCULADOS, NUNCA DIGITADOS. A proposta guarda os componentes
// (taxas de origem, frete internacional, taxas de destino, seguro quando
// contabilizado), cada um na moeda em que o agente cotou, e todo total da tela
// sai daqui: o "TOTAL ALL IN" por moeda e o "TOTAL EM BRL" convertido por UMA
// taxa PTAX comum à cotação. Regra confirmada pelo Mauro: o frete internacional
// é o TOTAL da proposta, nunca uma tarifa a multiplicar por kg ou m³.
//
// PLAUSIBILIDADE (melhoria futura, lado do analista): um dado real já chegou com
// a tarifa por kg digitada no campo de total (USD 1,07 de frete para uma carga
// inteira). Esta tela não tem como saber disso e não tenta adivinhar — somar e
// converter é tudo o que ela faz. Validar ordem de grandeza na entrada da
// proposta é trabalho do lado da Freitas, ainda não feito.

export type Currency = 'USD' | 'EUR' | 'BRL';

export type ShipmentType = 'LCL' | 'FCL';

export type RouteKind = 'direta' | 'transbordo';

export type Frequency = 'diaria' | 'semanal' | 'quinzenal' | 'mensal';

export interface Charge {
  label: string;
  currency: Currency;
  amount: number;
}

export interface ProposalDocument {
  name: string;
  /** Só rótulo: não há arquivo de verdade por trás (protótipo). */
  kind: 'pdf' | 'xlsx' | 'eml';
}

export interface ComparisonProposal {
  id: string;
  /** Mesmo id da fixture da Inteligência (`alpha`, `beta`...), quando existe. */
  agentId: string;
  agentName: string;
  shipmentType: ShipmentType | null;
  incoterm: string | null;
  portOfLoading: string | null;
  portOfDischarge: string | null;
  route: RouteKind | null;
  /** Porto de transbordo/conexão. Informativo: não define o desembarque. */
  transshipment: string | null;
  frequency: Frequency | null;
  freeTimeDays: number | null;
  /** Dias entre portos. */
  transitDays: number | null;
  /** Dias até a próxima saída informada pelo agente; null = sem informação. */
  departureInDays: number | null;
  carrier: string | null;
  /** Data ISO (aaaa-mm-dd). */
  validUntil: string | null;
  insuranceIncluded: boolean;
  /** Prêmio de seguro, quando o agente o contabiliza na proposta. */
  insurance: Charge | null;
  originCharges: Charge[];
  /** O frete internacional TOTAL da proposta (ver cabeçalho). */
  freightCharges: Charge[];
  destinationCharges: Charge[];
  observations: string | null;
  documents: ProposalDocument[];
  /** Pendência de auditoria de severidade alta/crítica no agente. */
  highAuditPending: boolean;
}

export interface QuotationRequest {
  reference: string;
  orderNumber: string;
  clientName: string;
  contactFirstName: string;
  service: string;
  modal: string;
  shipmentType: ShipmentType;
  origin: string;
  destination: string;
  incoterm: string;
  product: string;
  volumes: string;
  weight: string;
  exporter: string;
  countryOfOrigin: string;
  /** Data ISO até quando o link desta proposta vale. */
  linkValidUntil: string;
  /**
   * Seguro exigido nesta cotação. Rodoviário sempre exige; nos outros modais
   * depende do que foi pedido aos agentes. NÃO há regra automática por incoterm
   * nem por valor de carga — o campo é o que foi pedido, e só.
   */
  insuranceRequired: boolean;
  /** Taxas PTAX ilustrativas, comuns a todas as propostas da cotação. */
  ptax: Record<Currency, number>;
  ptaxDate: string;
  quotationDocuments: ProposalDocument[];
}

export interface ComparisonQuotation {
  request: QuotationRequest;
  proposals: ComparisonProposal[];
  /** Proposta que o cliente já aprovou, quando há. */
  chosenProposalId: string | null;
}

// --- Texto -----------------------------------------------------------------

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ccedil: 'ç',
  Ccedil: 'Ç',
  atilde: 'ã',
  Atilde: 'Ã',
  otilde: 'õ',
  Otilde: 'Õ',
  aacute: 'á',
  Aacute: 'Á',
  eacute: 'é',
  Eacute: 'É',
  iacute: 'í',
  Iacute: 'Í',
  oacute: 'ó',
  Oacute: 'Ó',
  uacute: 'ú',
  Uacute: 'Ú',
  acirc: 'â',
  Acirc: 'Â',
  ecirc: 'ê',
  Ecirc: 'Ê',
  ocirc: 'ô',
  Ocirc: 'Ô',
  agrave: 'à',
  Agrave: 'À',
};

/**
 * Decodifica entidades HTML vindas da proposta ("CONFIRMA&#199;&#195;O").
 *
 * Devolve TEXTO, nunca HTML: a tela imprime o resultado como texto do React,
 * que escapa sozinho. Por isso `&lt;script&gt;` vira o texto "<script>", não uma
 * tag. Entidade desconhecida fica como está, em vez de sumir.
 */
export function decodeText(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const decoded = raw.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
    (match, body: string) => {
      if (body[0] === '#') {
        const code =
          body[1] === 'x' || body[1] === 'X'
            ? Number.parseInt(body.slice(2), 16)
            : Number.parseInt(body.slice(1), 10);
        if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return match;
        return String.fromCodePoint(code);
      }
      return NAMED_ENTITIES[body] ?? match;
    },
  );
  const trimmed = decoded.replace(/\s+/g, ' ').trim();
  return trimmed === '' ? null : trimmed;
}

/** Valor ausente vira "—", nunca vazio nem "undefined". */
export const MISSING = '—';

export function orMissing(value: string | number | null | undefined): string {
  if (value == null) return MISSING;
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : MISSING;
  const text = decodeText(value);
  return text ?? MISSING;
}

// --- Dinheiro --------------------------------------------------------------

const NUMBER_FORMAT = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMoney(currency: Currency, amount: number): string {
  if (currency === 'BRL') return 'R$ ' + NUMBER_FORMAT.format(amount);
  return currency + ' ' + NUMBER_FORMAT.format(amount);
}

const CURRENCY_ORDER: Currency[] = ['USD', 'EUR', 'BRL'];

/** Soma por moeda, na ordem USD, EUR, BRL. Moeda sem valor não aparece. */
export function sumByCurrency(charges: Charge[]): Partial<Record<Currency, number>> {
  const out: Partial<Record<Currency, number>> = {};
  for (const charge of charges) {
    if (!Number.isFinite(charge.amount)) continue;
    out[charge.currency] = round2((out[charge.currency] ?? 0) + charge.amount);
  }
  return out;
}

/** "USD 110,07 + R$ 21,34"; "—" quando não há nada. */
export function formatMultiCurrency(sums: Partial<Record<Currency, number>>): string {
  const parts = CURRENCY_ORDER.filter((c) => sums[c] != null).map((c) =>
    formatMoney(c, sums[c] as number),
  );
  return parts.length ? parts.join(' + ') : MISSING;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Todos os componentes que compõem o total, seguro incluído quando contabilizado. */
export function allCharges(p: ComparisonProposal): Charge[] {
  return [
    ...p.originCharges,
    ...p.freightCharges,
    ...p.destinationCharges,
    ...(p.insurance ? [p.insurance] : []),
  ];
}

export interface ProposalTotals {
  origin: Partial<Record<Currency, number>>;
  freight: Partial<Record<Currency, number>>;
  destination: Partial<Record<Currency, number>>;
  allIn: Partial<Record<Currency, number>>;
  /** null quando a proposta não tem componente nenhum com valor. */
  brl: number | null;
}

export function proposalTotals(
  p: ComparisonProposal,
  ptax: Record<Currency, number>,
): ProposalTotals {
  const charges = allCharges(p).filter((c) => Number.isFinite(c.amount));
  const brl = charges.length
    ? round2(charges.reduce((n, c) => n + c.amount * ptax[c.currency], 0))
    : null;
  return {
    origin: sumByCurrency(p.originCharges),
    freight: sumByCurrency(p.freightCharges),
    destination: sumByCurrency(p.destinationCharges),
    allIn: sumByCurrency(charges),
    brl,
  };
}

// --- Datas -----------------------------------------------------------------

const DAY = 86400000;

export function parseIsoDate(iso: string): number {
  return Date.parse(iso.slice(0, 10) + 'T12:00:00Z');
}

export function addDays(iso: string, n: number): string {
  return new Date(parseIsoDate(iso) + n * DAY).toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((parseIsoDate(toIso) - parseIsoDate(fromIso)) / DAY);
}

/** Expirada = validade ANTES de hoje. Vale até o fim do próprio dia. */
export function isExpired(p: Pick<ComparisonProposal, 'validUntil'>, today: string): boolean {
  return p.validUntil != null && p.validUntil.slice(0, 10) < today;
}

/**
 * Dias úteis (seg-sex) restantes, de amanhã até a validade inclusive. Sem
 * calendário de feriados: é um critério relativo, e o mesmo erro vale para
 * todas as propostas do grupo. Validade vencida = 0.
 */
export function businessDaysUntil(validUntil: string, today: string): number {
  let count = 0;
  for (let d = addDays(today, 1); d <= validUntil; d = addDays(d, 1)) {
    const weekday = new Date(parseIsoDate(d)).getUTCDay();
    if (weekday !== 0 && weekday !== 6) count += 1;
  }
  return count;
}

const MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

export function formatLongDate(iso: string): string {
  const d = new Date(parseIsoDate(iso));
  return `${d.getUTCDate()} de ${MONTHS[d.getUTCMonth()]}`;
}

export function formatShortDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

/**
 * Chegada estimada = hoje + dias até a próxima saída (0 sem informação) +
 * transit time entre portos. null sem transit time.
 */
export function estimatedArrival(
  p: Pick<ComparisonProposal, 'transitDays' | 'departureInDays'>,
  today: string,
): { days: number; date: string } | null {
  if (p.transitDays == null) return null;
  const days = (p.departureInDays ?? 0) + p.transitDays;
  return { days, date: addDays(today, days) };
}

/** "Chega em 83d (28 de dezembro)". */
export function formatArrival(
  arrival: { days: number; date: string } | null,
): string {
  return arrival
    ? `Chega em ${arrival.days}d (${formatLongDate(arrival.date)})`
    : MISSING;
}

// --- Rótulos ---------------------------------------------------------------

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  diaria: 'Diária',
  semanal: 'Semanal',
  quinzenal: 'Quinzenal',
  mensal: 'Mensal',
};

export const ROUTE_LABELS: Record<RouteKind, string> = {
  direta: 'Direta',
  transbordo: 'Com transbordo',
};

/**
 * Nome da coluna: duas propostas do mesmo agente ganham "Opção 1 / Opção 2",
 * na ordem em que chegaram (a da fixture), não na ordem da tela — reordenar por
 * preço não pode trocar o nome de uma proposta.
 */
export function proposalLabels(
  proposals: Pick<ComparisonProposal, 'id' | 'agentId' | 'agentName'>[],
): Record<string, string> {
  const perAgent = new Map<string, string[]>();
  for (const p of proposals) {
    perAgent.set(p.agentId, [...(perAgent.get(p.agentId) ?? []), p.id]);
  }
  const out: Record<string, string> = {};
  for (const p of proposals) {
    const ids = perAgent.get(p.agentId) ?? [];
    out[p.id] =
      ids.length > 1
        ? `${p.agentName} · Opção ${ids.indexOf(p.id) + 1}`
        : p.agentName;
  }
  return out;
}

// --- Selos factuais e ordenação ---------------------------------------------

export interface FactualBadges {
  cheapest: Set<string>;
  fastest: Set<string>;
}

/**
 * "Menor preço" (menor TOTAL EM BRL) e "Menor prazo" (menor transit time).
 * São FATOS, não recomendação: saem só dos números. Empate dá o selo a todos.
 *
 * Proposta vencida não concorre: um "Menor preço" numa oferta que não pode mais
 * ser aprovada leria como a melhor opção disponível, e não é.
 */
export function factualBadges(
  proposals: ComparisonProposal[],
  ptax: Record<Currency, number>,
  today: string,
): FactualBadges {
  const live = proposals.filter((p) => !isExpired(p, today));
  const priced = live
    .map((p) => ({ id: p.id, brl: proposalTotals(p, ptax).brl }))
    .filter((x): x is { id: string; brl: number } => x.brl != null);
  const minBrl = Math.min(...priced.map((x) => x.brl));
  const timed = live.filter((p) => p.transitDays != null);
  const minTransit = Math.min(...timed.map((p) => p.transitDays as number));
  return {
    cheapest: new Set(priced.filter((x) => x.brl === minBrl).map((x) => x.id)),
    fastest: new Set(
      timed.filter((p) => p.transitDays === minTransit).map((p) => p.id),
    ),
  };
}

export type SortKey = 'preco' | 'prazo';

/**
 * Reordena as colunas. Proposta vencida vai para o fim (não pode mais ser
 * aprovada, e abrir a tabela por ela leria como a melhor opção); sem valor vai
 * para o fim; empate desempata pelo outro critério.
 */
export function sortProposals(
  proposals: ComparisonProposal[],
  ptax: Record<Currency, number>,
  key: SortKey,
  today: string,
): ComparisonProposal[] {
  const expired = (p: ComparisonProposal) => (isExpired(p, today) ? 1 : 0);
  const price = (p: ComparisonProposal) =>
    proposalTotals(p, ptax).brl ?? Number.POSITIVE_INFINITY;
  const transit = (p: ComparisonProposal) =>
    p.transitDays ?? Number.POSITIVE_INFINITY;
  const [first, second] = key === 'preco' ? [price, transit] : [transit, price];
  return [...proposals].sort(
    (a, b) =>
      expired(a) - expired(b) || first(a) - first(b) || second(a) - second(b),
  );
}

export function parseSortKey(raw: string | null | undefined): SortKey {
  return raw === 'prazo' ? 'prazo' : 'preco';
}

export type ComparisonTab = 'mapa' | 'recomendacao' | 'historico';

export const COMPARISON_TABS: { id: ComparisonTab; label: string }[] = [
  { id: 'mapa', label: 'Mapa' },
  { id: 'recomendacao', label: 'Recomendação IA' },
  { id: 'historico', label: 'Histórico do agente' },
];

export function parseTab(raw: string | null | undefined): ComparisonTab {
  return COMPARISON_TABS.some((t) => t.id === raw) ? (raw as ComparisonTab) : 'mapa';
}
