'use client';

// Tela 8 — a aba "Em análise", a opção B do RQ-15.
//
// A escolha entre A (selo na carteira) e B (aba própria) é do Orsi, na Open
// Question 10, e a spec propõe A. As duas estão construídas e o seletor vive no
// painel de demonstração — que é exatamente o que uma decisão em aberto pede de
// um protótipo: as duas versões lado a lado, não um palpite escolhido por nós.
//
// O andamento em três passos e as duas ações (Editar dados, Cancelar embarque)
// vêm da Tela 8. Editar e cancelar enquanto está em análise também é Open
// Question 12; aqui o cliente pode fazer as duas, que é a leitura mais generosa
// e a que dá mais o que discutir na validação.

import { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Check, Pencil, Undo2, X } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { NoQuotationChip, PO_REVIEW_SLA_LABEL, PoStageBadge } from './shipment-po-labels';
import {
  PO_FIELD_LABELS,
  cancel,
  type ShipmentPoReview,
} from './shipment-po-review';
import { updateShipmentPoReview, useShipmentPoStore } from './use-shipment-po-review';

const STEPS = ['Enviado', 'Em revisão pela Freitas', 'Ativo'];

function stepIndex(entry: ShipmentPoReview): number {
  if (entry.stage === 'active') return 2;
  return 1;
}

export function ShipmentPoReviewTab() {
  const store = useShipmentPoStore();
  const [cancelling, setCancelling] = useState<string | null>(null);

  const rows = Object.entries(store).filter(
    ([, entry]) =>
      entry.stage === 'awaiting_review' || entry.stage === 'returned',
  );

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/20 p-10 text-center">
        <p className="portal-h3">Nenhum embarque em análise</p>
        <p className="portal-small mt-1 text-portal-neutral">
          Os embarques que você abrir por PO aparecem aqui enquanto a Freitas
          confere os dados.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2.5 rounded-lg border border-portal-warning/40 bg-portal-warning/10 px-4 py-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-portal-warning-ink" />
        <p className="portal-body text-portal-warning-ink">
          Estes embarques ainda não estão ativos. A Freitas confere os dados e
          libera o acompanhamento. Depois disso eles passam para a aba
          Embarques.
        </p>
      </div>

      {rows.map(([id, entry]) => (
        <article key={id} className="portal-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="portal-h3">
                {entry.data.items[0]?.description || 'Embarque sem descrição'}
              </h3>
              <p className="portal-small mt-1 text-portal-neutral">
                {entry.data.poNumbers[0] ?? 'PO a informar'} ·{' '}
                {entry.reference}
                {entry.data.incoterm ? ` · ${entry.data.incoterm}` : ''}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {!entry.linkedQuotationId && <NoQuotationChip />}
              <PoStageBadge stage={entry.stage} />
            </div>
          </div>

          {entry.stage === 'returned' && entry.returnReason && (
            <div className="mt-4 flex gap-2.5 rounded-lg border border-portal-warning/40 bg-portal-warning/10 px-4 py-3">
              <Undo2 className="mt-0.5 h-5 w-5 shrink-0 text-portal-warning-ink" />
              <div className="min-w-0">
                <p className="portal-body font-medium text-portal-warning-ink">
                  {entry.returnReason}
                </p>
                {entry.fieldsToFix.length > 0 && (
                  <p className="portal-small text-portal-warning-ink">
                    Corrija:{' '}
                    {entry.fieldsToFix
                      .map((field) => PO_FIELD_LABELS[field] ?? field)
                      .join(', ')}
                  </p>
                )}
              </div>
            </div>
          )}

          <ol className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
            {STEPS.map((label, index) => {
              const current = stepIndex(entry);
              const done = index < current;
              return (
                <li key={label} className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={cn(
                      'portal-small flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-medium',
                      done
                        ? 'bg-portal-success text-background'
                        : index === current
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-portal-neutral',
                    )}
                  >
                    {done ? <Check className="h-4 w-4" /> : index + 1}
                  </span>
                  <span
                    className={cn(
                      'portal-small',
                      index === current
                        ? 'font-medium text-foreground'
                        : 'text-portal-neutral',
                    )}
                  >
                    {label}
                  </span>
                  {index < STEPS.length - 1 && (
                    <span
                      aria-hidden="true"
                      className="hidden h-px w-8 bg-border sm:block"
                    />
                  )}
                </li>
              );
            })}
          </ol>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
            <p className="portal-small text-portal-neutral">
              Enviado às{' '}
              {new Date(entry.stageEnteredAt).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
              })}{' '}
              · Prazo de revisão: {PO_REVIEW_SLA_LABEL}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/portal/embarques/novo?rascunho=${id}`}>
                  <Pencil className="mr-1.5 h-4 w-4" />
                  Editar dados
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-portal-danger"
                onClick={() => setCancelling(id)}
              >
                <X className="mr-1.5 h-4 w-4" />
                Cancelar embarque
              </Button>
            </div>
          </div>
        </article>
      ))}

      <AlertDialog
        open={cancelling != null}
        onOpenChange={(open) => !open && setCancelling(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar este embarque?</AlertDialogTitle>
            <AlertDialogDescription>
              Ele sai da análise e volta a ser um rascunho seu. A Freitas deixa
              de vê-lo, e você pode retomá-lo depois em “Abrir novo embarque”.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (cancelling) {
                  updateShipmentPoReview(cancelling, (entry) =>
                    cancel(entry, new Date().toISOString()),
                  );
                }
                setCancelling(null);
              }}
            >
              Cancelar embarque
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
