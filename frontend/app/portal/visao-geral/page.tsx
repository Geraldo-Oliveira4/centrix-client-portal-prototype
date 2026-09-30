'use client';

import { useEffect, useRef, useState } from 'react';
import { NewShipmentDialog } from '../_shared/demo/new-shipment-dialog';
import { usePortalModuleReleased } from '../_shared/demo/use-feature-flags';

/** Approved UX demonstration. It uses illustrative sources, never client API data. */
export default function VisaoGeralPage() {
  const frame = useRef<HTMLIFrameElement>(null);
  const [source, setSource] = useState<string | null>(null);
  // RQ-1: "Abrir novo embarque" no cabecalho da Central. O botao mora no
  // index.html do iframe (escondido) e quem o revela e o HOST, conforme a flag.
  const poReleased = usePortalModuleReleased('embarqueViaPo');
  const [choiceOpen, setChoiceOpen] = useState(false);

  useEffect(() => {
    const hash = /^#(dia|operacao)$/.test(window.location.hash)
      ? window.location.hash : '#dia';
    setSource('/prototypes/centrix-visao-geral/index.html?v=20260924-po-1' + hash);
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

      // MESMA ORIGEM, entao o host pode mexer no DOM do iframe. O botao carrega
      // `data-host-href` e nada mais: o protótipo embutido nao roteia nada por
      // conta propria, e o host e quem sabe da flag e do router do Next.
      const button = doc.getElementById('host-new-shipment');
      const openChoice = (event: Event) => {
        event.preventDefault();
        setChoiceOpen(true);
      };
      if (button) {
        button.hidden = !poReleased;
        button.addEventListener('click', openChoice);
      }

      disconnect = () => {
        child.removeEventListener('hashchange', syncHash);
        button?.removeEventListener('click', openChoice);
      };
    };
    iframe.addEventListener('load', loaded);
    // O efeito tambem roda quando a FLAG muda, e nesse caso o `load` ja passou
    // ha muito. Sem esta chamada, ligar o modulo no painel so revelaria o botao
    // depois de um refresh.
    if (iframe.contentDocument?.readyState === 'complete') loaded();
    return () => { iframe.removeEventListener('load', loaded); disconnect(); };
  }, [source, poReleased]);

  return (
    <div className="space-y-4">
      {source && <iframe ref={frame} src={source} title="Central de trabalho Centrix — Meu dia e Operação" className="block w-full border-0" style={{ height: 'calc(100dvh - 170px)', minHeight: 650 }} />}
      <NewShipmentDialog open={choiceOpen} onOpenChange={setChoiceOpen} />
    </div>
  );
}
