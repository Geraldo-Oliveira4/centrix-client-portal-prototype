'use client';

// O fluxo de boas-vindas do primeiro login: BOAS-VINDAS (três perguntas e o
// mapa de rotas, `welcome-wizard.tsx`) -> a Home se monta com o perfil
// escolhido -> MINI TOUR opcional de 4 paradas (Prompt 5; 07/10/2026 ganhou a
// parada Performance, entre a Central e a Ajuda). Montado no layout do portal, para funcionar
// em qualquer tela de entrada. Regras em `onboarding.ts`.
//
// Acessibilidade: o card do tour e o assistente são diálogos modais do Radix
// (foco preso, Esc fecha, foco devolvido). No tour, Esc = "Pular tour".

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import * as DialogPrimitive from '@radix-ui/react-dialog';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { portalFont } from '../portal-font';

import { usePortalModuleFlags } from './demo/use-feature-flags';
import { tourStepLabel, visibleTourSteps } from './onboarding';
import { useBottomActionBar } from './use-bottom-action-bar';
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

/** Quanto as barras de rodapé ocupam (mecanismo global do #19). */
function floatingOffset(): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(
    '--floating-bottom-offset',
  );
  return Number.parseFloat(raw) || 0;
}

const CARD_W = 352;
const CARD_H = 300; // estimativa com CTA; o card nunca passa disso a 352px
const MOBILE_MAX = 639;

/**
 * Onde o card fica. Ao lado do alvo quando cabe; senão embaixo/em cima. Duas
 * regras novas (07/10/2026): o card NUNCA cobre o título principal da tela
 * (`main h1` — na Home é a saudação do banner) e nunca desce sobre o botão
 * Ajuda nem sobre uma barra presa ao rodapé.
 */
function cardStyle(rect: DOMRect | null): React.CSSProperties | undefined {
  if (!rect) return undefined;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const bottomLimit = vh - floatingOffset() - 16 - 60; // 60 = Ajuda + margem
  let left: number;
  let top: number;
  if (rect.right + 16 + CARD_W < vw) {
    left = rect.right + 16;
    top = rect.top - 16;
  } else {
    left = Math.max(16, Math.min(rect.left, vw - CARD_W - 16));
    top = rect.top - CARD_H - 16;
    if (top < 16) top = rect.bottom + 16;
  }
  const title = document.querySelector('main h1');
  if (title) {
    const t = title.getBoundingClientRect();
    const overlapsX = left < t.right && left + CARD_W > t.left;
    const overlapsY = top < t.bottom && top + CARD_H > t.top;
    if (t.height > 0 && overlapsX && overlapsY) top = t.bottom + 16;
  }
  top = Math.max(16, Math.min(top, bottomLimit - CARD_H));
  return { left, top };
}

function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const q = window.matchMedia(`(max-width: ${MOBILE_MAX}px)`);
    const update = () => setMobile(q.matches);
    update();
    q.addEventListener('change', update);
    return () => q.removeEventListener('change', update);
  }, []);
  return mobile;
}

function Tour({ onFinish }: { onFinish: () => void }) {
  const flags = usePortalModuleFlags();
  const steps = visibleTourSteps(flags);
  const router = useRouter();
  const mobile = useIsMobile();
  // No celular o card é folha de baixo e se registra como barra de rodapé: o
  // botão Ajuda sobe acima dela em vez de ficar escondido embaixo.
  const sheetRef = useBottomActionBar();
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
  const style = mobile ? undefined : cardStyle(rect);

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
          ref={mobile ? sheetRef : undefined}
          className={cn(
            // Portal do Radix monta fora do layout: a fonte do portal vem aqui.
            portalFont.variable,
            'font-[family-name:var(--font-source-sans)]',
            'fixed z-50 space-y-3 border bg-card p-5 shadow-lg focus-visible:outline-none',
            mobile
              ? 'inset-x-0 bottom-0 rounded-t-2xl pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]'
              : 'w-[22rem] max-w-[calc(100vw-2rem)] rounded-lg',
            !mobile && !style && 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
          )}
          style={style}
        >
          <p className="portal-small font-medium text-portal-neutral">
            {tourStepLabel(index, steps.length)}
          </p>
          <DialogPrimitive.Title className="portal-h3">
            {step.title}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="portal-body text-foreground/80">
            {step.body}
          </DialogPrimitive.Description>
          {step.cta && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                onFinish();
                router.push(step.cta!.href);
              }}
            >
              {step.cta.label}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <Button
              variant="ghost"
              className="text-portal-neutral"
              onClick={onFinish}
            >
              Pular
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

// O tour espera a Home terminar de "se montar" (os cards entram em sequência
// por ~1,5 s) para não destacar o menu por cima da revelação.
const TOUR_DELAY_AFTER_REVEAL_MS = 1800;

export function OnboardingFlow() {
  const state = useOnboarding();
  const pathname = usePathname();
  // Montado so no cliente: o estado vive no localStorage e o SSR nao o ve.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const tourPending = mounted && state.setupDone && !state.tourDone;
  // Quem saiu das boas-vindas direto para "Cotar esta rota agora" está no meio
  // de um formulário: o tour espera ele sair dali.
  const tourHere = tourPending && !pathname?.startsWith('/portal/nova-cotacao');
  const [tourReady, setTourReady] = useState(false);
  useEffect(() => {
    if (!tourHere) {
      setTourReady(false);
      return;
    }
    const delay = state.revealPending ? TOUR_DELAY_AFTER_REVEAL_MS : 300;
    const id = window.setTimeout(() => setTourReady(true), delay);
    return () => window.clearTimeout(id);
  }, [tourHere, state.revealPending]);

  if (!mounted) return null;
  if (!state.setupDone) return <WelcomeWizard initial={state} />;
  if (tourHere && tourReady) {
    return <Tour onFinish={() => updateOnboarding({ tourDone: true })} />;
  }
  return null;
}
