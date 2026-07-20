'use client';

import { useEffect, useState } from 'react';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Textarea,
} from '@/components/ui';
import { cancelQuotation } from '@/hooks/use-portal-quotations';

interface CancelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quotationId: string;
  /** Called after a successful cancel so the page can refresh. */
  onCancelled?: () => void;
}

const NOTE_MAX_LENGTH = 1000;

export function CancelDialog({
  open,
  onOpenChange,
  quotationId,
  onCancelled,
}: CancelDialogProps) {
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setNote('');
      setSubmitting(false);
    }
  }, [open]);

  const handleConfirm = async () => {
    setSubmitting(true);
    const trimmed = note.trim();
    const ok = await cancelQuotation(quotationId, trimmed ? { note: trimmed } : undefined);
    setSubmitting(false);
    if (ok) {
      onOpenChange(false);
      onCancelled?.();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancelar cotação</DialogTitle>
          <DialogDescription>
            Esta ação encerra a cotação e não pode ser desfeita. Os agentes que já
            receberam a solicitação serão avisados do cancelamento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="cancel-note">Motivo (opcional)</Label>
          <Textarea
            id="cancel-note"
            value={note}
            maxLength={NOTE_MAX_LENGTH}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Conte para a equipe o que motivou o cancelamento."
            rows={4}
            disabled={submitting}
          />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Voltar
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={submitting}
          >
            {submitting ? 'Cancelando...' : 'Cancelar cotação'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
