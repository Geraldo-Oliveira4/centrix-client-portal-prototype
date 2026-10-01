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
  appendLog,
  parseAccessState,
  seedWithWaves,
  viewingSnapshot,
  type AccessCompany,
  type AccessState,
} from './access-model';
import {
  DEFAULT_MODULE_FLAGS,
  MODULE_FLAGS_STORE_NAME,
  parseModuleFlags,
} from './feature-flags';
import { VIEWING_AS_STORE_NAME, parseViewingAs } from './client-profile';
import { readDemoRaw } from './demo-store';
import { useViewingSnapshot } from './use-client-profile';
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

export function updateAccessState(
  fn: (state: AccessState) => AccessState,
): AccessState {
  const next = fn(readAccessState());
  writeAccessState(next);
  // O retrato do "ver como" acompanha a empresa: exceção ou tipo mudados aqui
  // valem no portal sem precisar encerrar e reabrir o "ver como".
  const viewing = parseViewingAs(readDemoRaw(storage(), VIEWING_AS_STORE_NAME));
  if (viewing) {
    const company = next.companies.find((c) => c.id === viewing.id);
    setDemoValue(
      VIEWING_AS_STORE_NAME,
      company ? viewingSnapshot(company) : null,
    );
  }
  return next;
}

export function useViewingAs(): string | null {
  return useViewingSnapshot()?.id ?? null;
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
      setDemoValue(
        VIEWING_AS_STORE_NAME,
        company ? viewingSnapshot(company) : null,
      );
    },
    [current],
  );
}
