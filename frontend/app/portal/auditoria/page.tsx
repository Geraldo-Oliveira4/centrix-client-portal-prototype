'use client';

import { useEffect, useRef, useState } from 'react';

/** Approved UX demonstration. It uses illustrative sources, never client API data. */
export default function AuditoriaPage() {
  const frame = useRef<HTMLIFrameElement>(null);
  const [source, setSource] = useState<string | null>(null);

  useEffect(() => {
    const hash = /^#(auditoria|cotacao|embarque)(\/|$)/.test(window.location.hash)
      ? window.location.hash : '#auditoria/preco';
    setSource('/prototypes/centrix-auditoria/index.html?embed=1&v=20260913-audit-1' + hash);
  }, []);

  useEffect(() => {
    const iframe = frame.current;
    if (!iframe) return;
    let disconnect = () => {};
    const loaded = () => {
      disconnect();
      const doc = iframe.contentDocument;
      const child = iframe.contentWindow;
      if (!doc || !child) return;
      const syncHash = () => {
        window.history.replaceState(window.history.state, '', window.location.pathname + child.location.hash);
      };
      const restoreHash = () => {
        if (/^#(auditoria|cotacao|embarque)(\/|$)/.test(window.location.hash) && child.location.hash !== window.location.hash) child.location.hash = window.location.hash;
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
  }, [source]);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Prévia de experiência · dados, documentos e créditos ilustrativos. Nenhuma cobrança ou envio real.</p>
      {source && <iframe ref={frame} src={source} title="Auditoria Centrix — preço, performance e entrada assistida" className="block w-full border-0" style={{ height: 'calc(100dvh - 170px)', minHeight: 600 }} />}
    </div>
  );
}
