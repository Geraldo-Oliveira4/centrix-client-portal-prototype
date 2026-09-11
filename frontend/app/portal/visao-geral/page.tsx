'use client';

import { useEffect, useRef, useState } from 'react';

/** Approved UX demonstration. It uses illustrative sources, never client API data. */
export default function VisaoGeralPage() {
  const frame = useRef<HTMLIFrameElement>(null);
  const [source, setSource] = useState<string | null>(null);

  useEffect(() => {
    const hash = /^#(dia|operacao)$/.test(window.location.hash)
      ? window.location.hash : '#dia';
    setSource('/prototypes/centrix-visao-geral/index.html?v=20260911-2' + hash);
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
      child.addEventListener('hashchange', syncHash);
      syncHash();
      disconnect = () => child.removeEventListener('hashchange', syncHash);
    };
    iframe.addEventListener('load', loaded);
    return () => { iframe.removeEventListener('load', loaded); disconnect(); };
  }, [source]);

  return (
    <div className="space-y-4">
      {source && <iframe ref={frame} src={source} title="Visão Geral Centrix — Meu dia e Operação" className="block w-full border-0" style={{ height: 'calc(100dvh - 170px)', minHeight: 650 }} />}
    </div>
  );
}
