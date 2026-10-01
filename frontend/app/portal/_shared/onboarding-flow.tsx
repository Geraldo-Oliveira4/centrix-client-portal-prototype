'use client';

// O fluxo de boas-vindas do primeiro login: TOUR -> BOAS-VINDAS (três
// perguntas e o mapa de rotas, `welcome-wizard.tsx`, desde 01/10/2026) -> a
// Home se monta com o perfil escolhido. Montado no layout do portal, para
// funcionar em qualquer tela de entrada. Regras em `onboarding.ts`.
//
// Acessibilidade: o card do tour e o assistente são diálogos modais do Radix
// (foco preso, Esc fecha, foco devolvido). No tour, Esc = "Pular tour".

import { useCallback, useEffect, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { portalFont } from '../portal-font';

import { usePortalModuleFlags } from './demo/use-feature-flags';
import { visibleTourSteps } from './onboarding';
import { updateOnboarding, useOnboarding } from './use-onboarding';
import { WelcomeWizard } from './welcome-wizard';

// ── Tour ────────────────────────────────────────────────────────────────────

function visibleRect(selector: string | undefined): DOMRect | null {
  if (!selector) return null;
  const el = document.querySelector(selector);
  if (!(el instanceof HTMLElement)) return null;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 ? rect : null;
}

function Tour({ onFinish }: { onFinish: () => void }) {
  const flags = usePortalModuleFlags();
  const steps = visibleTourSteps(flags);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const step = steps[Math.min(index, steps.length - 1)];

  const measure = useCallback(() => setRect(visibleRect(step?.target)), [step]);
  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [measure]);

  if (!step) return null;
  const last = index === steps.length - 1;
  // Card ao lado do alvo quando ha espaco; senao embaixo; sem alvo (ou no
  // celular, onde o menu esta fechado), centralizado.
  const CARD_W = 352;
  const style: React.CSSProperties | undefined = rect
    ? rect.right + 16 + CARD_W < window.innerWidth
      ? {
          left: rect.right + 16,
          top: Math.max(16, Math.min(rect.top - 16, window.innerHeight - 280)),
        }
      : {
          left: Math.max(
            16,
            Math.min(rect.left, window.innerWidth - CARD_W - 16),
          ),
          top: Math.max(16, rect.top - 250),
        }
    : undefined;

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && onFinish()}>
      <DialogPrimitive.Portal>
        {/* Destaque: um recorte no veu escuro em volta do alvo. Sem alvo, o
            veu cobre a tela inteira. Decorativo (aria-hidden). */}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-50"
          style={rect ? undefined : { background: 'rgba(26, 28, 49, 0.55)' }}
        >
          {rect && (
            <div
              className="absolute rounded-lg ring-2 ring-primary transition-all duration-200 motion-reduce:transition-none"
              style={{
                left: rect.left - 6,
                top: rect.top - 6,
                width: rect.width + 12,
                height: rect.height + 12,
                boxShadow: '0 0 0 9999px rgba(26, 28, 49, 0.55)',
              }}
            />
          )}
        </div>
        <DialogPrimitive.Content
          className={cn(
            // Portal do Radix monta fora do layout: a fonte do portal vem aqui.
            portalFont.variable,
            'font-[family-name:var(--font-source-sans)]',
            'fixed z-50 w-[22rem] max-w-[calc(100vw-2rem)] space-y-3 rounded-lg border bg-card p-5 shadow-lg focus-visible:outline-none',
            !style && 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
          )}
          style={style}
        >
          <p className="portal-small font-medium text-portal-neutral">
            {index + 1} de {steps.length}
          </p>
          <DialogPrimitive.Title className="portal-h3">
            {step.title}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="portal-body text-foreground/80">
            {step.body}
          </DialogPrimitive.Description>
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <Button
              variant="ghost"
              className="text-portal-neutral"
              onClick={onFinish}
            >
              Pular tour
            </Button>
            <div className="flex gap-2">
              {index > 0 && (
                <Button variant="outline" onClick={() => setIndex(index - 1)}>
                  Voltar
                </Button>
              )}
              <Button onClick={() => (last ? onFinish() : setIndex(index + 1))}>
                {last ? 'Concluir' : 'Próximo'}
              </Button>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

// ── Configuração inicial ───────────────────────────────────────────────────

export function OnboardingFlow() {
  const state = useOnboarding();
  // Montado so no cliente: o estado vive no localStorage e o SSR nao o ve.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  if (!state.tourDone) {
    return <Tour onFinish={() => updateOnboarding({ tourDone: true })} />;
  }
  if (!state.setupDone) return <WelcomeWizard initial={state} />;
  return null;
}
