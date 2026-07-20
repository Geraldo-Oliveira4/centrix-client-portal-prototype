'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea } from '@/components/ui';
import { overrideRecommendation } from '@/hooks/use-proposals';
import type { ProposalScore } from '@/types/quotation';

const schemaRequired = z.object({
  proposal_id: z.string().min(1, 'Selecione uma proposta'),
  justification: z.string().min(10, 'A justificativa deve ter pelo menos 10 caracteres'),
});

const schemaOptional = z.object({
  proposal_id: z.string().min(1, 'Selecione uma proposta'),
  justification: z.string().optional(),
});

type FormValues = {
  proposal_id: string;
  justification?: string;
};

const DEFAULT_JUSTIFICATION = 'Analista optou por proposta diferente da recomendada pela IA.';

interface RecommendationOverrideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quotationId: string;
  scores: ProposalScore[];
  initialProposalId?: string;
  justificationRequired?: boolean;
}

export function RecommendationOverrideDialog({
  open,
  onOpenChange,
  quotationId,
  scores,
  initialProposalId,
  justificationRequired = true,
}: RecommendationOverrideDialogProps) {
  const [loading, setLoading] = useState(false);

  const schema = justificationRequired ? schemaRequired : schemaOptional;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const selectedProposalId = watch('proposal_id');

  const onSubmit = async (values: FormValues) => {
    setLoading(true);
    const payload = {
      proposal_id: values.proposal_id,
      justification: values.justification?.trim() || DEFAULT_JUSTIFICATION,
    };
    const ok = await overrideRecommendation(quotationId, payload);
    setLoading(false);
    if (ok) {
      reset();
      onOpenChange(false);
    }
  };

  useEffect(() => {
    if (open && initialProposalId) {
      setValue('proposal_id', initialProposalId);
    }
  }, [open, initialProposalId, setValue]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dialog-content-md">
        <DialogHeader>
          <DialogTitle>Sobrescrever Recomendacao</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="proposal_id">Proposta recomendada</Label>
            <Select
              value={selectedProposalId}
              onValueChange={(v) => setValue('proposal_id', v, { shouldValidate: true })}
            >
              <SelectTrigger id="proposal_id">
                <SelectValue placeholder="Selecione uma proposta..." />
              </SelectTrigger>
              <SelectContent>
                {scores.map((s) => (
                  <SelectItem key={s.proposal_id} value={s.proposal_id}>
                    <span className={!s.is_eligible ? 'text-muted-foreground' : ''}>
                      {s.agent_name}
                      {s.total_score != null ? ` — ${s.total_score.toFixed(0)} pts` : ''}
                      {!s.is_eligible ? ' (inelegivel)' : ''}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.proposal_id && (
              <p className="text-xs text-destructive">{errors.proposal_id.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="justification">
              {justificationRequired ? 'Justificativa (obrigatoria)' : 'Justificativa (opcional)'}
            </Label>
            <Textarea
              id="justification"
              rows={4}
              placeholder="Descreva o motivo da sobrescrita da recomendacao automatica..."
              {...register('justification')}
            />
            {errors.justification && (
              <p className="text-xs text-destructive">{errors.justification.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => { reset(); onOpenChange(false); }}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : 'Confirmar override'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
