'use client';

import { useEffect, useRef, useState } from 'react';

/** Approved Radar Beta. Fixtures and route selections remain isolated from client data. */
export default function RadarPage() {
  const frame = useRef<HTMLIFrameElement>(null);
  const [source, setSource] = useState<string | null>(null);

  useEffect(() => {
    const hash = /^#(radar|sinal)(\/|$)/.test(window.location.hash)
      ? window.location.hash : '#radar/mercado';
    setSource('/prototypes/centrix-radar/index.html?embed=1' + hash);
  }, []);

  useEffect(() => {
    const iframe = frame.current;
    if (!iframe) return;
    let disconnect = () => {};
    const loaded = () => {
      disconnect();
      const child = iframe.contentWindow;
      if (!child) return;
      const syncHash = () => {
        window.history.replaceState(window.history.state, '', window.location.pathname + child.location.hash);
      };
      const restoreHash = () => {
        if (window.location.hash && child.location.hash !== window.location.hash) child.location.hash = window.location.hash;
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

  return source ? (
    <iframe ref={frame} src={source} title="Radar Beta — mercado de fretes, riscos, parceiros e abastecimento" className="block w-full border-0" style={{ height: 'calc(100dvh - 150px)', minHeight: 560 }} />
  ) : null;
}
