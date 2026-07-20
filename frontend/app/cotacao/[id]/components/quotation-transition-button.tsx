'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui';
import { fetchAllowedTransitions, transitionQuotation } from '@/hooks/use-quotations';
import { cn } from '@/lib/utils';
import { STATE_LABELS, STATES_REQUIRING_MODAL, TRANSITION_ACTION_LABELS } from '@/types/quotation';
import { QuotationTransitionModal } from '@/app/cotacao/components/quotation-transition-modal';
import type { AllowedTransitions, QuotationState } from '@/types/quotation';

interface QuotationTransitionButtonProps {
  quotationId: string;
  // Current state of the quotation, used only to look up the contextual action label
  // (e.g. FECHADA -> COTANDO reads "Reabrir p/ Cotando" instead of the generic "Cotando")
  // in the shared TRANSITION_ACTION_LABELS map. See types/quotation.ts for the full map,
  // shared with the Kanban card menu (card-context-menu.tsx).
  currentState: QuotationState;
  onTransitioned: () => void;
  // When a dedicated "Declinar" button is shown alongside this dropdown, drop
  // DECLINADA here so the decline action has a single entry point (no duplicate).
  hideDecline?: boolean;
}

export function QuotationTransitionButton({
  quotationId,
  currentState,
  onTransitioned,
  hideDecline = false,
}: QuotationTransitionButtonProps) {
  const [transitions, setTransitions] = useState<AllowedTransitions | null>(null);
  const [transitionModalTarget, setTransitionModalTarget] = useState<QuotationState | null>(null);
  const [transitioning, setTransitioning] = useState(false);

  const refreshTransitions = () => {
    fetchAllowedTransitions(quotationId).then(setTransitions);
  };

  useEffect(() => {
    refreshTransitions();
  }, [quotationId]);

  const allowed =
    transitions
      ? Object.entries(transitions.transitions)
          .filter(([, v]) => v.allowed)
          .map(([state]) => state as QuotationState)
          .filter((state) => !(hideDecline && state === 'DECLINADA'))
          // APROVADA_PELO_CLIENTE -> ENVIADA_CLIENTE is the guard-rail "send back
          // to client" edge (ARB-2449). It must always go through
          // GuardRailControl on the Kanban, which requires a >=10 char
          // justification and emails the client — this generic dropdown has
          // neither, so a bare transitionQuotation() call here would silently
          // bypass both requirements.
          .filter((state) => !(currentState === 'APROVADA_PELO_CLIENTE' && state === 'ENVIADA_CLIENTE'))
      : [];

  if (allowed.length === 0) return null;

  const handleDirectTransition = async (state: QuotationState) => {
    if (STATES_REQUIRING_MODAL.includes(state)) {
      setTransitionModalTarget(state);
      return;
    }
    setTransitioning(true);
    await transitionQuotation(quotationId, { target_state: state });
    setTransitioning(false);
    refreshTransitions();
    onTransitioned();
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" disabled={transitioning} className="gap-1.5">
            {transitioning && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Mover Estado
            <ChevronDown className="w-3.5 h-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {allowed.map((state) => {
            // Reopening clears the winning agent/value and cancels any SI server-side
            // (quotation_state_machine.py) — flagged visually so an analyst doesn't
            // click it thinking it's a routine, reversible move.
            const isReopenFromFechada = currentState === 'FECHADA' && state === 'COTANDO';
            return (
              <DropdownMenuItem
                key={state}
                onClick={() => handleDirectTransition(state)}
                className={cn(
                  state === 'DECLINADA' && 'text-destructive',
                  isReopenFromFechada && 'text-amber-600 dark:text-amber-400 font-medium',
                )}
              >
                {TRANSITION_ACTION_LABELS[currentState]?.[state] ?? STATE_LABELS[state]}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Confirmation modal for transitions that need extra data */}
      {transitionModalTarget && (
        <QuotationTransitionModal
          open
          onOpenChange={(v) => { if (!v) setTransitionModalTarget(null); }}
          quotationId={quotationId}
          targetState={transitionModalTarget}
          onSuccess={() => {
            refreshTransitions();
            onTransitioned();
          }}
        />
      )}
    </>
  );
}
