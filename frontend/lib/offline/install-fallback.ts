// Liga o modo offline a uma instância do axios: o ÚNICO ponto onde a fonte de
// dados troca (`lib/portal-api.ts` chama isto uma vez).
//
//   - Antes de cada requisição: espera a decisão da sessão (`ensureMode`) e, se
//     offline, responde pelo adapter de fixtures — sem tocar a rede.
//   - Depois: se a API falhou por rede, timeout ou 5xx (`isServerUnavailable`),
//     marca a sessão offline e REPETE a requisição no adapter. Resposta 4xx de
//     API de pé passa adiante intacta.
//
// PURO quanto ao ambiente (sem React, sem `window`, sem alias `@/`): as
// dependências entram por parâmetro e o teste o exercita contra um servidor
// HTTP de verdade devolvendo 500, pendurando ou fechado.

import type { AxiosAdapter, AxiosError, AxiosInstance } from 'axios';

import { isServerUnavailable, type OfflineReason } from './offline-mode.ts';

export type OfflineStatus =
  | { status: 'checking' }
  | { status: 'online'; explicit: boolean }
  | { status: 'offline'; reason: OfflineReason };

export interface OfflineFallbackDeps {
  ensureMode: () => Promise<OfflineStatus>;
  getStatus: () => OfflineStatus;
  markOffline: (reason: OfflineReason) => void;
  adapter: AxiosAdapter;
}

export function installOfflineFallback(
  api: AxiosInstance,
  deps: OfflineFallbackDeps,
): void {
  api.interceptors.request.use(async (config) => {
    const mode = await deps.ensureMode();
    if (mode.status === 'offline') config.adapter = deps.adapter;
    return config;
  });
  api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const config = error.config;
      const status = deps.getStatus();
      const explicitlyOnline = status.status === 'online' && status.explicit;
      if (!config || explicitlyOnline || !isServerUnavailable(error)) {
        return Promise.reject(error);
      }
      deps.markOffline('network');
      return deps.adapter(config);
    },
  );
}
