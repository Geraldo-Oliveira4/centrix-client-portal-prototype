// O ponto ÚNICO onde a fonte de dados troca: um adapter do axios que responde
// do `offline-backend` em vez da rede. `lib/portal-api.ts` o instala na
// requisição quando o modo offline está ativo; hooks e telas não mudam.

import {
  AxiosError,
  type AxiosAdapter,
  type InternalAxiosRequestConfig,
} from 'axios';
import { toast } from 'react-toastify';

import { demoToday } from '../demo-clock';
import { buildOfflineFixtures } from './fixtures';
import { createOfflineBackend, type OfflineBackend } from './offline-backend';

let backend: OfflineBackend | null = null;

/** Uma instância por aba: as escritas simuladas duram até recarregar. */
function getBackend(): OfflineBackend {
  if (!backend) {
    const search = typeof window !== 'undefined' ? window.location.search : '';
    backend = createOfflineBackend(buildOfflineFixtures(demoToday(search)));
  }
  return backend;
}

/** O caminho da requisição relativo à base da API (`/portal/...`). */
function pathOf(config: InternalAxiosRequestConfig): string {
  const url = config.url ?? '';
  try {
    return new URL(url, 'http://offline.local').pathname;
  } catch {
    return url;
  }
}

/** "Prévia: nada foi enviado" — uma vez por ação, nunca um sucesso fingido. */
export function announceSimulated(what: string) {
  toast.info(`Prévia: nada foi enviado. ${what} (modo demonstração).`, {
    toastId: 'offline-simulated:' + what,
  });
}

export const offlineAdapter: AxiosAdapter = async (config) => {
  const method = (config.method ?? 'get').toUpperCase();
  const result = getBackend().handle(method, pathOf(config), config.data);
  if (result.simulated) announceSimulated(result.simulated);
  const response = {
    data: result.data,
    status: result.status,
    statusText: result.status < 400 ? 'OK' : 'Offline demo',
    headers: {},
    config,
    request: { offline: true },
  };
  if (result.status >= 400) {
    throw new AxiosError(
      String((result.data as { message?: string })?.message ?? 'Offline demo'),
      String(result.status),
      config,
      response.request,
      response,
    );
  }
  return response;
};
