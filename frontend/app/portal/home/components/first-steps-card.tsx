'use client';

// "Primeiros passos" (Prompt 4): três tarefas para a primeira semana, com anel
// de progresso e uma comemoração discreta ao completar. Tudo SIMULADO e só
// neste navegador: marcar "Convidar um colega" não envia e-mail, e abrir a
// cotação ou os alertas só registra que a pessoa foi até lá. Dispensável; o
// "Reiniciar onboarding" do painel traz o cartão de volta.

import { useState } from 'react';
import Link from 'next/link';
import { Check, PartyPopper, UserPlus, X } from 'lucide-react';
import { toast } from 'react-toastify';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

import {
  FIRST_STEPS,
  firstStepsProgress,
  type FirstStepId,
} from '../../_shared/onboarding';
import {
  dismissFirstSteps,
  markFirstStep,
  useFirstSteps,
} from '../../_shared/use-first-steps';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ProgressRing({
  done,
  total,
  celebrate,
}: {
  done: number;
  total: number;
  celebrate: boolean;
}) {
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <span
      className={cn(
        'relative inline-flex h-14 w-14 shrink-0',
        celebrate && 'first-steps-done',
      )}
    >
      <svg
        viewBox="0 0 56 56"
        className="h-14 w-14 -rotate-90"
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
            'fill-none motion-safe:transition-[stroke-dashoffset] motion-safe:duration-700',
            celebrate ? 'stroke-portal-success' : 'stroke-brand-orange',
          )}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - done / total)}
        />
      </svg>
      <span className="portal-small absolute inset-0 flex items-center justify-center font-medium text-foreground">
        {celebrate ? (
          <PartyPopper
            className="h-5 w-5 text-portal-success-ink"
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

  if (state.dismissed) return null;

  const isDone = (id: FirstStepId) => state.done.includes(id);
  const emailIssue = !EMAIL.test(email.trim())
    ? 'Informe um e-mail válido.'
    : null;

  const invite = () => {
    setTouched(true);
    if (emailIssue) return;
    markFirstStep('colega');
    setInviting(false);
    setEmail('');
    toast.info('Convite simulado: nenhum e-mail foi enviado.');
  };

  return (
    <section
      aria-labelledby="primeiros-passos"
      className="portal-card flex flex-col gap-4 p-5 sm:flex-row sm:items-start"
    >
      <div className="flex items-center gap-4 sm:w-64 sm:shrink-0">
        <ProgressRing
          done={progress.done}
          total={progress.total}
          celebrate={progress.complete}
        />
        <div className="min-w-0">
          <h2 id="primeiros-passos" className="portal-h3">
            Primeiros passos
          </h2>
          <p className="portal-small text-portal-neutral" aria-live="polite">
            {progress.complete
              ? 'Tudo pronto. Você já conhece o essencial.'
              : `${progress.done} de ${progress.total} concluídos`}
          </p>
        </div>
      </div>

      <ul className="min-w-0 flex-1 space-y-2">
        {FIRST_STEPS.map((step) => {
          const done = isDone(step.id);
          return (
            <li key={step.id} className="space-y-2">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border',
                    done
                      ? 'border-portal-success bg-portal-success text-white'
                      : 'border-border',
                  )}
                >
                  {done && <Check className="h-4 w-4" />}
                </span>
                {step.href ? (
                  <Link
                    href={step.href}
                    onClick={() => markFirstStep(step.id)}
                    className={cn(
                      'portal-body min-h-11 flex-1 content-center font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      done
                        ? 'text-portal-neutral line-through'
                        : 'text-brand-indigo',
                    )}
                  >
                    {step.label}
                    <span className="sr-only">
                      {done ? ' (concluído)' : ''}
                    </span>
                  </Link>
                ) : (
                  <button
                    type="button"
                    disabled={done}
                    aria-expanded={inviting}
                    onClick={() => setInviting((v) => !v)}
                    className={cn(
                      'portal-body min-h-11 flex-1 text-left font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:no-underline',
                      done
                        ? 'text-portal-neutral line-through'
                        : 'text-brand-indigo',
                    )}
                  >
                    {step.label}
                    <span className="sr-only">
                      {done ? ' (concluído)' : ''}
                    </span>
                  </button>
                )}
              </div>
              {step.id === 'colega' && inviting && !done && (
                <form
                  className="ml-9 flex flex-wrap items-end gap-2"
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
              )}
            </li>
          );
        })}
      </ul>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-11 w-11 self-end sm:self-start"
        aria-label="Dispensar primeiros passos"
        onClick={() => dismissFirstSteps()}
      >
        <X className="h-5 w-5" aria-hidden="true" />
      </Button>
    </section>
  );
}
