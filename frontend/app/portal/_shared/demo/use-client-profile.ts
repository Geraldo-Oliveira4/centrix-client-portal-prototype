'use client';

// O tipo de cliente e o retrato do "ver como", como as telas os consomem.
// Seguro para produção: não importa nada da gestão de acessos.
//
// O "ver como" só é lido quando NEXT_PUBLIC_PROTO_INTERNAL é '1' no build
// (preview). Em produção a condição vira `false` em tempo de compilação, e um
// retrato que tenha ficado no navegador é ignorado.

import {
  CLIENT_KIND_STORE_NAME,
  VIEWING_AS_STORE_NAME,
  effectiveClientKind,
  parseClientKind,
  parseViewingAs,
  type ClientKind,
  type ViewingAsSnapshot,
} from './client-profile';
import { setDemoValue, useDemoValue } from './use-demo-store';

/** O "ver como" ativo, só em ambiente interno; `null` em produção. */
export function useViewingSnapshot(): ViewingAsSnapshot | null {
  const snapshot = useDemoValue(VIEWING_AS_STORE_NAME, parseViewingAs);
  return process.env.NEXT_PUBLIC_PROTO_INTERNAL === '1' ? snapshot : null;
}

/** O que o seletor do painel diz, sem considerar o "ver como". */
export function useSelectedClientKind(): ClientKind {
  return useDemoValue(CLIENT_KIND_STORE_NAME, parseClientKind);
}

export function setSelectedClientKind(kind: ClientKind): void {
  setDemoValue(CLIENT_KIND_STORE_NAME, kind);
}

/** O tipo de cliente que as telas obedecem. */
export function useClientKind(): ClientKind {
  const selected = useSelectedClientKind();
  const viewing = useViewingSnapshot();
  return effectiveClientKind(selected, viewing);
}
