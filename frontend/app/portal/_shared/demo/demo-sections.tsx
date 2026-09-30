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

import { useState, type ComponentType } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

import {
  ALWAYS_ON_PORTAL_AREAS,
  PORTAL_MODULES,
  PORTAL_MODULE_DESCRIPTIONS,
  PORTAL_MODULE_LABELS,
  PORTAL_WAVE_PRESETS,
  matchingWave,
} from './feature-flags';
import {
  MAX_FREITAS_DELAY_SECONDS,
  MIN_FREITAS_DELAY_SECONDS,
  clampFreitasDelay,
} from './freitas-simulation';
import { resetDemoStore } from './use-demo-store';
import {
  applyPortalWave,
  setPortalModuleFlag,
  usePortalModuleFlags,
} from './use-feature-flags';
import {
  setFreitasSimulation,
  useFreitasSimulation,
} from './use-freitas-simulation';
import { CotacaoV2Section } from './demo-section-cotacao-v2';
import { DirectCloseSection } from './demo-section-direct-close';
import { EmbarquePoSection } from './demo-section-embarque-po';

export interface DemoSection {
  /** Stable key. Also the anchor a later prompt can point at. */
  id: string;
  title: string;
  /** One line under the title. Optional. */
  description?: string;
  Content: ComponentType;
}

function ModulesSection() {
  const flags = usePortalModuleFlags();
  const current = matchingWave(flags);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {PORTAL_WAVE_PRESETS.map((wave) => (
          <Button
            key={wave.id}
            type="button"
            size="sm"
            variant={current === wave.id ? 'default' : 'outline'}
            onClick={() => applyPortalWave(wave.id)}
            title={wave.description}
          >
            {wave.label}
          </Button>
        ))}
      </div>

      <ul className="space-y-3">
        {PORTAL_MODULES.map((module) => (
          <li key={module} className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-0.5">
              <Label
                htmlFor={`demo-module-${module}`}
                className="portal-body font-medium text-foreground"
              >
                {PORTAL_MODULE_LABELS[module]}
              </Label>
              <p className="portal-small text-portal-neutral">
                {PORTAL_MODULE_DESCRIPTIONS[module]}
              </p>
            </div>
            <Switch
              id={`demo-module-${module}`}
              checked={flags[module]}
              onCheckedChange={(checked) =>
                setPortalModuleFlag(flags, module, checked)
              }
              aria-label={PORTAL_MODULE_LABELS[module]}
            />
          </li>
        ))}
      </ul>

      {/* Says why three menu items have no switch, instead of leaving whoever
          is presenting to discover it by looking for them. */}
      <p className="portal-small text-portal-neutral">
        Sempre liberados, sem chave: {ALWAYS_ON_PORTAL_AREAS.join(', ')}.
      </p>
    </div>
  );
}

function FreitasSection() {
  const simulation = useFreitasSimulation();
  // The field is held as text while it is being typed: clamping on every
  // keystroke makes "1" jump to "3" before the client can type "12".
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? String(simulation.delaySeconds);

  const commit = () => {
    const parsed = Number.parseInt(shown, 10);
    setFreitasSimulation({
      ...simulation,
      delaySeconds: Number.isNaN(parsed)
        ? simulation.delaySeconds
        : clampFreitasDelay(parsed),
    });
    setDraft(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <Label
            htmlFor="demo-freitas-auto"
            className="portal-body font-medium text-foreground"
          >
            A Freitas responde sozinha
          </Label>
          <p className="portal-small text-portal-neutral">
            O analista simulado responde sem ninguém clicar.
          </p>
        </div>
        <Switch
          id="demo-freitas-auto"
          checked={simulation.autoRespond}
          onCheckedChange={(checked) =>
            setFreitasSimulation({ ...simulation, autoRespond: checked })
          }
          aria-label="A Freitas responde sozinha"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="demo-freitas-delay" className="portal-small">
          Tempo de resposta (segundos)
        </Label>
        <Input
          id="demo-freitas-delay"
          type="number"
          inputMode="numeric"
          min={MIN_FREITAS_DELAY_SECONDS}
          max={MAX_FREITAS_DELAY_SECONDS}
          value={shown}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          className="w-28"
        />
        <p className="portal-small text-portal-neutral">
          Entre {MIN_FREITAS_DELAY_SECONDS} e {MAX_FREITAS_DELAY_SECONDS}{' '}
          segundos.
        </p>
      </div>

      {/* The honest part: the setting is saved, nothing reads it yet. */}
      <p className="portal-small text-portal-neutral">
        A escolha fica salva. A resposta automática ainda não está ligada a
        nenhuma tela.
      </p>
    </div>
  );
}

function ResetSection() {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="space-y-3">
      <p className="portal-small text-portal-neutral">
        Apaga os módulos liberados, a Freitas simulada e o que os próximos
        controles guardarem. Cotações, embarques e o seu login não são tocados.
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
              Tudo o que este painel guardou volta ao estado inicial: todos os
              módulos liberados e a Freitas simulada desligada. Não há como
              desfazer.
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
export const DEMO_SECTIONS: DemoSection[] = [
  {
    id: 'modules',
    title: 'Módulos liberados',
    description: 'O que esta empresa enxerga no portal.',
    Content: ModulesSection,
  },
  {
    id: 'freitas',
    title: 'Freitas simulada',
    description: 'O analista que responde do outro lado.',
    Content: FreitasSection,
  },
  {
    id: 'cotacao-v2',
    title: 'Cotação V2',
    description: 'A revisão da Freitas: de entrada (Inbox) e de saída.',
    Content: CotacaoV2Section,
  },
  {
    id: 'embarque-po',
    title: 'Embarque via PO',
    description: 'A revisão da Freitas na abertura do embarque.',
    Content: EmbarquePoSection,
  },
  // Acrescentada depois das seções existentes; "Reiniciar" continua sendo a
  // última, porque é a ação que encerra uma apresentação.
  {
    id: 'fechamento-direto',
    title: 'Fechamento direto',
    description:
      'Pedidos com o agente preferido da rota, na revisão de entrada.',
    Content: DirectCloseSection,
  },
  {
    id: 'reset',
    title: 'Reiniciar demonstração',
    Content: ResetSection,
  },
];
