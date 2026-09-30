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
import { cn } from '@/lib/utils';

interface CancelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quotationId: string;
  /**
   * Called after a successful cancel, with the justification the client wrote,
   * so the page can refresh and record it (the Cotação V2 overlay keeps it in
   * the quotation's history).
   */
  onCancelled?: (justification: string) => void;
  /**
   * Whether any agent already received the request. In the Cotação V2 entry
   * review nobody did, and saying "os agentes serão avisados" there would
   * describe an effect that does not exist. Defaults to `true`, the behaviour
   * of every flow that existed before the V2.
   */
  agentsNotified?: boolean;
}

const NOTE_MAX_LENGTH = 1000;
/**
 * Short enough not to be a hurdle, long enough that "x" is not a
 * justification. The justification is mandatory (Orsi, 29/09/2026).
 */
export const NOTE_MIN_LENGTH = 10;

export function CancelDialog({
  open,
  onOpenChange,
  quotationId,
  onCancelled,
  agentsNotified = true,
}: CancelDialogProps) {
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) {
      setNote('');
      setSubmitting(false);
      setTouched(false);
    }
  }, [open]);

  const trimmed = note.trim();
  const valid = trimmed.length >= NOTE_MIN_LENGTH;
  const missing = NOTE_MIN_LENGTH - trimmed.length;

  const handleConfirm = async () => {
    if (!valid) return;
    setSubmitting(true);
    const ok = await cancelQuotation(quotationId, { note: trimmed });
    setSubmitting(false);
    if (ok) {
      onOpenChange(false);
      onCancelled?.(trimmed);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancelar cotação</DialogTitle>
          <DialogDescription>
            {agentsNotified
              ? 'Esta ação encerra a cotação e não pode ser desfeita. Os agentes que já receberam a solicitação serão avisados do cancelamento.'
              : 'Esta ação encerra a cotação e não pode ser desfeita. Nenhum agente recebeu o pedido ainda: a cotação sai do seu quadro e vai direto para as canceladas, no Histórico.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="cancel-note">Justificativa (obrigatória)</Label>
          <Textarea
            id="cancel-note"
            value={note}
            maxLength={NOTE_MAX_LENGTH}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder="Ex.: o fornecedor adiou o pedido para o próximo trimestre."
            rows={4}
            disabled={submitting}
            aria-describedby="cancel-note-help cancel-note-count"
            aria-invalid={touched && !valid}
          />
          <div className="flex items-start justify-between gap-4">
            <p
              id="cancel-note-help"
              className={cn(
                'portal-small',
                touched && !valid
                  ? 'text-portal-danger'
                  : 'text-portal-neutral',
              )}
            >
              {valid
                ? 'A justificativa fica registrada no histórico da cotação.'
                : trimmed.length === 0
                  ? 'Escreva por que está cancelando para liberar o botão. A Freitas usa isso para entender o que mudou.'
                  : `Faltam ${missing} ${missing === 1 ? 'caractere' : 'caracteres'} para liberar o cancelamento.`}
            </p>
            <p
              id="cancel-note-count"
              className="portal-small shrink-0 tabular-nums text-portal-neutral"
              aria-live="polite"
            >
              {note.length}/{NOTE_MAX_LENGTH}
            </p>
          </div>
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
            disabled={submitting || !valid}
          >
            {submitting ? 'Cancelando...' : 'Cancelar cotação'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
