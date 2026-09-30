'use client';

// O fluxo de boas-vindas do primeiro login (30/09/2026): TOUR -> CONFIGURAÇÃO
// INICIAL -> (na Home) escolha de temas. Montado no layout do portal, para
// funcionar em qualquer tela de entrada. Regras em `onboarding.ts`.
//
// Acessibilidade: o card do tour e o assistente são diálogos modais do Radix
// (foco preso, Esc fecha, foco devolvido). No tour, Esc = "Pular tour".

import { useCallback, useEffect, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { toast } from 'react-toastify';
import { Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useMyClient } from '@/hooks/use-portal-quotations';
import { cn } from '@/lib/utils';

import { usePortalModuleFlags } from './demo/use-feature-flags';
import {
  NOTIFY_EVENTS,
  ROUTE_DESTINATIONS,
  ROUTE_ORIGINS,
  contactIssue,
  routeIssue,
  routeKey,
  routeLabel,
  visibleTourSteps,
  type NotifyContact,
  type NotifyEvent,
  type OnboardingState,
  type PreferredRoute,
} from './onboarding';
import { updateOnboarding, useOnboarding } from './use-onboarding';

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

const SEGMENTS = ['Indústria', 'Comércio e varejo', 'Distribuição', 'Outro'];
const ROLES = ['Importadora', 'Exportadora', 'Importadora e exportadora'];
const STEP_TITLES = [
  'Sua empresa',
  'Suas rotas preferidas',
  'Quem recebe notificações',
];

function Stepper({ step }: { step: number }) {
  return (
    <ol
      className="flex flex-wrap gap-x-4 gap-y-1"
      aria-label="Passos da configuração"
    >
      {STEP_TITLES.map((title, i) => (
        <li
          key={title}
          aria-current={i === step ? 'step' : undefined}
          className={cn(
            'portal-small flex items-center gap-1.5',
            i === step ? 'font-medium text-foreground' : 'text-portal-neutral',
          )}
        >
          <span
            className={cn(
              'grid h-5 w-5 place-items-center rounded-full text-[11px]',
              i <= step
                ? 'bg-brand-indigo text-white dark:bg-brand-indigo-700'
                : 'bg-muted',
            )}
          >
            {i + 1}
          </span>
          {title}
        </li>
      ))}
    </ol>
  );
}

function SetupWizard({ initial }: { initial: OnboardingState }) {
  const { client } = useMyClient();
  const [step, setStep] = useState(0);
  const [company, setCompany] = useState(initial.company);
  const [routes, setRoutes] = useState<PreferredRoute[]>(initial.routes);
  const [draftRoute, setDraftRoute] = useState<Partial<PreferredRoute>>({});
  const [routeError, setRouteError] = useState<string | null>(null);
  const [contacts, setContacts] = useState<NotifyContact[]>(initial.contacts);
  const [draftContact, setDraftContact] = useState<Partial<NotifyContact>>({});
  const [contactError, setContactError] = useState<string | null>(null);
  const [events, setEvents] = useState<NotifyEvent[]>(initial.events);

  useEffect(() => {
    if (!company.name && client?.name)
      setCompany((c) => ({ ...c, name: client.name }));
  }, [client, company.name]);

  const save = (setupDone: boolean) =>
    updateOnboarding({ setupDone, company, routes, contacts, events });

  const later = () => {
    save(true);
    toast.info('Tudo bem. Você completa isto quando quiser, em Configurações.');
  };

  const addRoute = () => {
    const origin = ROUTE_ORIGINS.find((p) => p.code === draftRoute.origin);
    const issue = routeIssue(draftRoute, routes);
    setRouteError(issue);
    if (issue || !origin) return;
    setRoutes([
      ...routes,
      {
        origin: origin.code,
        destination: draftRoute.destination!,
        modal: origin.modal,
      },
    ]);
    setDraftRoute({});
  };

  const addContact = () => {
    const issue = contactIssue(draftContact);
    setContactError(issue);
    if (issue) return;
    setContacts([
      ...contacts,
      { name: draftContact.name!.trim(), email: draftContact.email!.trim() },
    ]);
    setDraftContact({});
  };

  const companyMissing = !company.name.trim();

  return (
    <Dialog open onOpenChange={(open) => !open && later()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader className="space-y-3 text-left">
          <Stepper step={step} />
          <DialogTitle className="portal-h3">{STEP_TITLES[step]}</DialogTitle>
          <DialogDescription>
            {step === 0
              ? 'Três passos rápidos para o portal já abrir com a sua cara. Tudo fica salvo só neste navegador.'
              : step === 1
                ? 'As rotas que você mais usa. Elas aparecem marcadas em Configurações e no Radar de preços.'
                : 'Quem da sua equipe deve ser avisado, e sobre o quê. Use dados de exemplo nesta demonstração.'}
          </DialogDescription>
        </DialogHeader>

        {step === 0 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="onb-empresa">Nome da empresa</Label>
              <Input
                id="onb-empresa"
                value={company.name}
                onChange={(e) =>
                  setCompany({ ...company, name: e.target.value })
                }
                placeholder="Ex.: Aurora Indústria"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="onb-segmento">Segmento</Label>
                <Select
                  value={company.segment}
                  onValueChange={(segment) =>
                    setCompany({ ...company, segment })
                  }
                >
                  <SelectTrigger id="onb-segmento">
                    <SelectValue placeholder="Selecionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {SEGMENTS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="onb-papel">Sua empresa é</Label>
                <Select
                  value={company.role}
                  onValueChange={(role) => setCompany({ ...company, role })}
                >
                  <SelectTrigger id="onb-papel">
                    <SelectValue placeholder="Selecionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <div className="space-y-2">
                <Label htmlFor="onb-origem">Origem</Label>
                <Select
                  value={draftRoute.origin ?? ''}
                  onValueChange={(origin) =>
                    setDraftRoute({ ...draftRoute, origin })
                  }
                >
                  <SelectTrigger id="onb-origem">
                    <SelectValue placeholder="Selecionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {ROUTE_ORIGINS.map((p) => (
                      <SelectItem key={p.code} value={p.code}>
                        {p.name} · {p.modal === 'AEREO' ? 'aeroporto' : 'porto'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="onb-destino">Destino</Label>
                <Select
                  value={draftRoute.destination ?? ''}
                  onValueChange={(destination) =>
                    setDraftRoute({ ...draftRoute, destination })
                  }
                >
                  <SelectTrigger id="onb-destino">
                    <SelectValue placeholder="Selecionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {ROUTE_DESTINATIONS.map((p) => (
                      <SelectItem key={p.code} value={p.code}>
                        {p.name} · {p.modal === 'AEREO' ? 'aeroporto' : 'porto'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-11 gap-1.5"
                onClick={addRoute}
              >
                <Plus className="h-5 w-5" /> Adicionar
              </Button>
            </div>
            {routeError && (
              <p role="alert" className="portal-small text-portal-danger-ink">
                {routeError}
              </p>
            )}
            {routes.length === 0 ? (
              <p className="portal-small text-portal-neutral">
                Nenhuma rota ainda. Você também pode acrescentar depois, em
                Configurações.
              </p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {routes.map((route) => (
                  <li
                    key={routeKey(route)}
                    className="portal-small inline-flex items-center gap-1 rounded-full border bg-muted/40 py-0.5 pl-3 pr-1"
                  >
                    {routeLabel(route)}
                    <button
                      type="button"
                      aria-label={`Remover ${routeLabel(route)}`}
                      className="grid h-8 w-8 place-items-center rounded-full hover:bg-muted"
                      onClick={() =>
                        setRoutes(
                          routes.filter((r) => routeKey(r) !== routeKey(route)),
                        )
                      }
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <div className="space-y-2">
                <Label htmlFor="onb-nome">Nome</Label>
                <Input
                  id="onb-nome"
                  value={draftContact.name ?? ''}
                  onChange={(e) =>
                    setDraftContact({ ...draftContact, name: e.target.value })
                  }
                  placeholder="Ex.: Equipe de compras"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="onb-email">E-mail</Label>
                <Input
                  id="onb-email"
                  type="email"
                  value={draftContact.email ?? ''}
                  onChange={(e) =>
                    setDraftContact({ ...draftContact, email: e.target.value })
                  }
                  placeholder="compras@suaempresa.com.br"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-11 gap-1.5"
                onClick={addContact}
              >
                <Plus className="h-5 w-5" /> Adicionar
              </Button>
            </div>
            {contactError && (
              <p role="alert" className="portal-small text-portal-danger-ink">
                {contactError}
              </p>
            )}
            {contacts.length > 0 && (
              <ul className="space-y-1">
                {contacts.map((c) => (
                  <li
                    key={c.email}
                    className="portal-small flex items-center justify-between gap-2 rounded-md border px-3 py-1"
                  >
                    <span className="min-w-0 truncate">
                      {c.name} · {c.email}
                    </span>
                    <button
                      type="button"
                      aria-label={`Remover ${c.name}`}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-full hover:bg-muted"
                      onClick={() =>
                        setContacts(contacts.filter((x) => x.email !== c.email))
                      }
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <fieldset className="space-y-2">
              <legend className="portal-body mb-1 font-medium">
                Avisar sobre
              </legend>
              {(Object.keys(NOTIFY_EVENTS) as NotifyEvent[]).map((key) => (
                <label
                  key={key}
                  className="portal-body flex min-h-11 items-center gap-2.5"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[hsl(var(--primary))]"
                    checked={events.includes(key)}
                    onChange={(e) =>
                      setEvents(
                        e.target.checked
                          ? [...events, key]
                          : events.filter((x) => x !== key),
                      )
                    }
                  />
                  {NOTIFY_EVENTS[key]}
                </label>
              ))}
            </fieldset>
          </div>
        )}

        <DialogFooter className="flex-wrap gap-2 sm:justify-between">
          <Button
            variant="ghost"
            className="text-portal-neutral"
            onClick={later}
          >
            Configurar depois
          </Button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep(step - 1)}>
                Voltar
              </Button>
            )}
            <Button
              disabled={step === 0 && companyMissing}
              onClick={() => {
                if (step < 2) {
                  setStep(step + 1);
                  return;
                }
                save(true);
                toast.success(
                  'Tudo pronto. Agora escolha o que aparece na sua Home.',
                );
              }}
            >
              {step < 2 ? 'Continuar' : 'Concluir'}
            </Button>
          </div>
          {step === 0 && companyMissing && (
            <p className="portal-small w-full text-right text-portal-neutral">
              Informe o nome da empresa para continuar.
            </p>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function OnboardingFlow() {
  const state = useOnboarding();
  // Montado so no cliente: o estado vive no localStorage e o SSR nao o ve.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  if (!state.tourDone) {
    return <Tour onFinish={() => updateOnboarding({ tourDone: true })} />;
  }
  if (!state.setupDone) return <SetupWizard initial={state} />;
  return null;
}
