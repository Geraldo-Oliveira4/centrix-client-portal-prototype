'use client';

// A gestão de acessos simulada, como as telas a consomem. As regras moram em
// `access-model.ts` (puro); aqui só o vínculo com o store local.
//
// SEM LINHA NO STORE, A TELA MOSTRA A SEED — e a seed só é GRAVADA na primeira
// alteração. Assim, abrir a tela não escreve nada, e "Reiniciar demonstração"
// (que apaga o prefixo) devolve a seed sem passo extra.

import { useCallback, useMemo } from 'react';

import {
  ACCESS_STORE_NAME,
  VIEWING_AS_STORE_NAME,
  appendLog,
  parseAccessState,
  parseViewingAs,
  seedWithWaves,
  type AccessCompany,
  type AccessState,
  type ClientKind,
} from './access-model';
import { DEFAULT_MODULE_FLAGS, MODULE_FLAGS_STORE_NAME, parseModuleFlags } from './feature-flags';
import { readDemoRaw } from './demo-store';
import { setDemoValue, useDemoValue } from './use-demo-store';
import { useGlobalModuleFlags } from './use-feature-flags';

function storage() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function currentGlobal() {
  return parseModuleFlags(readDemoRaw(storage(), MODULE_FLAGS_STORE_NAME));
}

/** O estado atual, lido na hora (para escrever sem depender de um render velho). */
export function readAccessState(): AccessState {
  return (
    parseAccessState(readDemoRaw(storage(), ACCESS_STORE_NAME)) ??
    seedWithWaves(storage() ? currentGlobal() : DEFAULT_MODULE_FLAGS)
  );
}

export function useAccessState(): AccessState {
  const stored = useDemoValue(ACCESS_STORE_NAME, parseAccessState);
  const global = useGlobalModuleFlags();
  return useMemo(() => stored ?? seedWithWaves(global), [stored, global]);
}

export function writeAccessState(next: AccessState): void {
  setDemoValue(ACCESS_STORE_NAME, next);
}

export function updateAccessState(fn: (state: AccessState) => AccessState): AccessState {
  const next = fn(readAccessState());
  writeAccessState(next);
  return next;
}

export function useViewingAs(): string | null {
  return useDemoValue(VIEWING_AS_STORE_NAME, parseViewingAs);
}

/** A empresa em "ver como", quando há uma e ela ainda existe. */
export function useViewedCompany(): AccessCompany | null {
  const id = useViewingAs();
  const stored = useDemoValue(ACCESS_STORE_NAME, parseAccessState);
  return useMemo(() => {
    if (!id) return null;
    const state = stored ?? seedWithWaves(DEFAULT_MODULE_FLAGS);
    return state.companies.find((company) => company.id === id) ?? null;
  }, [id, stored]);
}

/**
 * Tipo de cliente que as telas obedecem. Sem "ver como", o portal é o de
 * hoje: Cliente Freitas.
 */
export function useClientKind(): ClientKind {
  return useViewedCompany()?.kind ?? 'freitas';
}

/** Liga ou desliga o "ver como", e registra no log (RQ-8 pede trilha). */
export function useSetViewingAs(): (company: AccessCompany | null) => void {
  const current = useViewedCompany();
  return useCallback(
    (company: AccessCompany | null) => {
      const at = new Date().toISOString();
      const target = company ?? current;
      if (target) {
        updateAccessState((state) =>
          appendLog(state, {
            at,
            companyId: target.id,
            companyName: target.name,
            what: company ? 'Ver como: iniciado' : 'Ver como: encerrado',
            from: company ? 'visão normal' : `vendo como ${target.name}`,
            to: company ? `vendo como ${company.name}` : 'visão normal',
          }),
        );
      }
      setDemoValue(VIEWING_AS_STORE_NAME, company ? company.id : null);
    },
    [current],
  );
}
