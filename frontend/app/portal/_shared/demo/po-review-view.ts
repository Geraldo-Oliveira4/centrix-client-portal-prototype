'use client';

// Como o cliente vê o embarque em análise: selo na carteira (opção A, Tela 7)
// ou aba própria (opção B, Tela 8).
//
// A ESCOLHA É DO ORSI (Open Question 10) e a spec propõe A. O protótipo entrega
// as duas e deixa a decisão onde ela está: num seletor do painel de
// demonstração, para a pergunta ser respondida vendo, não imaginando.

import { setDemoValue, useDemoValue } from './use-demo-store';

export const PO_REVIEW_VIEW_STORE_NAME = 'po-review-view';

export type PoReviewView = 'selo' | 'aba';

/** A da spec. */
export const DEFAULT_PO_REVIEW_VIEW: PoReviewView = 'selo';

export function parsePoReviewView(raw: string | null): PoReviewView {
  if (raw == null) return DEFAULT_PO_REVIEW_VIEW;
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed === 'aba' ? 'aba' : DEFAULT_PO_REVIEW_VIEW;
  } catch {
    return DEFAULT_PO_REVIEW_VIEW;
  }
}

export function usePoReviewView(): PoReviewView {
  return useDemoValue(PO_REVIEW_VIEW_STORE_NAME, parsePoReviewView);
}

export function setPoReviewView(view: PoReviewView): void {
  setDemoValue(PO_REVIEW_VIEW_STORE_NAME, view);
}

// "Simular falha de leitura do PO" — o toggle do painel que faz `simulateRead`
// devolver campos vazios e guardar só o anexo.
export const PO_READ_FAILURE_STORE_NAME = 'po-read-failure';

export function parsePoReadFailure(raw: string | null): boolean {
  if (raw == null) return false;
  try {
    return JSON.parse(raw) === true;
  } catch {
    return false;
  }
}

export function usePoReadFailure(): boolean {
  return useDemoValue(PO_READ_FAILURE_STORE_NAME, parsePoReadFailure);
}

export function setPoReadFailure(fail: boolean): void {
  setDemoValue(PO_READ_FAILURE_STORE_NAME, fail);
}
