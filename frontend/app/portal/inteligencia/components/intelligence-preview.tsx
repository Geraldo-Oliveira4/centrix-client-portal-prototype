'use client';

import { useEffect, useRef, useState } from 'react';

import { markFirstStep } from '../../_shared/use-first-steps';

/** Approved demo, isolated from operational APIs. */
export function IntelligencePreview({ initialSection = 'executivo' }: { initialSection?: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [source, setSource] = useState<string>();

  // "Ver na prática" (tour, parada Performance): `?visao=<id>&guia=1` abre a
  // visão e o mini-guia DENTRO do iframe. Lidos no EFEITO (numa navegação do
  // App Router a página nova renderiza antes de a URL mudar, então um
  // inicializador leria a URL da tela anterior) e guardados num ref, porque o
  // efeito tira os parâmetros da URL e, no StrictMode, roda duas vezes.
  const entry = useRef<string | null>(null);

  useEffect(() => {
    const here = new URLSearchParams(window.location.search);
    if (entry.current === null) {
      const extra = new URLSearchParams();
      const view = here.get('visao');
      if (view) extra.set('view', view);
      if (here.get('guia') === '1') extra.set('guide', '1');
      entry.current = extra.toString();
    }
    if (here.has('visao') || here.has('guia')) {
      here.delete('visao');
      here.delete('guia');
      const q = here.toString();
      window.history.replaceState(window.history.state, '', window.location.pathname + (q ? '?' + q : '') + window.location.hash);
    }
    setSource('/prototypes/centrix-inteligencia/index.html?embed=1&v=20261007-onb-1' + (entry.current ? '&' + entry.current : '') + (window.location.hash || '#' + initialSection));
  }, [initialSection]);

  // "Primeiros passos": abrir a Inteligência conclui "Ver sua Inteligência";
  // salvar ou editar uma visão (o iframe avisa) conclui "Salvar uma visão".
  useEffect(() => {
    markFirstStep('inteligencia');
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string; id?: string } | null;
      if (data?.type === 'centrix:first-step' && data.id === 'visao') markFirstStep('visao');
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
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

  return source ? <>
    <style>{`@media(max-width:767px){main:has(iframe[data-intelligence])>header{flex-wrap:wrap;gap:8px}}`}</style>
    <iframe data-intelligence ref={frame} src={source} title="Inteligência Centrix — leitura completa ou objetiva, com filtros" className="block w-full border-0" style={{ height: 'calc(100dvh - 150px)', minHeight: 580 }} />
  </> : <p role="status">Carregando Inteligência…</p>;
}
