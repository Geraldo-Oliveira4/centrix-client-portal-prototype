'use client';

// O estado do modo offline para componentes React (faixa, selos de proveniência,
// rótulos que afirmam "dado real"). Antes do teste de saúde terminar, e no
// servidor, o estado é `checking` — ninguém trata isso como offline.

import { useSyncExternalStore } from 'react';

import {
  getOfflineStatus,
  subscribeOffline,
  type OfflineStatus,
} from './offline-store';

const SERVER_SNAPSHOT: OfflineStatus = { status: 'checking' };

export function useOfflineStatus(): OfflineStatus {
  return useSyncExternalStore(
    subscribeOffline,
    getOfflineStatus,
    () => SERVER_SNAPSHOT,
  );
}
