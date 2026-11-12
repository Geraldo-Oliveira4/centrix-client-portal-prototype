// Estado do modo offline nesta aba, e o teste de saúde que o decide.
//
// Um estado só, compartilhado pelo adapter do axios (que troca a fonte de dados)
// e pela faixa "Modo demonstração" (que avisa). O teste de saúde roda UMA vez,
// antes da primeira chamada à API; o resultado vale para a sessão
// (`sessionStorage`), para não re-testar a cada tela. "Tentar de novo" é o único
// caminho de volta, e ele é explícito.

import {
  OFFLINE_SESSION_KEY,
  probeHealth,
  resolveDataMode,
  type DataMode,
  type FetchLike,
  type OfflineReason,
} from './offline-mode';
import type { OfflineStatus } from './install-fallback';

export type { OfflineStatus };

type Listener = () => void;

const listeners = new Set<Listener>();
let current: OfflineStatus = { status: 'checking' };
let pending: Promise<OfflineStatus> | null = null;

const isClient = () => typeof window !== 'undefined';

function apiBase(): string {
  return process.env.NEXT_PUBLIC_API ?? '';
}

function readStored(): string | null {
  try {
    return window.sessionStorage.getItem(OFFLINE_SESSION_KEY);
  } catch {
    return null;
  }
}

function writeStored(value: string | null) {
  try {
    if (value == null) window.sessionStorage.removeItem(OFFLINE_SESSION_KEY);
    else window.sessionStorage.setItem(OFFLINE_SESSION_KEY, value);
  } catch {
    // Storage bloqueado: o estado continua valendo em memória.
  }
}

function set(next: OfflineStatus) {
  current = next;
  listeners.forEach((l) => l());
}

function fromMode(mode: Exclude<DataMode, { kind: 'probe' }>): OfflineStatus {
  return mode.kind === 'offline'
    ? { status: 'offline', reason: mode.reason }
    : { status: 'online', explicit: mode.explicit };
}

const browserFetch: FetchLike = (url, init) => fetch(url, init);

/**
 * O modo desta sessão. Na primeira chamada decide (URL, sessão, variável de
 * ambiente ou teste de saúde); as seguintes devolvem a mesma promessa.
 */
export function ensureDataMode(): Promise<OfflineStatus> {
  if (!isClient())
    return Promise.resolve({ status: 'online', explicit: false });
  if (pending) return pending;
  pending = (async () => {
    const mode = resolveDataMode({
      env: process.env.NEXT_PUBLIC_OFFLINE_DEMO,
      search: window.location.search,
      stored: readStored(),
    });
    if (mode.kind !== 'probe') {
      if (mode.kind === 'offline' && mode.reason === 'query')
        writeStored('offline:query');
      set(fromMode(mode));
      return current;
    }
    const healthy = await probeHealth(apiBase(), browserFetch);
    if (healthy) {
      set({ status: 'online', explicit: false });
    } else {
      writeStored('offline:health');
      set({ status: 'offline', reason: 'health' });
    }
    return current;
  })();
  return pending;
}

export function getOfflineStatus(): OfflineStatus {
  return current;
}

export function isOfflineActive(): boolean {
  return current.status === 'offline';
}

/** A API caiu no meio da sessão (erro de rede): passa a dados de exemplo. */
export function markOffline(reason: OfflineReason) {
  if (current.status === 'online' && current.explicit) return;
  writeStored(`offline:${reason}`);
  pending = Promise.resolve({ status: 'offline', reason });
  set({ status: 'offline', reason });
}

/**
 * "Tentar de novo": testa a API. De pé, a sessão volta para ela e a página
 * recarrega (as telas buscam tudo de novo, agora da API). Caída, nada muda.
 */
export async function retryOnline(
  fetchImpl: FetchLike = browserFetch,
): Promise<boolean> {
  const healthy = await probeHealth(apiBase(), fetchImpl);
  if (!healthy) return false;
  writeStored('online');
  pending = Promise.resolve({ status: 'online', explicit: false });
  set({ status: 'online', explicit: false });
  if (isClient()) {
    const url = new URL(window.location.href);
    url.searchParams.delete('offline');
    window.location.replace(url.toString());
  }
  return true;
}

export function subscribeOffline(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * "Usar dados de exemplo": a saída da tela de erro quando o modo offline estava
 * desligado (`?offline=0` / `NEXT_PUBLIC_OFFLINE_DEMO=0`). Vale para a sessão.
 */
export function switchToSampleData() {
  writeStored('offline:query');
  pending = Promise.resolve({ status: 'offline', reason: 'query' });
  set({ status: 'offline', reason: 'query' });
  if (isClient()) {
    const url = new URL(window.location.href);
    url.searchParams.set('offline', '1');
    window.location.replace(url.toString());
  }
}
