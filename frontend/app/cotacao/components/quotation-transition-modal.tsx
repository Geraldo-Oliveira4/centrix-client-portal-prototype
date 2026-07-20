'use client';

import { useState } from 'react';
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui';
import { selectWinner, useProposals } from '@/hooks/use-proposals';
import { transitionQuotation } from '@/hooks/use-quotations';
import { formatCurrencyCode } from '@/lib/portal-formatters';
import { DeclineReasonForm } from './decline-reason-form';
import type { QuotationState } from '@/types/quotation';

interface QuotationTransitionModalProps {
  quotationId: string;
  targetState: QuotationState;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

/**
 * Single confirmation modal for every quotation state transition that needs
 * extra input before it can be submitted, shared by the Kanban card menu
 * (app/cotacao/kanban/page.tsx) and the quotation detail "Mover Estado"
 * dropdown (app/cotacao/[id]/components/quotation-transition-button.tsx).
 * Previously these were two near-identical components (transition-modal.tsx
 * + inline-transition-modal.tsx) that had to be extended in lockstep by hand.
 *
 * Branches by targetState:
 * - FECHADA / APROVADA_PELO_CLIENTE: select the winning proposal.
 *   APROVADA_PELO_CLIENTE goes through selectWinner() specifically (not the
 *   generic transition) so proposal.is_winner is set in the DB — the plain
 *   transition endpoint only sets winning_agent_id on the quotation.
 * - DECLINADA: capture a decline reason (+ note when OUTROS).
 * - COTANDO: reopening a FECHADA quotation — no extra input, just a warning
 *   that the previous winner selection will be cleared and that agent
 *   notified (see shared/domain/quotation_state_machine.py side effects).
 */
export function QuotationTransitionModal({
  quotationId,
  targetState,
  open,
  onOpenChange,
  onSuccess,
}: QuotationTransitionModalProps) {
  const isFechada = targetState === 'FECHADA';
  const isAprovadaPeloCliente = targetState === 'APROVADA_PELO_CLIENTE';
  const isDeclinada = targetState === 'DECLINADA';
  const isReopen = targetState === 'COTANDO';
  const needsProposalSelect = isFechada || isAprovadaPeloCliente;

  // Reopen also fetches proposals (read-only) just to name the outgoing winner.
  const { proposals, isLoading: proposalsLoading } = useProposals(
    needsProposalSelect || isReopen ? quotationId : null,
  );

  const [selectedProposalId, setSelectedProposalId] = useState('');
  const [declineReason, setDeclineReason] = useState('');
  const [declineNote, setDeclineNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const hasProposals = (proposals?.length ?? 0) > 0;
  const isOutros = declineReason === 'OUTROS';
  const outgoingWinner = isReopen ? proposals?.find((p) => p.is_winner) : undefined;

  const canSubmit = needsProposalSelect
    ? selectedProposalId !== ''
    : isDeclinada
      ? declineReason !== '' && (!isOutros || declineNote.trim().length >= 10)
      : true; // isReopen — no extra input required

  const resetForm = () => {
    setSelectedProposalId('');
    setDeclineReason('');
    setDeclineNote('');
  };

  const handleOpenChange = (val: boolean) => {
    if (!val) resetForm();
    onOpenChange(val);
  };

  const handleSubmit = async () => {
    setSubmitting(true);

    if (isAprovadaPeloCliente) {
      // Must go through selectWinner so proposal.is_winner is set in the DB.
      // transitionQuotation only sets winning_agent_id via state machine context
      // but never marks the proposal row as winner, breaking create_si later.
      const result = await selectWinner(quotationId, selectedProposalId);
      setSubmitting(false);
      if (result.success) {
        resetForm();
        onOpenChange(false);
        onSuccess();
      }
      return;
    }

    const payload: Record<string, unknown> = { target_state: targetState };
    if (needsProposalSelect) {
      const chosen = proposals?.find((p) => p.id === selectedProposalId);
      if (!chosen) {
        setSubmitting(false);
        return;
      }
      payload.winning_agent_id = chosen.agent_id;
      payload.quoted_value_usd = chosen.total_value;
    } else if (isDeclinada) {
      payload.decline_reason = declineReason;
      if (isOutros && declineNote.trim()) {
        payload.decline_note = declineNote.trim();
      }
    }
    // isReopen: bare { target_state: 'COTANDO' } — backend derives the rest
    // (clears winning_agent_id/quoted_value_usd, cancels any existing SI,
    // notifies the outgoing agent) from the previous FECHADA state.

    const ok = await transitionQuotation(quotationId, payload as never);
    setSubmitting(false);
    if (ok) {
      resetForm();
      onOpenChange(false);
      onSuccess();
    }
  };

  const title = isFechada
    ? 'Fechar Cotacao'
    : isAprovadaPeloCliente
      ? 'Registrar Aprovacao do Cliente'
      : isReopen
        ? 'Reabrir Cotacao'
        : 'Declinar Cotacao';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="dialog-content-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {needsProposalSelect ? (
            <div className="space-y-2">
              <Label>{isAprovadaPeloCliente ? 'Proposta Aprovada pelo Cliente' : 'Proposta Vencedora'}</Label>
              <Select
                value={selectedProposalId}
                onValueChange={setSelectedProposalId}
                disabled={proposalsLoading || !hasProposals}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      proposalsLoading
                        ? 'Carregando propostas...'
                        : hasProposals
                          ? 'Selecione a proposta vencedora'
                          : 'Nenhuma proposta recebida'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {proposals?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {(p.agent?.name ?? 'Agente')} — {formatCurrencyCode(p.total_value, p.freight_currency)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!proposalsLoading && !hasProposals && (
                <p className="text-sm text-muted-foreground">
                  Nenhuma proposta foi recebida para esta cotacao.
                </p>
              )}
            </div>
          ) : isDeclinada ? (
            <DeclineReasonForm
              reason={declineReason}
              note={declineNote}
              onReasonChange={setDeclineReason}
              onNoteChange={setDeclineNote}
            />
          ) : (
            <div className="space-y-2 text-sm">
              <p>
                Esta cotacao ja foi fechada
                {outgoingWinner?.agent?.name ? ` com ${outgoingWinner.agent.name}` : ''}. Reabrir
                ira remover essa selecao e permitir fechar com outro agente.
              </p>
              <p className="text-muted-foreground">
                O agente anteriormente selecionado sera notificado por e-mail de que o
                fechamento foi cancelado.
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => handleOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            variant={isDeclinada ? 'destructive' : 'default'}
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
          >
            {submitting ? 'Processando...' : isReopen ? 'Reabrir' : 'Confirmar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
