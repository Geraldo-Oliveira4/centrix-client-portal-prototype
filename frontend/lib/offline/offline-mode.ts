// Quando o portal usa dados de exemplo em vez da API — as regras, sem efeito.
//
// O protótipo é ferramenta de demonstração e não pode depender do backend
// (FastAPI + Postgres) para uma apresentação: quando ele dorme, é pausado ou
// perde o banco, o portal passa a mostrar dados de exemplo, rotulados como tal.
// Este módulo decide QUANDO; `offline-store.ts` guarda o estado e
// `offline-adapter.ts` troca a fonte.
//
// "SERVIDOR NO AR" NÃO É "DADOS DISPONÍVEIS" (12/11/2026): o backend publicado
// respondia 200 em `/health` e `/docs` enquanto toda rota que toca no banco
// devolvia 500 (o banco tinha deixado de existir). Por isso o teste de saúde
// consulta uma rota que USA o banco (`HEALTH_PATH`), e qualquer chamada que
// falhe por rede, timeout de 4 s ou 5xx conta como indisponível.
//
// PRECEDÊNCIA (a primeira que se aplica vence):
//   1. `?offline=1` / `?offline=0` na URL — demonstração controlada e testes;
//   2. a escolha desta sessão (`sessionStorage`): o resultado do teste de saúde
//      ou do "Tentar de novo", para não re-testar a cada tela;
//   3. `NEXT_PUBLIC_OFFLINE_DEMO` — `1` força dados de exemplo sem chamar o
//      backend (zero espera); `0` DESLIGA o modo offline (falha vira erro na tela);
//   4. nada disso: teste de saúde antes da primeira chamada.
//
// PURO e sem o alias `@/`: roda sob `npm run test:unit`.

/** Por que o portal está mostrando dados de exemplo. */
export type OfflineReason = 'env' | 'query' | 'health' | 'network';

export type DataMode =
  | { kind: 'offline'; reason: OfflineReason }
  /** `explicit`: o modo offline foi DESLIGADO de propósito; erro de rede vira erro. */
  | { kind: 'online'; explicit: boolean }
  | { kind: 'probe' };

/** Valor guardado em `sessionStorage` para o resto da sessão. */
export type StoredMode = 'online' | `offline:${OfflineReason}` | null;

export const OFFLINE_SESSION_KEY = 'centrix-offline:mode';

/** Rota do teste de saúde: lê o banco (o cliente da sessão). Nunca `/health` ou `/docs`. */
export const HEALTH_PATH = '/portal/clients/me';
/** Timeout do teste de saúde e de cada chamada à API: acima disto, indisponível. */
export const HEALTH_TIMEOUT_MS = 4000;
export const REQUEST_TIMEOUT_MS = 4000;
/** Uma tentativa: no pior caso o portal espera 4 s antes de abrir com dados de exemplo. */
export const HEALTH_ATTEMPTS = 1;

function flag(value: string | null | undefined): boolean | null {
  if (value == null || value === '') return null;
  if (value === '1' || value === 'true') return true;
  if (value === '0' || value === 'false') return false;
  return null;
}

export function resolveDataMode(input: {
  env?: string | null;
  search?: string | null;
  stored?: StoredMode | string | null;
}): DataMode {
  let query: boolean | null = null;
  try {
    query = flag(new URLSearchParams(input.search ?? '').get('offline'));
  } catch {
    query = null;
  }
  if (query === true) return { kind: 'offline', reason: 'query' };
  if (query === false) return { kind: 'online', explicit: true };

  const stored = input.stored ?? null;
  if (stored === 'online') return { kind: 'online', explicit: false };
  const storedReason =
    typeof stored === 'string' && stored.startsWith('offline:')
      ? stored.slice(8)
      : null;
  if (
    storedReason === 'health' ||
    storedReason === 'network' ||
    storedReason === 'query'
  ) {
    return { kind: 'offline', reason: storedReason };
  }

  const env = flag(input.env);
  if (env === true) return { kind: 'offline', reason: 'env' };
  if (env === false) return { kind: 'online', explicit: true };

  return { kind: 'probe' };
}

export type FetchLike = (
  url: string,
  init: { signal: AbortSignal; method: string; cache: 'no-store' },
) => Promise<{ ok: boolean }>;

/**
 * UMA tentativa: `GET {apiBase}{HEALTH_PATH}` com timeout. Nunca lança — falha
 * de rede, timeout e status não-2xx (inclusive 5xx de banco fora) viram `false`.
 */
export async function checkHealthOnce(
  apiBase: string,
  fetchImpl: FetchLike,
  timeoutMs: number = HEALTH_TIMEOUT_MS,
): Promise<boolean> {
  if (!apiBase) return false;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(false);
    }, timeoutMs);
  });
  const request = fetchImpl(apiBase.replace(/\/+$/, '') + HEALTH_PATH, {
    signal: controller.signal,
    method: 'GET',
    cache: 'no-store',
  })
    .then((res) => res.ok)
    .catch(() => false);
  try {
    return await Promise.race([request, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** O teste de saúde: `attempts` tentativas (padrão 1). `true` se alguma responder. */
export async function probeHealth(
  apiBase: string,
  fetchImpl: FetchLike,
  options: { timeoutMs?: number; attempts?: number } = {},
): Promise<boolean> {
  const attempts = Math.max(1, options.attempts ?? HEALTH_ATTEMPTS);
  for (let i = 0; i < attempts; i += 1) {
    if (await checkHealthOnce(apiBase, fetchImpl, options.timeoutMs))
      return true;
  }
  return false;
}

/**
 * O SERVIDOR não entregou dado: rede caída, timeout (sem resposta) ou 5xx.
 * Só isso troca para dados de exemplo. Um 4xx (404, 409, 422) é resposta de
 * NEGÓCIO de uma API de pé e continua sendo o erro que é — nada mascarado.
 */
export function isServerUnavailable(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as {
    isAxiosError?: boolean;
    response?: { status?: number };
    code?: string;
  };
  if (!e.isAxiosError || e.code === 'ERR_CANCELED') return false;
  if (!e.response) return true;
  return (e.response.status ?? 0) >= 500;
}

/** A frase da faixa, por motivo. A primeira parte é fixa em todas. */
export function offlineBannerText(reason: OfflineReason): string {
  switch (reason) {
    case 'env':
    case 'query':
      return 'Modo demonstração: dados de exemplo.';
    default:
      return 'Modo demonstração: servidor indisponível. Dados de exemplo.';
  }
}
