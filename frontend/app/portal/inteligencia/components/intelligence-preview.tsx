'use client';

import { useEffect, useRef, useState } from 'react';

import { markFirstStep } from '../../_shared/use-first-steps';
import { INTEL_HASH_EVENT } from '../lib/intel-submodules';

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
      // Relógio da demonstração: `?hoje=AAAA-MM-DD` fixa o "hoje" do iframe
      // (testes e screenshots reproduzíveis). Sem ele, o hoje é a data atual.
      const hoje = here.get('hoje');
      if (hoje && /^\d{4}-\d{2}-\d{2}$/.test(hoje)) extra.set('hoje', hoje);
      // `?onboarding=1` força a introdução da Inteligência (demos); sem ele, ela
      // aparece só na primeira entrada (flag no localStorage, lida pelo iframe).
      if (here.get('onboarding') === '1') extra.set('onboarding', '1');
      entry.current = extra.toString();
    }
    if (here.has('visao') || here.has('guia')) {
      here.delete('visao');
      here.delete('guia');
      const q = here.toString();
      window.history.replaceState(window.history.state, '', window.location.pathname + (q ? '?' + q : '') + window.location.hash);
    }
    setSource('/prototypes/centrix-inteligencia/index.html?embed=1&v=20261117-ajustes-1' + (entry.current ? '&' + entry.current : '') + (window.location.hash || '#' + initialSection));
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
        // O menu lateral marca o submodulo ativo pelo hash, e `replaceState`
        // nao dispara `hashchange`: o host avisa.
        window.dispatchEvent(new Event(INTEL_HASH_EVENT));
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

  // B6 (17/11/2026): a altura do iframe acompanha a janela, para nada ficar
  // inalcançável com zoom alto ou janela baixa, e sem duas barras de rolagem
  // brigando. Com espaço, o iframe ocupa o que sobra abaixo do cabeçalho do
  // portal e a página não rola. Sem espaço (zoom de 125% a 200%), ele ocupa a
  // janela inteira menos a faixa presa ao topo; a página rola uma vez para
  // tirar o cabeçalho, e o iframe rola por dentro. Quando um painel abre lá
  // dentro, o iframe se põe inteiro na tela (`revealFrame`, no protótipo).
  useEffect(() => {
    const iframe = frame.current;
    if (!iframe) return;
    const MIN_FIT = 480;
    const fit = () => {
      const banner = document.querySelector<HTMLElement>('main > .sticky');
      const sticky = banner ? banner.getBoundingClientRect().height : 0;
      const top = iframe.getBoundingClientRect().top + window.scrollY;
      const below = Math.max(0, document.documentElement.scrollHeight - (top + iframe.offsetHeight));
      const room = window.innerHeight - top - below;
      const next = Math.round(room >= MIN_FIT ? room : Math.max(320, window.innerHeight - sticky - 8));
      if (Math.abs(iframe.offsetHeight - next) > 1) iframe.style.height = next + 'px';
      iframe.style.scrollMarginTop = sticky + 'px';
    };
    fit();
    const ro = new ResizeObserver(() => fit());
    ro.observe(document.body);
    window.addEventListener('resize', fit);
    return () => { ro.disconnect(); window.removeEventListener('resize', fit); };
  }, [source]);

  return source ? <>
    <style>{`@media(max-width:767px){main:has(iframe[data-intelligence])>header{flex-wrap:wrap;gap:8px}}`}</style>
    <iframe data-intelligence ref={frame} src={source} title="Inteligência Centrix" className="block w-full border-0" style={{ height: 'calc(100dvh - 150px)', minHeight: 320 }} />
  </> : <p role="status">Carregando Inteligência…</p>;
}
