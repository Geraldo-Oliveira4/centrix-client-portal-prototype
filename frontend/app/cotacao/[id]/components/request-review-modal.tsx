'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Label,
  Textarea,
} from '@/components/ui';
import { requestProposalReview } from '@/hooks/use-proposals';

const REVIEW_FIELDS = [
  { value: 'total_value', label: 'Valor Total' },
  { value: 'freight_value', label: 'Frete' },
  { value: 'transit_time', label: 'Transit Time' },
  { value: 'route', label: 'Rota' },
  { value: 'insurance', label: 'Seguro' },
  { value: 'incoterm', label: 'Incoterm' },
] as const;

interface RequestReviewModalProps {
  quotationId: string;
  proposalId: string;
  agentName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RequestReviewModal({
  quotationId,
  proposalId,
  agentName,
  open,
  onOpenChange,
}: RequestReviewModalProps) {
  const [reason, setReason] = useState('');
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const toggleField = (field: string) => {
    setSelectedFields((prev) =>
      prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field],
    );
  };

  const handleSubmit = async () => {
    if (!reason.trim()) return;
    setSubmitting(true);
    const ok = await requestProposalReview(quotationId, proposalId, {
      reason: reason.trim(),
      fields_to_review: selectedFields.length > 0 ? selectedFields : undefined,
    });
    setSubmitting(false);
    if (ok) {
      setReason('');
      setSelectedFields([]);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Solicitar Revisao</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Solicitar revisao ao agente <span className="font-medium text-foreground">{agentName}</span> para esta proposta.
        </p>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label className="text-sm">Motivo da revisao *</Label>
            <Textarea
              placeholder="Descreva o motivo da revisao..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-sm">Campos a revisar (opcional)</Label>
            <div className="flex flex-wrap gap-2">
              {REVIEW_FIELDS.map((field) => (
                <button
                  key={field.value}
                  type="button"
                  onClick={() => toggleField(field.value)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    selectedFields.includes(field.value)
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-muted-foreground border-border hover:border-primary/50'
                  }`}
                >
                  {field.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!reason.trim() || submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Solicitar Revisao
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
