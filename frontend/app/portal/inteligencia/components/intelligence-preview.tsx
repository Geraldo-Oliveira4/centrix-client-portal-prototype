'use client';

import { useEffect, useRef, useState } from 'react';

/** Approved demo, isolated from operational APIs. */
export function IntelligencePreview({ initialSection = 'performance' }: { initialSection?: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [source, setSource] = useState<string>();

  useEffect(() => {
    setSource('/prototypes/centrix-inteligencia/index.html?embed=1' + (window.location.hash || '#' + initialSection));
  }, [initialSection]);

  useEffect(() => {
    const iframe = frame.current;
    if (!iframe) return;
    let disconnect = () => {};
    const loaded = () => {
      disconnect();
      const child = iframe.contentWindow;
      if (!child) return;
      const syncHash = () => {
        window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search + child.location.hash);
        document.title = child.document.title;
      };
      const restoreHash = () => {
        const hash = window.location.hash || '#' + initialSection;
        if (child.location.hash !== hash) child.location.replace(child.location.pathname + child.location.search + hash);
      };
      child.addEventListener('hashchange', syncHash);
      window.addEventListener('hashchange', restoreHash);
      syncHash();
      disconnect = () => {
        child.removeEventListener('hashchange', syncHash);
        window.removeEventListener('hashchange', restoreHash);
      };
    };
    iframe.addEventListener('load', loaded);
    return () => { iframe.removeEventListener('load', loaded); disconnect(); };
  }, [source, initialSection]);

  return source ? <iframe ref={frame} src={source} title="Inteligência Centrix — Performance, Parceiros, Rotas e locais, Relatórios e Assistentes" className="block w-full border-0" style={{ height: 'calc(100dvh - 150px)', minHeight: 580 }} /> : <p role="status">Carregando Inteligência…</p>;
}
