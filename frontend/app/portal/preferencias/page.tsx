'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

/** Approved settings UX; browser-only demonstration, isolated from operational preferences. */
export default function ConfiguracoesPage() {
  const frame = useRef<HTMLIFrameElement>(null);
  const [source, setSource] = useState<string | null>(null);

  useEffect(() => {
    const hash = /^#(inicio|perfil|geral|alertas|empresas|rotas|locais|agentes|inteligencia)(\/|$)/.test(window.location.hash)
      ? window.location.hash : '#inicio';
    setSource('/prototypes/centrix-configuracoes/index.html?embed=1' + hash);
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

  return (
    <div className="space-y-4">
      {source && <iframe ref={frame} src={source} title="Configurações Centrix — perfil, empresas, rotas, locais e agentes" className="block w-full border-0" style={{ height: 'calc(100dvh - 160px)', minHeight: 580 }} />}
      <details className="text-sm text-muted-foreground">
        <summary className="cursor-pointer">Acessar cadastros e preferências conectados</summary>
        <p className="mt-2">A experiência acima usa dados demonstrativos salvos neste navegador. Os cadastros e ajustes conectados ao portal continuam disponíveis abaixo; suas alterações não são sincronizadas com a demonstração.</p>
        <div className="mt-2 flex flex-wrap gap-4 underline">
          <Link href="/portal/preferencias/conectadas">Perfil e notificações</Link>
          <Link href="/portal/preferencias/exportadores">Exportadores cadastrados</Link>
          <Link href="/portal/preferencias/agentes">Agentes e bloqueios de cotação</Link>
        </div>
      </details>
    </div>
  );
}
