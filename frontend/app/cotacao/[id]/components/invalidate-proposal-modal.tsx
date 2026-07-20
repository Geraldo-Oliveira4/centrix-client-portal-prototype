'use client';

import { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Label,
  Textarea,
} from '@/components/ui';
import { invalidateProposal } from '@/hooks/use-proposals';

const MIN_REASON_LENGTH = 10;

interface InvalidateProposalModalProps {
  quotationId: string;
  proposalId: string;
  agentName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InvalidateProposalModal({
  quotationId,
  proposalId,
  agentName,
  open,
  onOpenChange,
}: InvalidateProposalModalProps) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const trimmedReason = reason.trim();
  const isValid = trimmedReason.length >= MIN_REASON_LENGTH;

  const handleSubmit = async () => {
    if (!isValid) return;
    setSubmitting(true);
    const ok = await invalidateProposal(quotationId, proposalId, trimmedReason);
    setSubmitting(false);
    if (ok) {
      setReason('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" />
            Excluir Proposta
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Excluir a proposta de <span className="font-medium text-foreground">{agentName}</span>.
          Ela deixara de aparecer no portal do cliente, na comparacao e na listagem interna.
          O registro nao e apagado do banco — fica preservado para auditoria — e o agente
          podera enviar uma nova proposta pelo mesmo link a qualquer momento.
        </p>

        <div className="flex flex-col gap-1.5">
          <Label className="text-sm">Motivo da exclusao *</Label>
          <Textarea
            placeholder="Descreva o motivo da exclusao (minimo 10 caracteres)..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleSubmit} disabled={!isValid || submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Excluir Proposta
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
