/**
 * Submódulos da Inteligência no menu lateral (v4, revisão de 13/11/2026).
 *
 * As cinco abas que viviam DENTRO do iframe (Visão geral, Exportadores, Agentes
 * de carga, Rotas, Simulador) viraram itens do menu do portal. O destino de cada
 * um é o MESMO hash que a aba tinha — `#executivo` e `#executivo?aba=<id>` —,
 * então todo deep link antigo continua abrindo a mesma coisa.
 *
 * PURO (roda sob `node --test`): recebe pathname e hash, devolve o submódulo
 * ativo e o hash de destino. Quem lê `window.location` é a sidebar.
 *
 * A regra de leitura espelha a do protótipo (`intel-tabs.js::readTab` e
 * `LEGACY_SECTION_TAB`): mexeu lá, mexa aqui — o teste trava os casos.
 */

export type IntelSubmoduleId = 'geral' | 'exportadores' | 'agentes' | 'rotas' | 'simulador';

export interface IntelSubmodule {
  id: IntelSubmoduleId;
  label: string;
  /** Selo "Prévia" ao lado do rótulo (só o Simulador). */
  preview?: boolean;
}

/** Ordem fixa do menu. */
export const INTEL_SUBMODULES: IntelSubmodule[] = [
  { id: 'geral', label: 'Visão geral' },
  { id: 'exportadores', label: 'Exportadores' },
  { id: 'agentes', label: 'Agentes de carga' },
  { id: 'rotas', label: 'Rotas' },
  { id: 'simulador', label: 'Simulador', preview: true },
];

export const INTEL_BASE_PATH = '/portal/inteligencia';

/** Seções do iframe que desenham a página de abas (o `OVERVIEW` de app.js). */
const OVERVIEW_SECTIONS = new Set([
  'executivo',
  'performance',
  'exportadores',
  'agentes',
  'compromissos',
  'rotas',
  'assistentes',
]);
/** Hashes antigos de bloco que abrem a aba equivalente (`LEGACY_SECTION_TAB`). */
const LEGACY_SECTION_TAB: Record<string, IntelSubmoduleId> = {
  exportadores: 'exportadores',
  agentes: 'agentes',
  rotas: 'rotas',
  compromissos: 'agentes',
};
const IDS = new Set<string>(INTEL_SUBMODULES.map((s) => s.id));

/** A rota é a Inteligência embutida? (o Radar antigo mora sob o mesmo prefixo.) */
export function isIntelPath(pathname: string): boolean {
  if (pathname.startsWith(INTEL_BASE_PATH + '/radar')) return false;
  return pathname === INTEL_BASE_PATH || pathname.startsWith(INTEL_BASE_PATH + '/');
}

function splitHash(hash: string): { path: string; params: URLSearchParams } {
  const raw = hash.replace(/^#/, '');
  const cut = raw.indexOf('?');
  return {
    path: cut < 0 ? raw : raw.slice(0, cut),
    params: new URLSearchParams(cut < 0 ? '' : raw.slice(cut + 1)),
  };
}

/** Seção inicial das URLs antigas (`/portal/inteligencia/agentes` etc.), como no layout. */
function sectionOfPath(pathname: string): string {
  if (pathname.includes('/agentes')) return 'agentes';
  if (pathname.includes('/performance')) return 'performance';
  return 'executivo';
}

/**
 * O submódulo ativo, derivado da URL. `null` fora da Inteligência e nas telas
 * internas do protótipo que não são nenhuma das cinco (ficha de exportador,
 * caso, relatórios): ali "Inteligência" continua destacada, sem filho marcado.
 */
export function activeIntelSubmodule(pathname: string, hash: string): IntelSubmoduleId | null {
  if (!isIntelPath(pathname)) return null;
  const { path, params } = splitHash(hash);
  const section = path || sectionOfPath(pathname);
  // Ficha/detalhe (`agentes/alpha/resumo`) ou tela fora da página de abas.
  if (section.includes('/') || !OVERVIEW_SECTIONS.has(section)) return null;
  const aba = params.get('aba');
  if (aba && IDS.has(aba) && aba !== 'geral') return aba as IntelSubmoduleId;
  return LEGACY_SECTION_TAB[section] ?? 'geral';
}

/**
 * Hash de destino de um submódulo. Com `currentHash` de uma página de abas, o
 * período e os filtros são preservados (como as abas faziam); a ficha aberta
 * (`sel`) não acompanha, porque pertence à aba de origem.
 */
export function intelSubmoduleHash(id: IntelSubmoduleId, currentHash = ''): string {
  const { path, params } = splitHash(currentHash);
  const keep = !path.includes('/') && OVERVIEW_SECTIONS.has(path);
  const next = keep ? new URLSearchParams(params) : new URLSearchParams();
  next.delete('sel');
  next.delete('de'); // origem do link entre fichas: some junto com a ficha
  if (id === 'geral') next.delete('aba');
  else next.set('aba', id);
  const query = next.toString();
  return '#executivo' + (query ? '?' + query : '');
}

/** Nome do evento que o host dispara quando o hash do iframe muda. */
export const INTEL_HASH_EVENT = 'centrix:intel-hash';
