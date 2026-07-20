'use client';

import { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { formatCurrencyCode } from '@/lib/portal-formatters';
import { blockGuardRail, releaseGuardRail } from '@/hooks/use-quotations';
import type { GuardRailReason, KanbanCard } from '@/types/quotation';

const MIN_REASON_LENGTH = 10;

function reasonLabel(reason: GuardRailReason): string {
  if (reason.type === 'high_value') {
    const value = reason.value != null ? formatCurrencyCode(reason.value, 'USD') : 'valor elevado';
    const threshold = reason.threshold != null ? formatCurrencyCode(reason.threshold, 'USD') : null;
    return threshold
      ? `Proposta de ${value} acima do limite de ${threshold}`
      : `Proposta de ${value} acima do limite`;
  }
  return 'Periodo de validacao do fluxo autonomo do portal';
}

/**
 * Guard rail badge + action dialog rendered on a kanban card (ARB-2449).
 *
 * The card itself navigates on click, so every interactive element here calls
 * stopPropagation to keep the analyst on the board while resolving the guard
 * rail. Actions revalidate the kanban via the mutations in use-quotations.ts.
 */
export function GuardRailControl({ card }: { card: KanbanCard }) {
  const [open, setOpen] = useState(false);
  const [showBlockForm, setShowBlockForm] = useState(false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reasons = card.guard_rail_reasons ?? [];

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  const closeAndReset = () => {
    setOpen(false);
    setShowBlockForm(false);
    setReason('');
  };

  const handleRelease = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setSubmitting(true);
    const ok = await releaseGuardRail(card.id);
    setSubmitting(false);
    if (ok) closeAndReset();
  };

  const handleBlock = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (reason.trim().length < MIN_REASON_LENGTH) return;
    setSubmitting(true);
    const ok = await blockGuardRail(card.id, reason.trim());
    setSubmitting(false);
    if (ok) closeAndReset();
  };

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="mt-1.5 w-full"
      >
        <Badge
          variant="outline"
          className="w-full justify-center gap-1 text-xs py-0.5 px-1.5 bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-800"
        >
          <ShieldAlert className="h-3 w-3" />
          Guard Rail — revisar
        </Badge>
      </button>

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : closeAndReset())}>
        <DialogContent onClick={stop} className="dialog-content-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-600" />
              Guard Rail ativo — {card.reference}
            </DialogTitle>
            <DialogDescription>
              O cliente selecionou uma proposta e aguarda a revisao da Freitas antes
              de seguir. Aprove para dar continuidade ou bloqueie para devolver a
              escolha ao cliente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">Motivo</p>
              <ul className="space-y-1">
                {reasons.length > 0 ? (
                  reasons.map((r) => (
                    <li key={r.type} className="text-sm text-foreground">
                      • {reasonLabel(r)}
                    </li>
                  ))
                ) : (
                  <li className="text-sm text-foreground">
                    • Bloqueado manualmente pela Freitas
                  </li>
                )}
              </ul>
            </div>

            {card.guard_rail_decision === 'BLOCKED' && card.guard_rail_block_reason && (
              <div className="rounded-md bg-destructive/5 border border-destructive/20 p-2">
                <p className="text-xs font-semibold text-destructive mb-0.5">
                  Justificativa do bloqueio
                </p>
                <p className="text-sm text-foreground whitespace-pre-wrap">
                  {card.guard_rail_block_reason}
                </p>
              </div>
            )}

            {showBlockForm && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                  Justificativa (minimo {MIN_REASON_LENGTH} caracteres) — o cliente vera
                  este motivo ao voltar para escolher outra proposta
                </label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  onClick={stop}
                  onKeyDown={(e) => e.stopPropagation()}
                  rows={3}
                  placeholder="Descreva o motivo do bloqueio para o registro interno."
                />
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            {!showBlockForm ? (
              <>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowBlockForm(true);
                  }}
                  disabled={submitting}
                >
                  Bloquear e devolver ao cliente
                </Button>
                <Button type="button" onClick={handleRelease} disabled={submitting}>
                  Aprovar seleção
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowBlockForm(false);
                    setReason('');
                  }}
                  disabled={submitting}
                >
                  Voltar
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleBlock}
                  disabled={submitting || reason.trim().length < MIN_REASON_LENGTH}
                >
                  Confirmar bloqueio
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
