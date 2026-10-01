'use client';

// Seções do painel que são conceito INTERNO (Freitas/Ionix): ondas de
// lançamento e o analista simulado. Só carregadas em build com
// NEXT_PUBLIC_PROTO_INTERNAL=1 (preview), por import dinâmico em
// `demo-sections.tsx`; ficam fora do bundle de produção. Em produção os
// módulos são fixos (todos visíveis) e a Freitas responde sozinha — ver
// `useGlobalModuleFlags` e `useFreitasSimulation`.

import { useState } from 'react';

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
import { useViewingSnapshot } from './use-client-profile';
import {
  applyPortalWave,
  setPortalModuleFlag,
  useGlobalModuleFlags,
} from './use-feature-flags';
import {
  setFreitasSimulation,
  useFreitasSimulation,
} from './use-freitas-simulation';

export function ModulesSection() {
  // The panel edits the GLOBAL default. With "ver como" on, the portal obeys
  // the viewed company instead, and the note below says so.
  const flags = useGlobalModuleFlags();
  const viewed = useViewingSnapshot();
  const current = matchingWave(flags);

  return (
    <div className="space-y-4">
      {viewed && (
        <p className="portal-small rounded-md bg-portal-info/10 px-3 py-2 text-portal-info">
          Você está vendo como {viewed.name}: o portal segue as exceções dela.
          Estes controles mudam o padrão global.
        </p>
      )}
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

export function FreitasSection() {
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
