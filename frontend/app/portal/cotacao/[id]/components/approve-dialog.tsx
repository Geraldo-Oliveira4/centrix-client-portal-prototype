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
}

export function ApproveDialog({
  open,
  onOpenChange,
  quotationId,
  proposal,
}: ApproveDialogProps) {
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
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
            . Esta ação não pode ser desfeita pelo portal.
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
