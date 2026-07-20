'use client';

import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { STATE_LABELS, TRANSITION_ACTION_LABELS } from '@/types/quotation';
import type { QuotationState } from '@/types/quotation';

interface CardContextMenuProps {
  state: QuotationState;
  onTransition: (targetState: QuotationState) => void;
}

// Deliberately curated SUBSET of `ALLOWED_TRANSITIONS` in the backend's
// shared/domain/quotation_state_machine.py — NOT the full transition graph. Kept as a local,
// hand-maintained list (rather than fetched from GET /quotations/{id}/allowed-transitions,
// which the quotation detail page's dropdown uses) for two different reasons:
//
// - APROVADA_PELO_CLIENTE -> ENVIADA_CLIENTE (guard-rail "send back to client", ARB-2449) is
//   PERMANENTLY excluded, not a to-do. It must always go through GuardRailControl
//   (guard-rail-control.tsx), which requires a >=10 char justification and emails the
//   client — a bare transition here has neither and would silently bypass both.
// - COTANDO is reached only by dispatching the RFQ (see _guard_to_cotando) — not offered
//   here (except as the FECHADA reopen target below) since a manual move from any other
//   state would always be rejected by the backend guard; open the quotation and use the
//   RFQ panel instead.
//
// ENVIADA_CLIENTE -> APROVADA_PELO_CLIENTE and FECHADA -> DECLINADA both use
// QuotationTransitionModal (shared with the detail page) the same way FECHADA and
// COTANDO-reopen do below, so exposing them here was just a matter of adding the target —
// no new modal branch was needed.
//
// If you add a state to ALLOWED_TRANSITIONS that should also be reachable from this menu,
// add the target here too — this list does not update itself. Action labels live in the
// shared TRANSITION_ACTION_LABELS map (types/quotation.ts), not here.
const AVAILABLE_TARGETS_BY_STATE: Record<QuotationState, QuotationState[]> = {
  TRIAGEM_IA: ['AGUARDANDO_DADOS', 'CANCELADO'],
  AGUARDANDO_DADOS: ['TRIAGEM_IA', 'CANCELADO'],
  COTANDO: ['PARA_ANALISE', 'CANCELADO'],
  PARA_ANALISE: ['REVISAO_AGENTE', 'ENVIADA_CLIENTE', 'FECHADA', 'CANCELADO'],
  REVISAO_AGENTE: ['PARA_ANALISE', 'ENVIADA_CLIENTE', 'FECHADA', 'CANCELADO'],
  ENVIADA_CLIENTE: ['APROVADA_PELO_CLIENTE', 'FECHADA', 'DECLINADA', 'CANCELADO'],
  APROVADA_PELO_CLIENTE: ['FECHADA', 'CANCELADO'],
  FECHADA: ['COTANDO', 'DECLINADA'],
  DECLINADA: [],
  CANCELADO: [],
};

export function CardContextMenu({ state, onTransition }: CardContextMenuProps) {
  const targets = AVAILABLE_TARGETS_BY_STATE[state] ?? [];

  if (targets.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={(e) => e.stopPropagation()}
          aria-label="Ações da cotação"
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        {targets.map((target) => {
          // Reopening clears the winning agent/value and cancels any SI server-side
          // (quotation_state_machine.py) — flagged visually so an analyst doesn't
          // click it thinking it's a routine, reversible move.
          const isReopenFromFechada = state === 'FECHADA' && target === 'COTANDO';
          return (
            <DropdownMenuItem
              key={target}
              onClick={() => onTransition(target)}
              className={cn(
                target === 'DECLINADA' && 'text-destructive',
                isReopenFromFechada && 'text-amber-600 dark:text-amber-400 font-medium',
              )}
            >
              {TRANSITION_ACTION_LABELS[state]?.[target] ?? STATE_LABELS[target]}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
