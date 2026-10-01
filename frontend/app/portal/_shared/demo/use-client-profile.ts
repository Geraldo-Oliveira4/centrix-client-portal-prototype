'use client';

// O tipo de cliente, como as telas e o painel o consomem.

import {
  CLIENT_KIND_STORE_NAME,
  parseClientKind,
  type ClientKind,
} from './client-profile';
import { setDemoValue, useDemoValue } from './use-demo-store';

/** O tipo de cliente que as telas obedecem: o que o seletor do painel diz. */
export function useClientKind(): ClientKind {
  return useDemoValue(CLIENT_KIND_STORE_NAME, parseClientKind);
}

export function setSelectedClientKind(kind: ClientKind): void {
  setDemoValue(CLIENT_KIND_STORE_NAME, kind);
}
