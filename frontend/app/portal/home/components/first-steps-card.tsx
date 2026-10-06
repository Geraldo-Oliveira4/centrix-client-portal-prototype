'use client';

// "Primeiros passos" (Prompt 4, revisto no Prompt 5 e em 07/10/2026): cinco
// tarefas para a primeira semana, no TOPO da Home, com o botão do próximo
// passo, anel de progresso animado e uma comemoração discreta.
//
// Cada passo com link fecha pela AÇÃO na tela de destino, nunca pelo clique:
// a cotação ao ser enviada, os alertas ao salvar as preferências, a
// Inteligência ao abrir e a visão quando uma é salva ou editada. "Convidar um
// colega" fecha no próprio cartão e é simulado (nenhum e-mail sai).
//
// Faltando um passo (4 de 5) o cartão vira uma barra fina: o que falta é um
// item só. Dispensável; o "Reiniciar onboarding" do painel o traz de volta.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, PartyPopper, UserPlus, X } from 'lucide-react';
import { toast } from 'react-toastify';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

import {
  FIRST_STEPS,
  firstStepsCompact,
  firstStepsProgress,
  nextFirstStep,
  type FirstStepId,
} from '../../_shared/onboarding';
import {
  acknowledgeFirstStep,
  dismissFirstSteps,
  markFirstStep,
  useFirstSteps,
} from '../../_shared/use-first-steps';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const NEXT_CTA: Record<FirstStepId, string> = {
  cotacao: 'Abrir cotação',
  alertas: 'Configurar alertas',
  inteligencia: 'Abrir Inteligência',
  visao: 'Salvar uma visão',
  colega: 'Convidar colega',
};

// Quanto a comemoração fica na tela antes de o passo deixar de ser "novo".
const CELEBRATE_MS = 2600;

function ProgressRing({
  done,
  total,
  celebrate,
  complete,
  size,
}: {
  done: number;
  total: number;
  celebrate: boolean;
  complete: boolean;
  size: 'lg' | 'sm';
}) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const box = size === 'lg' ? 'h-16 w-16' : 'h-9 w-9';
  return (
    <span
      className={cn(
        'relative inline-flex shrink-0',
        box,
        celebrate && 'first-steps-done',
      )}
    >
      <svg
        viewBox="0 0 56 56"
        className={cn(box, '-rotate-90')}
        aria-hidden="true"
      >
        <circle
          cx="28"
          cy="28"
          r={r}
          className="fill-none stroke-muted"
          strokeWidth="6"
        />
        <circle
          cx="28"
          cy="28"
          r={r}
          className={cn(
            'fill-none motion-safe:transition-[stroke-dashoffset] motion-safe:duration-1000 motion-safe:ease-out',
            complete ? 'stroke-portal-success' : 'stroke-brand-orange',
          )}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - done / total)}
        />
      </svg>
      {celebrate && (
        // Faíscas: decorativas, e só existem com movimento permitido (CSS).
        <span
          aria-hidden="true"
          className="first-steps-burst pointer-events-none absolute inset-0"
        >
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <span key={i} style={{ ['--i' as string]: i }} />
          ))}
        </span>
      )}
      <span
        className={cn(
          'absolute inset-0 flex items-center justify-center font-medium text-foreground',
          size === 'lg' ? 'portal-body' : 'text-[11px]',
        )}
      >
        {complete ? (
          <PartyPopper
            className={cn(
              'text-portal-success-ink',
              size === 'lg' ? 'h-6 w-6' : 'h-4 w-4',
            )}
            aria-hidden="true"
          />
        ) : (
          `${done}/${total}`
        )}
      </span>
    </span>
  );
}

export function FirstStepsCard() {
  const state = useFirstSteps();
  const [inviting, setInviting] = useState(false);
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const progress = firstStepsProgress(state);
  const next = nextFirstStep(state);
  const compact = firstStepsCompact(state);

  // O anel parte do valor ANTERIOR e anda até o atual quando há passo novo:
  // é isso que faz o progresso "acontecer" na frente da pessoa.
  const justDone = state.justDone;
  const [shownDone, setShownDone] = useState(
    justDone ? Math.max(0, progress.done - 1) : progress.done,
  );
  useEffect(() => {
    if (!justDone) {
      setShownDone(progress.done);
      return;
    }
    const grow = window.setTimeout(() => setShownDone(progress.done), 250);
    const clear = window.setTimeout(() => acknowledgeFirstStep(), CELEBRATE_MS);
    return () => {
      window.clearTimeout(grow);
      window.clearTimeout(clear);
    };
  }, [justDone, progress.done]);

  if (state.dismissed) return null;

  const isDone = (id: FirstStepId) => state.done.includes(id);
  const emailIssue = !EMAIL.test(email.trim())
    ? 'Informe um e-mail válido.'
    : null;
  const celebrating = justDone != null;
  const justDoneLabel = FIRST_STEPS.find((s) => s.id === justDone)?.label;

  const invite = () => {
    setTouched(true);
    if (emailIssue) return;
    markFirstStep('colega');
    setInviting(false);
    setEmail('');
    toast.info('Convite simulado: nenhum e-mail foi enviado.');
  };

  const nextButton = (small: boolean) =>
    next ? (
      next.href ? (
        <Button asChild size={small ? 'sm' : 'default'} className="gap-1.5">
          {/* Nenhum passo com link fecha no clique: cotação fecha ao ENVIAR,
              alertas ao SALVAR, Inteligência ao ABRIR e visão ao SALVAR uma
              (FIRST_STEPS_DONE_BY_ACTION). */}
          <Link href={next.href}>
            {NEXT_CTA[next.id]}
            <ArrowRight
              className={small ? 'h-4 w-4' : 'h-5 w-5'}
              aria-hidden="true"
            />
          </Link>
        </Button>
      ) : (
        <Button
          type="button"
          size={small ? 'sm' : 'default'}
          className="gap-1.5"
          aria-expanded={inviting}
          onClick={() => setInviting((v) => !v)}
        >
          {NEXT_CTA[next.id]}
          <ArrowRight
            className={small ? 'h-4 w-4' : 'h-5 w-5'}
            aria-hidden="true"
          />
        </Button>
      )
    ) : null;

  const inviteForm = inviting && !isDone('colega') && (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        invite();
      }}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <Label htmlFor="convite-colega" className="portal-small">
          E-mail do colega
        </Label>
        <Input
          id="convite-colega"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="colega@suaempresa.com.br"
          aria-invalid={touched && !!emailIssue}
          aria-describedby="convite-colega-ajuda"
        />
        <p
          id="convite-colega-ajuda"
          className={cn(
            'portal-small',
            touched && emailIssue
              ? 'text-portal-danger-ink'
              : 'text-portal-neutral',
          )}
        >
          {touched && emailIssue
            ? emailIssue
            : 'Demonstração: o convite é simulado e nenhum e-mail é enviado.'}
        </p>
      </div>
      <Button type="submit" className="gap-1.5">
        <UserPlus className="h-5 w-5" aria-hidden="true" /> Convidar
      </Button>
    </form>
  );

  const dismiss = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-11 w-11 shrink-0"
      aria-label="Dispensar primeiros passos"
      onClick={() => dismissFirstSteps()}
    >
      <X className="h-5 w-5" aria-hidden="true" />
    </Button>
  );

  const status = (
    <p
      className={cn(
        'portal-small',
        celebrating
          ? 'font-medium text-portal-success-ink'
          : 'text-portal-neutral',
      )}
      aria-live="polite"
    >
      {celebrating && justDoneLabel
        ? `Concluído: ${justDoneLabel}`
        : progress.complete
          ? 'Tudo pronto. Você já conhece o essencial.'
          : `${progress.done} de ${progress.total} concluídos`}
    </p>
  );

  if (compact) {
    return (
      <section
        aria-labelledby="primeiros-passos"
        className="portal-card space-y-2 px-4 py-2"
      >
        <div className="flex flex-wrap items-center gap-3">
          <ProgressRing
            done={shownDone}
            total={progress.total}
            celebrate={celebrating}
            complete={progress.complete}
            size="sm"
          />
          <div className="flex min-w-[11rem] flex-1 flex-wrap items-baseline gap-x-2">
            <h2
              id="primeiros-passos"
              className="portal-body font-medium text-foreground"
            >
              Primeiros passos
            </h2>
            {celebrating || progress.complete || !next ? (
              status
            ) : (
              <p className="portal-small text-portal-neutral">
                {progress.done} de {progress.total} · falta:{' '}
                {next.label.toLowerCase()}
              </p>
            )}
          </div>
          <div className="ml-auto flex items-center gap-1">
            {!progress.complete && nextButton(true)}
            {dismiss}
          </div>
        </div>
        {inviteForm && <div className="pb-2">{inviteForm}</div>}
      </section>
    );
  }

  return (
    <section
      aria-labelledby="primeiros-passos"
      className="portal-card space-y-4 border-l-4 border-l-brand-orange p-5"
    >
      <div className="flex flex-wrap items-center gap-4">
        <ProgressRing
          done={shownDone}
          total={progress.total}
          celebrate={celebrating}
          complete={progress.complete}
          size="lg"
        />
        <div className="min-w-[10rem] flex-1">
          <h2 id="primeiros-passos" className="portal-h3">
            Primeiros passos
          </h2>
          {status}
        </div>
        <div className="ml-auto flex items-center gap-1">
          {nextButton(false)}
          {dismiss}
        </div>
      </div>

      <ol className="grid gap-2 sm:grid-cols-3">
        {FIRST_STEPS.map((step, index) => {
          const done = isDone(step.id);
          const isNext = next?.id === step.id;
          return (
            <li
              key={step.id}
              className={cn(
                'flex min-h-11 items-center gap-2.5 rounded-lg border px-3 py-2',
                done
                  ? 'border-portal-success/30 bg-portal-success/10'
                  : isNext
                    ? 'border-brand-orange/50 bg-card'
                    : 'border-border bg-muted/20',
                justDone === step.id && 'first-steps-done',
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'portal-small flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-medium',
                  done
                    ? 'border-portal-success bg-portal-success text-white'
                    : 'border-border text-portal-neutral',
                )}
              >
                {done ? <Check className="h-4 w-4" /> : index + 1}
              </span>
              <span
                className={cn(
                  'portal-body min-w-0',
                  done ? 'text-portal-neutral line-through' : 'text-foreground',
                  isNext && 'font-medium',
                )}
              >
                {step.label}
                <span className="sr-only">
                  {done ? ' (concluído)' : isNext ? ' (próximo)' : ''}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
      {inviteForm}
    </section>
  );
}
