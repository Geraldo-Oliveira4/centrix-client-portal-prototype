'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@/components/ui';
import { declineQuotation } from '@/hooks/use-portal-quotations';
import {
  PORTAL_DECLINE_REASONS,
  PORTAL_DECLINE_REASON_LABELS,
} from '@/types/portal';

const declineSchema = z
  .object({
    decline_reason: z.enum(PORTAL_DECLINE_REASONS, {
      required_error: 'Selecione um motivo',
    }),
    note: z.string().max(1000, 'Máximo 1000 caracteres'),
  })
  .superRefine((values, ctx) => {
    if (values.decline_reason !== 'OUTROS') return;

    const note = values.note.trim();
    if (!note) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['note'],
        message: 'Explique o motivo da recusa',
      });
      return;
    }

    if (note.length < 10) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['note'],
        message: 'Explique com pelo menos 10 caracteres',
      });
    }
  });

type DeclineFormValues = z.infer<typeof declineSchema>;

interface DeclineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quotationId: string;
}

export function DeclineDialog({
  open,
  onOpenChange,
  quotationId,
}: DeclineDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<DeclineFormValues>({
    resolver: zodResolver(declineSchema),
    defaultValues: { note: '' },
  });
  const selectedReason = form.watch('decline_reason');
  const requiresNote = selectedReason === 'OUTROS';

  useEffect(() => {
    if (!open) {
      form.reset({ note: '' });
      setSubmitting(false);
    }
  }, [open, form]);

  useEffect(() => {
    if (!requiresNote) {
      form.setValue('note', '');
      form.clearErrors('note');
    }
  }, [requiresNote, form]);

  const onSubmit = async (values: DeclineFormValues) => {
    setSubmitting(true);
    const trimmedNote = values.note.trim();
    const ok = await declineQuotation(quotationId, {
      decline_reason: values.decline_reason,
      ...(values.decline_reason === 'OUTROS' ? { note: trimmedNote } : {}),
    });
    setSubmitting(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Recusar cotação</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="decline_reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Motivo</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value ?? undefined}
                    disabled={submitting}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o motivo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PORTAL_DECLINE_REASONS.map((value) => (
                        <SelectItem key={value} value={value}>
                          {PORTAL_DECLINE_REASON_LABELS[value]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {requiresNote
                      ? 'Explicação (obrigatória)'
                      : 'Explicação (somente para Outro)'}
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={
                        requiresNote
                          ? 'Conte para a equipe o que motivou a recusa.'
                          : 'Selecione Outro para informar um motivo específico.'
                      }
                      rows={4}
                      disabled={!requiresNote || submitting}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button type="submit" variant="destructive" disabled={submitting}>
                {submitting ? 'Recusando...' : 'Recusar Cotação'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
