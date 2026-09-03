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
 * "Sua ação mais urgente" — UM card, nunca uma lista.
 *
 * A Home tinha a fila inteira (18 pendências no banco de demonstração) e isso
 * derrotava o propósito da tela: uma lista de dezoito linhas não responde "o que
 * depende de mim?", ela adia a resposta. A fila continua existindo e continua
 * completa — ela mora na Visão Geral, organizada por módulo. Aqui fica só o
 * primeiro item dela, e a linha logo abaixo diz quantos ficaram e onde estão.
 *
 * QUAL É O "MAIS URGENTE": o primeiro de `collectHomeActions`, e ele É o de
 * prazo mais próximo. Não é coincidência nem sorte de ordenação — é aritmética
 * da própria fila: só ações de `proposta` carregam prazo (a validade da proposta
 * vencedora; nada em `step-insights` data um gatilho de embarque), e `proposta`
 * é a categoria de menor peso em `KIND_WEIGHT`. Logo toda ação com prazo vem
 * antes de toda ação sem prazo, e entre elas a ordem é por `daysLeft` crescente.
 * Reordenar aqui por prazo daria exatamente a mesma lista e criaria uma segunda
 * definição de urgência para divergir da primeira.
 *
 * FUNDO ROSA CLARO, e é a única superfície do portal assim. Rosa é a cor de AÇÃO
 * (`--primary`), e este é o único bloco da Home que pede uma. O tom do semáforo
 * não pinta o card: ele aparece no ícone e no prazo, como no resto do portal —
 * ESTADO e AÇÃO não dividem a mesma cor.
 */

const KIND_ICON: Record<HomeActionKind, LucideIcon> = {
  proposta: ClipboardList,
  booking: Ship,
  documento: FileText,
  dados: AlertCircle,
};

const TONE_ICON: Record<HomeAction['tone'], string> = {
  danger: 'text-portal-danger',
  warning: 'text-portal-warning',
  info: 'text-portal-info',
};

export function UrgentActionCard({ action }: { action: HomeAction | undefined }) {
  if (!action) {
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

  const Icon = KIND_ICON[action.kind];
  // O rótulo do prazo sai do MESMO `daysUntil` que o card do Funil usa, sobre a
  // MESMA data crua — para "Expira hoje" ser a mesma frase nos dois lugares.
  const deadline = action.deadline ? daysUntil(action.deadline) : null;

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-primary/20 bg-primary/5 p-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 gap-3">
        <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', TONE_ICON[action.tone])} />
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="portal-small text-portal-neutral">
              {action.category}
            </span>
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
          <p className="portal-h3 text-foreground">{action.title}</p>
          <p className="portal-small text-portal-neutral">{action.description}</p>
        </div>
      </div>

      <Button asChild className="shrink-0 gap-1.5 self-start sm:self-center">
        <Link href={action.href}>
          {action.ctaLabel}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}
