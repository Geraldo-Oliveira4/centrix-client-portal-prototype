'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMyShipments } from '@/hooks/use-portal-shipments';
import { NewShipmentDialog } from '../_shared/demo/new-shipment-dialog';
import { usePortalModuleReleased } from '../_shared/demo/use-feature-flags';
import { useShipmentsWithPo } from '../_shared/demo/use-shipment-po-review';
import { useShipmentIndicators } from '../embarques/components/shipment-indicator-strip';
import {
  SHIPMENT_INDICATOR_KEYS,
  SHIPMENT_INDICATOR_LABELS,
} from '../embarques/lib/shipment-indicators';

/**
 * Approved UX demonstration. The scenario inside the iframe is illustrative.
 *
 * EXCEÇÃO (02/10/2026): os cinco indicadores de embarque são REAIS. A página
 * calcula com a MESMA fonte de /portal/home e Embarques (`useShipmentIndicators`
 * sobre `useShipmentsWithPo`) e entrega ao iframe, que os mostra numa linha só
 * de leitura no topo da Operação. O resto da Operação é o cenário fictício e
 * leva o selo "Exemplo ilustrativo".
 */
export default function VisaoGeralPage() {
  const frame = useRef<HTMLIFrameElement>(null);
  const [source, setSource] = useState<string | null>(null);
  // RQ-1: "Abrir novo embarque" no cabecalho da Central. O botao mora no
  // index.html do iframe (escondido) e quem o revela e o HOST, conforme a flag.
  const poReleased = usePortalModuleReleased('embarqueViaPo');
  const [choiceOpen, setChoiceOpen] = useState(false);

  const { shipments, isLoading, isError } = useMyShipments();
  const portfolio = useShipmentsWithPo(shipments);
  const [now] = useState(() => new Date());
  const { indicators } = useShipmentIndicators(portfolio, now);
  // Objeto simples (sem Set) para atravessar para o realm do iframe.
  const portalIndicators = useMemo(
    () =>
      isLoading || isError
        ? null
        : SHIPMENT_INDICATOR_KEYS.map((key) => ({
            key,
            label: SHIPMENT_INDICATOR_LABELS[key],
            count: indicators[key].size,
            href: `/portal/embarques?tab=lista&indicador=${key}`,
          })),
    [indicators, isLoading, isError],
  );

  useEffect(() => {
    const hash = /^#(dia|operacao)$/.test(window.location.hash)
      ? window.location.hash : '#dia';
    setSource('/prototypes/centrix-visao-geral/index.html?v=20261002-foco-3' + hash);
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

      // Os indicadores reais entram por propriedade da janela do iframe (mesma
      // origem) + um evento para a Operação redesenhar.
      const pushIndicators = () => {
        (child as unknown as { portalIndicators: unknown }).portalIndicators =
          portalIndicators;
        child.dispatchEvent(
          new (child as unknown as typeof globalThis).Event('portal-indicators'),
        );
      };
      pushIndicators();

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
  }, [source, poReleased, portalIndicators]);

  return (
    <div className="space-y-4">
      {source && <iframe ref={frame} src={source} title="Central de trabalho Centrix — Meu dia e Operação" className="block w-full border-0" style={{ height: 'calc(100dvh - 170px)', minHeight: 650 }} />}
      <NewShipmentDialog open={choiceOpen} onOpenChange={setChoiceOpen} />
    </div>
  );
}
