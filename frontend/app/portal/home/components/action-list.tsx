'use client';

import Link from 'next/link';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  FileText,
  Ship,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { daysUntil } from '@/lib/portal-formatters';
import { Button } from '@/components/ui';

import type { HomeAction, HomeActionKind } from '../lib/home-actions';

/**
 * "Ações necessárias" — a fila do que depende do cliente.
 *
 * Componente PRESENTACIONAL: quem decide o que entra, em que ordem e com que
 * tom é `lib/home-actions.ts`, que roda a mesma pipeline da tela de detalhe do
 * embarque. Não acrescente regra de negócio aqui.
 *
 * O CTA é sempre ROSA (`Button` padrão = `--primary` = #CE0F69), inclusive nas
 * linhas vermelhas: no portal a cor de marca significa AÇÃO e o semáforo
 * significa ESTADO. Um CTA vermelho misturaria as duas — o tom da linha já
 * aparece no ícone e na barra lateral esquerda.
 */

const KIND_ICON: Record<HomeActionKind, LucideIcon> = {
  proposta: ClipboardList,
  booking: Ship,
  documento: FileText,
  dados: AlertCircle,
};

const TONE_ACCENT: Record<HomeAction['tone'], string> = {
  danger: 'border-l-portal-danger',
  warning: 'border-l-portal-warning',
  info: 'border-l-portal-info',
};

const TONE_ICON: Record<HomeAction['tone'], string> = {
  danger: 'text-portal-danger',
  warning: 'text-portal-warning',
  info: 'text-portal-info',
};

function ActionRow({ action }: { action: HomeAction }) {
  const Icon = KIND_ICON[action.kind];
  // O rótulo do prazo sai do MESMO `daysUntil` que o card do Funil usa, sobre a
  // MESMA data crua — para "Expira hoje" ser a mesma frase nos dois lugares. O
  // módulo ordena por `daysLeft`; quem redige o prazo é o formatador do portal.
  const deadline = action.deadline ? daysUntil(action.deadline) : null;

  return (
    <li
      className={cn(
        'flex flex-col gap-3 rounded-md border border-l-4 bg-background p-4',
        'sm:flex-row sm:items-center sm:justify-between sm:gap-4',
        TONE_ACCENT[action.tone],
      )}
    >
      <div className="flex min-w-0 gap-3">
        <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', TONE_ICON[action.tone])} />
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="portal-small text-portal-neutral">{action.category}</span>
            {deadline ? (
              <span
                className={cn(
                  'portal-small font-medium',
                  action.tone === 'danger'
                    ? 'text-portal-danger'
                    : 'text-portal-neutral',
                )}
              >
                · {deadline}
              </span>
            ) : null}
          </div>
          <p className="portal-body font-medium text-foreground">{action.title}</p>
          <p className="portal-small text-portal-neutral">{action.description}</p>
        </div>
      </div>

      <Button asChild size="sm" className="shrink-0 gap-1.5 self-start sm:self-center">
        <Link href={action.href}>
          {action.ctaLabel}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </li>
  );
}

export function ActionList({
  actions,
  total,
}: {
  actions: HomeAction[];
  total: number;
}) {
  if (actions.length === 0) {
    return (
      <div className="portal-card flex items-start gap-3 p-6">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-portal-success" />
        <div className="space-y-1">
          <p className="portal-body font-medium text-foreground">
            Nada depende de você agora.
          </p>
          <p className="portal-small text-portal-neutral">
            Quando um documento, uma aprovação ou uma escolha de proposta ficar
            pendente, ela aparece aqui.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-3">
        {actions.map((action) => (
          <ActionRow key={action.id} action={action} />
        ))}
      </ul>

      {/* Corte declarado, nunca silencioso: se a fila é maior que a tela, a tela
          diz quanto ficou de fora e para onde ir ver. */}
      {total > actions.length ? (
        <p className="portal-small text-portal-neutral">
          Mostrando {actions.length} de {total} pendências.{' '}
          <Link
            href="/portal/cotacoes"
            className="font-medium text-primary hover:underline"
          >
            Ver todas as cotações
          </Link>{' '}
          ou{' '}
          <Link
            href="/portal/embarques"
            className="font-medium text-primary hover:underline"
          >
            todos os embarques
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}
