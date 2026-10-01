'use client';

// "Sua Home está pronta" (Prompt 4): a revelação no fim das boas-vindas. Diz o
// nome da empresa, as rotas escolhidas e por que a Home está nesta ordem — e
// some quando a pessoa o dispensa. Os cards abaixo entram em sequência
// (`.home-reveal`, desligado para quem pede menos movimento).

import { Sparkles, X } from 'lucide-react';

import { Button } from '@/components/ui/button';

import {
  PERSONA_OPTIONS,
  PRIORITY_OPTIONS,
  placeName,
  type OnboardingState,
} from '../../_shared/onboarding';

export function HomeReadyBanner({
  onboarding,
  onDismiss,
}: {
  onboarding: OnboardingState;
  onDismiss: () => void;
}) {
  const persona = PERSONA_OPTIONS.find((p) => p.id === onboarding.persona);
  const priority = PRIORITY_OPTIONS.find((p) => p.id === onboarding.priority);
  const name = onboarding.company.name;
  return (
    <section
      role="status"
      className="home-reveal relative overflow-hidden rounded-xl border border-brand-orange/40 bg-card p-5"
      style={{ ['--reveal-index' as string]: 0 }}
    >
      <span
        aria-hidden="true"
        className="welcome-orb pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full bg-brand-orange/20 blur-2xl"
      />
      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="portal-h2 flex items-center gap-2">
            <Sparkles
              className="h-6 w-6 text-brand-orange"
              aria-hidden="true"
            />
            Sua Home está pronta{name ? `, ${name}` : ''}
          </p>
          <p className="portal-body text-portal-neutral">
            {persona || priority
              ? `Organizada para ${persona ? `quem é de ${persona.label}` : 'você'}${priority ? `, com ${priority.label.toLowerCase()} em primeiro lugar` : ''}.`
              : 'Organizada com os seus temas.'}{' '}
            Dá para mudar em Personalizar.
          </p>
          {onboarding.routes.length > 0 && (
            <ul className="flex flex-wrap gap-1.5 pt-1" aria-label="Suas rotas">
              {onboarding.routes.map((route) => (
                <li
                  key={`${route.origin}>${route.destination}`}
                  className="portal-small rounded-full bg-brand-indigo-100 px-2.5 py-0.5 font-medium text-brand-indigo"
                >
                  {placeName(route.origin)} → {placeName(route.destination)}
                </li>
              ))}
            </ul>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-11 w-11"
          aria-label="Fechar aviso de Home pronta"
          onClick={onDismiss}
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </Button>
      </div>
    </section>
  );
}
