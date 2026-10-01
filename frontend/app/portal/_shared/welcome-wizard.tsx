'use client';

// Boas-vindas "uau" (Prompt 4, 01/10/2026) — substitui a antiga "configuração
// inicial" no fluxo tour → boas-vindas → Home.
//
// Feedback do Vinicius: o onboarding era "só funcional". Aqui são quatro telas
// curtas — a saudação com o nome da empresa e três perguntas em cartões
// (prioridade, rotas num mapa, papel) — e, no fim, a Home "se monta" com o que
// foi escolhido. Regras que não afrouxam:
//   - ~90 s no máximo, "Pular" visível em TODAS as telas (Esc também pula);
//   - retomável: cada resposta e a tela atual vão para o store na hora;
//   - nada de número inventado apresentado como real: o insight da rota leva a
//     etiqueta "exemplo" e sai de uma tabela fictícia (`routeExample`);
//   - nenhuma menção à operação da Freitas, para servir também ao SaaS puro.
//
// Acessibilidade: diálogo modal do Radix (foco preso e devolvido), cartões são
// botões com `aria-pressed`, o mapa tem pontos focáveis e a mesma escolha está
// nos botões de lista ao lado — o mapa nunca é o único caminho.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  ArrowRight,
  BadgeDollarSign,
  Briefcase,
  Calculator,
  Clock3,
  Eye,
  LineChart,
  Ship,
  ShoppingCart,
  Sparkles,
  X,
} from 'lucide-react';
import { toast } from 'react-toastify';

import { Button } from '@/components/ui/button';
import { useMyClient } from '@/hooks/use-portal-quotations';
import {
  saveMyHomeLayout,
  useMyHomeLayout,
} from '@/hooks/use-portal-home-layout';
import { cn } from '@/lib/utils';

import { portalFont } from '../portal-font';

import {
  MAX_WELCOME_ROUTES,
  PERSONA_OPTIONS,
  PRIORITY_OPTIONS,
  ROUTE_DESTINATIONS,
  ROUTE_ORIGINS,
  WIZARD_STEPS,
  placeName,
  routeExample,
  routeIssue,
  themesForProfile,
  type OnboardingState,
  type Persona,
  type PreferredRoute,
  type Priority,
} from './onboarding';
import { RouteMap } from './route-map';
import { updateOnboarding } from './use-onboarding';

const PRIORITY_ICON = {
  custo: BadgeDollarSign,
  prazo: Clock3,
  visibilidade: Eye,
} as const;
const PERSONA_ICON = {
  comex: Ship,
  compras: ShoppingCart,
  financeiro: Calculator,
  gestor: Briefcase,
} as const;

function ChoiceCard({
  selected,
  onClick,
  icon: Icon,
  label,
  hint,
}: {
  selected: boolean;
  onClick: () => void;
  icon: typeof Ship;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'group flex min-h-24 flex-col items-start gap-2 rounded-xl border bg-card p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-safe:hover:-translate-y-0.5',
        selected
          ? 'border-brand-orange shadow-md ring-2 ring-brand-orange/40'
          : 'border-border hover:border-brand-indigo-800/40 hover:shadow-sm',
      )}
    >
      <span
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
          selected
            ? 'bg-brand-orange text-brand-navy'
            : 'bg-brand-indigo-100 text-brand-indigo',
        )}
      >
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <span className="portal-body font-medium text-foreground">{label}</span>
      <span className="portal-small text-portal-neutral">{hint}</span>
    </button>
  );
}

function StepDots({ step }: { step: number }) {
  return (
    <ol
      className="flex items-center gap-1.5"
      aria-label={`Etapa ${step + 1} de ${WIZARD_STEPS.length}`}
    >
      {WIZARD_STEPS.map((id, i) => (
        <li
          key={id}
          aria-current={i === step ? 'step' : undefined}
          className={cn(
            'h-1.5 rounded-full transition-all motion-safe:duration-300',
            i === step
              ? 'w-8 bg-brand-orange'
              : i < step
                ? 'w-4 bg-brand-indigo'
                : 'w-4 bg-muted',
          )}
        />
      ))}
    </ol>
  );
}

function RouteInsight({
  route,
  onRemove,
}: {
  route: PreferredRoute;
  onRemove: () => void;
}) {
  const example = routeExample(route);
  const name = `${placeName(route.origin)} → ${placeName(route.destination)}`;
  return (
    <li className="rounded-lg border border-border bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="portal-body font-medium text-foreground">{name}</span>
        <span className="flex items-center gap-2">
          {example && (
            <span className="portal-small rounded-full border border-dashed border-portal-neutral px-2 py-0.5 text-portal-neutral">
              exemplo
            </span>
          )}
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remover a rota ${name}`}
            className="portal-small rounded px-1.5 py-0.5 text-portal-neutral underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Remover
          </button>
        </span>
      </div>
      {example && (
        <>
          <p className="portal-small mt-1 flex flex-wrap gap-x-3 text-portal-neutral">
            <span className="inline-flex items-center gap-1">
              <Clock3 className="h-4 w-4" aria-hidden="true" /> Prazo típico{' '}
              {example.transit}
            </span>
            <span className="inline-flex items-center gap-1">
              <LineChart className="h-4 w-4" aria-hidden="true" />{' '}
              {example.trendLabel}
            </span>
          </p>
          <p className="portal-small mt-1 text-foreground/80">
            {example.sentence}
          </p>
        </>
      )}
    </li>
  );
}

export function WelcomeWizard({ initial }: { initial: OnboardingState }) {
  const router = useRouter();
  const { client } = useMyClient();
  const { layout, mutate } = useMyHomeLayout();
  const [step, setStepState] = useState(initial.wizardStep);
  const [priority, setPriority] = useState<Priority | ''>(initial.priority);
  const [persona, setPersona] = useState<Persona | ''>(initial.persona);
  const [routes, setRoutes] = useState<PreferredRoute[]>(initial.routes);
  const [draft, setDraft] = useState<{ origin?: string; destination?: string }>(
    {},
  );
  const [routeError, setRouteError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);

  const companyName = initial.company.name || client?.name || '';

  // Retomável: cada resposta vai para o store na hora, junto da tela atual.
  useEffect(() => {
    updateOnboarding({ wizardStep: step, priority, persona, routes });
  }, [step, priority, persona, routes]);

  const setStep = (next: number) =>
    setStepState(Math.max(0, Math.min(WIZARD_STEPS.length - 1, next)));

  const pick = (code: string) => {
    setRouteError(null);
    if (ROUTE_ORIGINS.some((p) => p.code === code))
      setDraft((d) => ({ ...d, origin: code }));
    else setDraft((d) => ({ ...d, destination: code }));
  };

  const addRoute = () => {
    const issue = routeIssue(draft, routes);
    if (issue) {
      setRouteError(issue);
      return;
    }
    const origin = ROUTE_ORIGINS.find((p) => p.code === draft.origin)!;
    setRoutes([
      ...routes,
      {
        origin: origin.code,
        destination: draft.destination!,
        modal: origin.modal,
      },
    ]);
    setDraft({});
  };

  const finish = async (skipped: boolean) => {
    setFinishing(true);
    const themes = themesForProfile(
      skipped ? '' : persona,
      skipped ? '' : priority,
    );
    // Pular não monta a Home do zero se ela já existe; concluir sempre grava
    // os temas do perfil — é o que a pessoa acabou de escolher.
    if (!skipped || !layout) {
      await saveMyHomeLayout({ themes }, (data) =>
        mutate(data, { revalidate: false }),
      );
    }
    updateOnboarding({
      setupDone: true,
      wizardStep: 0,
      priority,
      persona,
      routes,
      company: { ...initial.company, name: companyName },
      revealPending: !skipped,
    });
    setFinishing(false);
    if (skipped) toast.info('Tudo bem. Você personaliza a Home quando quiser.');
    router.push('/portal/home');
  };

  const canAdd =
    !!draft.origin && !!draft.destination && routes.length < MAX_WELCOME_ROUTES;

  return (
    <DialogPrimitive.Root
      open
      onOpenChange={(open) => !open && !finishing && finish(true)}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-brand-navy/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          onInteractOutside={(event) => event.preventDefault()}
          className={cn(
            portalFont.variable,
            'font-[family-name:var(--font-source-sans)]',
            'fixed left-1/2 top-1/2 z-50 flex max-h-[92dvh] w-[calc(100vw-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl focus:outline-none',
          )}
        >
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-3">
            <StepDots step={step} />
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 gap-1 text-portal-neutral"
              onClick={() => finish(true)}
              disabled={finishing}
            >
              Pular <X className="h-5 w-5" aria-hidden="true" />
            </Button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8">
            {step === 0 && (
              <div className="relative overflow-hidden rounded-xl bg-brand-navy px-6 py-10 text-white">
                <span
                  aria-hidden="true"
                  className="welcome-orb pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-brand-orange/40 blur-3xl"
                />
                <span
                  aria-hidden="true"
                  className="welcome-orb pointer-events-none absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-brand-indigo-300/30 blur-3xl"
                />
                <Sparkles
                  className="relative h-6 w-6 text-brand-orange"
                  aria-hidden="true"
                />
                <DialogPrimitive.Title className="portal-h1 relative mt-3 text-white">
                  {companyName
                    ? `Bem-vindo, ${companyName}`
                    : 'Bem-vindo ao Centrix'}
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="portal-body relative mt-2 max-w-md text-white/80">
                  Três perguntas rápidas e a sua Home fica pronta, com as suas
                  rotas e o que importa para você. Leva menos de um minuto.
                </DialogPrimitive.Description>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <DialogPrimitive.Title className="portal-h2">
                  O que mais importa para você?
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="portal-small text-portal-neutral">
                  Usamos isso para escolher o que aparece primeiro na sua Home.
                </DialogPrimitive.Description>
                <div className="grid gap-3 sm:grid-cols-3">
                  {PRIORITY_OPTIONS.map((option) => (
                    <ChoiceCard
                      key={option.id}
                      selected={priority === option.id}
                      onClick={() => setPriority(option.id)}
                      icon={PRIORITY_ICON[option.id]}
                      label={option.label}
                      hint={option.hint}
                    />
                  ))}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <DialogPrimitive.Title className="portal-h2">
                  Quais são as suas rotas principais?
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="portal-small text-portal-neutral">
                  Escolha a origem e o destino — no mapa ou nos botões. Até{' '}
                  {MAX_WELCOME_ROUTES} rotas.
                </DialogPrimitive.Description>
                <RouteMap routes={routes} draft={draft} onPick={pick} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <fieldset className="space-y-1.5">
                    <legend className="portal-small font-medium text-foreground">
                      Origem
                    </legend>
                    <div className="flex flex-wrap gap-1.5">
                      {ROUTE_ORIGINS.map((p) => (
                        <button
                          key={p.code}
                          type="button"
                          aria-pressed={draft.origin === p.code}
                          onClick={() => pick(p.code)}
                          className={cn(
                            'portal-small min-h-9 rounded-full border px-3 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            draft.origin === p.code
                              ? 'border-brand-orange bg-brand-orange text-brand-navy'
                              : 'border-border bg-card text-foreground hover:bg-muted/50',
                          )}
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <fieldset className="space-y-1.5">
                    <legend className="portal-small font-medium text-foreground">
                      Destino
                    </legend>
                    <div className="flex flex-wrap gap-1.5">
                      {ROUTE_DESTINATIONS.map((p) => (
                        <button
                          key={p.code}
                          type="button"
                          aria-pressed={draft.destination === p.code}
                          onClick={() => pick(p.code)}
                          className={cn(
                            'portal-small min-h-9 rounded-full border px-3 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            draft.destination === p.code
                              ? 'border-brand-orange bg-brand-orange text-brand-navy'
                              : 'border-border bg-card text-foreground hover:bg-muted/50',
                          )}
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addRoute}
                    disabled={!canAdd}
                  >
                    Adicionar rota
                  </Button>
                  {routeError && (
                    <p
                      className="portal-small text-portal-danger-ink"
                      role="alert"
                    >
                      {routeError}
                    </p>
                  )}
                </div>
                {routes.length > 0 && (
                  <ul className="space-y-2" aria-label="Rotas escolhidas">
                    {routes.map((route) => (
                      <RouteInsight
                        key={`${route.origin}>${route.destination}`}
                        route={route}
                        onRemove={() =>
                          setRoutes(routes.filter((r) => r !== route))
                        }
                      />
                    ))}
                  </ul>
                )}
                {routes.length > 0 && (
                  <p className="portal-small text-portal-neutral">
                    Os números acima são um exemplo, para mostrar o que você vai
                    ver. Com os seus embarques, eles passam a ser os da sua
                    operação.
                  </p>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <DialogPrimitive.Title className="portal-h2">
                  Qual é o seu papel?
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="portal-small text-portal-neutral">
                  Ele define a ordem da sua Home. Dá para mudar depois, em
                  Personalizar.
                </DialogPrimitive.Description>
                <div className="grid gap-3 sm:grid-cols-2">
                  {PERSONA_OPTIONS.map((option) => (
                    <ChoiceCard
                      key={option.id}
                      selected={persona === option.id}
                      onClick={() => setPersona(option.id)}
                      icon={PERSONA_ICON[option.id]}
                      label={option.label}
                      hint={option.hint}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-3">
            <span className="portal-small text-portal-neutral">
              {step === 0
                ? 'Fica salvo neste navegador.'
                : `${step} de ${WIZARD_STEPS.length - 1} perguntas`}
            </span>
            <div className="flex gap-2">
              {step > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(step - 1)}
                  disabled={finishing}
                >
                  Voltar
                </Button>
              )}
              {step < WIZARD_STEPS.length - 1 ? (
                <Button
                  type="button"
                  onClick={() => setStep(step + 1)}
                  className="gap-1.5"
                >
                  {step === 0 ? 'Começar' : 'Continuar'}{' '}
                  <ArrowRight className="h-5 w-5" aria-hidden="true" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => finish(false)}
                  disabled={finishing}
                  className="gap-1.5"
                >
                  Montar minha Home{' '}
                  <Sparkles className="h-5 w-5" aria-hidden="true" />
                </Button>
              )}
            </div>
          </footer>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
