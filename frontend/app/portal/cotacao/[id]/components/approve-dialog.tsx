'use client';

import { useState } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui';
import { approveProposal } from '@/hooks/use-portal-quotations';
import { formatBRL } from '@/lib/portal-formatters';
import type { PortalProposal } from '@/types/portal';

interface ApproveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quotationId: string;
  proposal: PortalProposal;
  /**
   * Aprovação SIMULADA, quando a proposta é ilustrativa.
   *
   * Opcional e ausente no caminho real: sem ela o diálogo chama
   * `approveProposal` na API exatamente como sempre chamou. Ela existe porque o
   * id de uma proposta ilustrativa não existe no backend e o POST daria 404 —
   * ver `_shared/demo/quotation-approval.ts`.
   */
  onSimulatedApprove?: () => void;
}

export function ApproveDialog({
  open,
  onOpenChange,
  quotationId,
  proposal,
  onSimulatedApprove,
}: ApproveDialogProps) {
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (onSimulatedApprove) {
      onSimulatedApprove();
      onOpenChange(false);
      return;
    }
    setSubmitting(true);
    const ok = await approveProposal(quotationId, proposal.id);
    setSubmitting(false);
    if (ok) onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Aprovar proposta</AlertDialogTitle>
          <AlertDialogDescription>
            Você está aprovando a proposta de{' '}
            <span className="font-medium text-foreground">
              {proposal.agent?.name ?? '—'}
            </span>{' '}
            no valor de{' '}
            <span className="font-medium text-foreground">
              {formatBRL(proposal.total_brl)}
            </span>{' '}
            com transit time de{' '}
            <span className="font-medium text-foreground">
              {proposal.transit_time} dias
            </span>
            . A cotação passa a “Aprovada pelo cliente” e a Freitas recebe a
            instrução de fechamento para preparar o embarque. Esta ação não
            pode ser desfeita pelo portal.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={submitting}>
            {submitting ? 'Aprovando...' : 'Aprovar Proposta'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
