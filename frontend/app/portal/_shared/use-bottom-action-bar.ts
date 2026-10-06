'use client';

// Registro das barras de ação presas ao rodapé (ver floating-safe-area.ts).
// Um Map por chave; a cada mudança recalcula e escreve no <html>:
//   --floating-bottom-offset   quanto Ajuda e Demonstração sobem
//   --floating-content-pad     espaço ao fim do conteúdo
//   data-floating-compact      Ajuda só com ícone (telas estreitas)

import { useCallback, useEffect, useRef } from 'react';

import {
  IFRAME_BAR_MESSAGE,
  barOccupancy,
  compactFloating,
  contentPadding,
  floatingOffset,
  rectFromIframe,
  type BarRect,
} from './floating-safe-area';

const bars = new Map<string, number>();

function publish() {
  if (typeof document === 'undefined') return;
  const offset = floatingOffset(bars.values());
  const root = document.documentElement;
  root.style.setProperty('--floating-bottom-offset', `${offset}px`);
  root.style.setProperty('--floating-content-pad', `${contentPadding(offset)}px`);
  if (compactFloating(offset, window.innerWidth)) root.setAttribute('data-floating-compact', '');
  else root.removeAttribute('data-floating-compact');
}

export function setBottomBar(key: string, occupancy: number) {
  if (occupancy > 0) bars.set(key, occupancy);
  else bars.delete(key);
  publish();
}

let nextId = 0;

/**
 * Callback ref para a barra fixa de rodapé. Mede no mount, no resize da barra
 * e da janela e na rolagem (uma barra `sticky` só está presa quando chega à
 * base), e sai do registro ao desmontar.
 */
export function useBottomActionBar(): (node: HTMLElement | null) => void {
  const key = useRef(`bar-${nextId++}`);
  // Sem useEffect de limpeza: o React chama o callback ref com `null` ao
  // desmontar, e é ali que a barra sai do registro. Uma limpeza em efeito
  // rodaria no ciclo extra do StrictMode e deixaria a barra desregistrada.
  const cleanup = useRef<() => void>(() => {});

  return useCallback((node: HTMLElement | null) => {
    cleanup.current();
    if (!node) {
      setBottomBar(key.current, 0);
      cleanup.current = () => {};
      return;
    }
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = node.getBoundingClientRect();
        setBottomBar(key.current, barOccupancy({ top: r.top, bottom: r.bottom }, window.innerHeight));
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    cleanup.current = () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
      setBottomBar(key.current, 0);
    };
  }, []);
}

/**
 * Barras de dentro dos iframes do protótipo (rodapés das gavetas). O iframe
 * manda o retângulo da barra nas coordenadas dele; aqui ele vira coordenada da
 * janela de fora. Montado uma vez, junto da Ajuda.
 */
export function useIframeBottomBars(pathname: string) {
  // Ao trocar de rota o iframe some sem avisar: zera as barras que vinham dele.
  useEffect(() => {
    let changed = false;
    for (const key of Array.from(bars.keys()))
      if (key.startsWith('iframe-')) changed = bars.delete(key) || changed;
    if (changed) publish();
  }, [pathname]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string; rect?: BarRect | null } | null;
      if (!data || data.type !== IFRAME_BAR_MESSAGE) return;
      const frame = Array.from(document.querySelectorAll('iframe')).find(
        (f) => f.contentWindow === event.source,
      );
      if (!frame) return;
      const key = `iframe-${frame.src}`;
      if (!data.rect) return setBottomBar(key, 0);
      const outer = rectFromIframe(frame.getBoundingClientRect().top, data.rect);
      setBottomBar(key, barOccupancy(outer, window.innerHeight));
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);
}
