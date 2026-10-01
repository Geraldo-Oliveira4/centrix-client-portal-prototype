'use client';

// THE REGISTRY OF PANEL SECTIONS.
//
// `DemoPanel` renders this array and knows nothing else. Prompts 2 and 3 add
// their controls by writing a section component and appending one entry here —
// the panel itself does not change, and two prompts adding a section each do
// not collide inside one file of JSX.
//
// A section is a plain component with no props. Whatever it needs, it reads
// from the demonstration store through the hooks of this folder, which is the
// same subscription the screens use: a switch flipped here reaches the sidebar
// without anything being passed down.

import { resetOnboarding, useOnboarding } from '../use-onboarding';
import { useState, type ComponentType } from 'react';
import dynamic from 'next/dynamic';
import { RotateCcw } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

import { CLIENT_KIND_LABELS, type ClientKind } from './client-profile';
import { setSelectedClientKind, useClientKind } from './use-client-profile';
import { resetDemoStore } from './use-demo-store';

export interface DemoSection {
  /** Stable key. Also the anchor a later prompt can point at. */
  id: string;
  title: string;
  /** One line under the title. Optional. */
  description?: string;
  Content: ComponentType;
}

// SEÇÕES INTERNAS (Freitas/Ionix). Só existem em build com
// NEXT_PUBLIC_PROTO_INTERNAL=1 (preview): ondas de módulos, Freitas simulada,
// e as mesas de revisão da Cotação V2, do Embarque via PO e do Fechamento
// direto. A condição fica ESCRITA AQUI, inline, em volta de cada
// `import()`, para o compilador resolvê-la e deixar esse código fora do bundle
// de produção — uma constante importada de outro módulo não seria dobrada.
// Em produção ficam só "Tipo de cliente", "Boas-vindas" e "Reiniciar".
const INTERNAL_SECTIONS: DemoSection[] =
  process.env.NEXT_PUBLIC_PROTO_INTERNAL === '1'
    ? [
        {
          id: 'modules',
          title: 'Módulos liberados',
          description: 'O que esta empresa enxerga no portal.',
          Content: dynamic(() =>
            import('./demo-sections-internal').then((m) => m.ModulesSection),
          ),
        },
        {
          id: 'freitas',
          title: 'Freitas simulada',
          description: 'O analista que responde do outro lado.',
          Content: dynamic(() =>
            import('./demo-sections-internal').then((m) => m.FreitasSection),
          ),
        },
        {
          id: 'cotacao-v2',
          title: 'Cotação V2',
          description: 'A revisão da Freitas: de entrada (Inbox) e de saída.',
          Content: dynamic(() =>
            import('./demo-section-cotacao-v2').then((m) => m.CotacaoV2Section),
          ),
        },
        {
          id: 'embarque-po',
          title: 'Embarque via PO',
          description: 'A revisão da Freitas na abertura do embarque.',
          Content: dynamic(() =>
            import('./demo-section-embarque-po').then(
              (m) => m.EmbarquePoSection,
            ),
          ),
        },
        {
          id: 'fechamento-direto',
          title: 'Fechamento direto',
          description:
            'Pedidos com o agente preferido da rota, na revisão de entrada.',
          Content: dynamic(() =>
            import('./demo-section-direct-close').then(
              (m) => m.DirectCloseSection,
            ),
          ),
        },
      ]
    : [];

/**
 * "Tipo de cliente" — existe também em produção. Liga o SaaS puro: Nova
 * cotação, Fechamento direto e Embarque via PO deixam de preencher qualquer
 * coisa sozinhos, e o detalhe do embarque diz de onde vem cada dado.
 */
function ClientKindSection() {
  const selected = useClientKind();
  return (
    <div className="space-y-3">
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Tipo de cliente"
      >
        {(Object.keys(CLIENT_KIND_LABELS) as ClientKind[]).map((kind) => (
          <Button
            key={kind}
            type="button"
            size="sm"
            variant={selected === kind ? 'default' : 'outline'}
            aria-pressed={selected === kind}
            onClick={() => setSelectedClientKind(kind)}
          >
            {CLIENT_KIND_LABELS[kind]}
          </Button>
        ))}
      </div>
      <p className="portal-small text-portal-neutral">
        SaaS puro: sem operação da Freitas por trás. Nova cotação, Fechamento
        direto e Embarque via PO não preenchem nada sozinhos, e o detalhe do
        embarque mostra de onde vem cada dado.
      </p>
    </div>
  );
}

function ResetSection() {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="space-y-3">
      <p className="portal-small text-portal-neutral">
        Apaga o que a demonstração guardou neste navegador e volta ao estado
        inicial. O seu login e o que está no servidor não são tocados.
      </p>
      <Button
        type="button"
        variant="outline"
        className="gap-1.5"
        onClick={() => setConfirming(true)}
      >
        <RotateCcw className="h-4 w-4" />
        Reiniciar demonstração
      </Button>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reiniciar a demonstração?</AlertDialogTitle>
            <AlertDialogDescription>
              Tudo o que a demonstração guardou neste navegador volta ao estado
              inicial. Não há como desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => resetDemoStore()}>
              Reiniciar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/**
 * The sections, in the order they appear. Append, do not insert: whoever is
 * running a demonstration learns where a control is by its position.
 */
function OnboardingSection() {
  const state = useOnboarding();
  return (
    <div className="space-y-2">
      <p className="portal-small text-portal-neutral">
        Tour {state.tourDone ? 'visto' : 'pendente'} · boas-vindas{' '}
        {state.setupDone ? 'feitas' : 'pendentes'} · {state.routes.length}{' '}
        {state.routes.length === 1 ? 'rota preferida' : 'rotas preferidas'}
      </p>
      <p className="portal-small text-portal-neutral">
        Reinicia também o checklist “Primeiros passos” da Home.
      </p>
      <Button size="sm" variant="outline" onClick={() => resetOnboarding()}>
        Reiniciar onboarding
      </Button>
    </div>
  );
}

export const DEMO_SECTIONS: DemoSection[] = [
  {
    id: 'client-kind',
    title: 'Tipo de cliente',
    description: 'Com operação Freitas ou SaaS puro.',
    Content: ClientKindSection,
  },
  ...INTERNAL_SECTIONS,
  {
    id: 'onboarding',
    title: 'Boas-vindas',
    description: 'Tour e configuração inicial do primeiro login.',
    Content: OnboardingSection,
  },
  // "Reiniciar" continua sendo a última: é a ação que encerra uma apresentação.
  {
    id: 'reset',
    title: 'Reiniciar demonstração',
    Content: ResetSection,
  },
];
