'use client';

import Link from 'next/link';
import { ArrowRight, Hourglass, Sparkles, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatBRL, formatShortDate } from '@/lib/portal-formatters';
import type { PortalBucketKey, PortalQuotation } from '@/types/portal';
import { ClientReferenceTag } from '../../_shared/client-reference-tag';
import { ModalIcon } from '../../_shared/modal-icon';
import { cardPresentation } from '../lib/card-presentation';

const bucketAccentClass: Record<PortalBucketKey, string> = {
  aguardando_dados: 'border-l-portal-warning',
  aguardando_aprovacao: 'border-l-portal-success',
  buscando_propostas: 'border-l-portal-info',
  finalizadas: 'border-l-portal-neutral/40',
  cancelada: 'border-l-portal-neutral/40',
};

/** Supplier/PO identify the demand first; the next step determines the emphasis. */
export function QuotationCard({
  quotation: q,
  bucket,
}: {
  quotation: PortalQuotation;
  bucket: PortalBucketKey;
}) {
  const view = cardPresentation(q);
  const best = view.best;
  const urgent = q.urgency === 'URGENTE' || q.urgency === 'VIP';
  const origin =
    q.origin ||
    q.porto_embarque ||
    q.aeroporto_embarque ||
    'Origem a confirmar';
  const destination =
    q.porto_destino?.[0] || q.aeroporto_destino?.[0] || 'Destino a confirmar';
  return (
    <Link
      href={`/portal/cotacao/${q.id}`}
      className={cn(
        'block rounded-md border border-l-4 bg-background p-4 transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-info',
        bucketAccentClass[bucket],
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3
          className="portal-body font-semibold leading-snug text-foreground"
          title={view.title}
        >
          {view.title}
        </h3>
        {urgent ? (
          <span className="portal-small inline-flex shrink-0 items-center gap-1 text-portal-danger">
            <Zap className="h-3.5 w-3.5" />
            {q.urgency === 'VIP' ? 'VIP' : 'Urgente'}
          </span>
        ) : (
          <ArrowRight className="h-4 w-4 shrink-0 text-portal-neutral" />
        )}
      </div>
      <div className="portal-small mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-portal-neutral">
        <ClientReferenceTag value={q.client_reference} />
        {view.title !== q.reference && <span>{q.reference}</span>}
      </div>
      {view.supplier && q.product && (
        <p
          className="portal-small mt-2 line-clamp-1 text-portal-neutral"
          title={q.product}
        >
          {q.product}
        </p>
      )}
      {!view.supplier && (
        <p className="portal-small mt-2 text-portal-neutral">
          Fornecedor não disponível
        </p>
      )}
      <p className="portal-small mt-1 flex items-start gap-1.5 text-portal-neutral">
        <span className="mt-0.5 shrink-0">
          <ModalIcon modal={q.modal} />
        </span>
        <span>
          {origin} → {destination}
          {q.incoterm && ` · ${q.incoterm}`}
        </span>
      </p>
      {q.data_limite_necessidade && (
        <p className="portal-small mt-1 text-foreground">
          Necessidade: até {formatShortDate(q.data_limite_necessidade)}
        </p>
      )}

      <div className="mt-3 border-t border-border/60 pt-3">
        {view.deciding ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xl font-semibold leading-tight text-foreground">
                {view.showPrice && best
                  ? formatBRL(best.total_brl)
                  : 'Valor a confirmar'}
              </p>
              {view.recommended && (
                <span className="portal-small inline-flex items-center gap-1 text-portal-info">
                  <Sparkles className="h-3.5 w-3.5" />
                  Recomendada
                </span>
              )}
            </div>
            <p className="portal-small mt-1 text-portal-neutral">
              {best?.agent?.name || 'Agente a confirmar'}
              {best?.transit_time != null &&
                ` · ${best.transit_time} dias de trânsito`}
            </p>
            <div className="portal-small mt-2 flex flex-wrap justify-between gap-x-3 gap-y-1 text-portal-neutral">
              <span>
                {view.count} {view.count === 1 ? 'proposta' : 'propostas'}
              </span>
              <span
                className={
                  view.issue ? 'font-medium text-portal-warning-ink' : undefined
                }
              >
                {view.issue ||
                  (best?.validity
                    ? `Oferta válida até ${formatShortDate(best.validity)}`
                    : 'Validade a confirmar')}
              </span>
            </div>
          </>
        ) : (
          <>
            <p
              className={cn(
                'portal-body flex items-start gap-1.5 font-medium',
                view.needsInfo ? 'text-portal-warning-ink' : 'text-foreground',
              )}
            >
              {!view.needsInfo && (
                <Hourglass className="mt-0.5 h-3.5 w-3.5 shrink-0 text-portal-neutral" />
              )}
              {view.status}
            </p>
            {!view.needsInfo && !view.reviewing && view.count > 0 && (
              <p className="portal-small mt-1 text-portal-neutral">
                Aguardando liberação para escolher
              </p>
            )}
            {!view.needsInfo && !view.reviewing && q.desired_deadline && (
              <p className="portal-small mt-1 text-portal-neutral">
                Prazo solicitado para resposta:{' '}
                {formatShortDate(q.desired_deadline)}
              </p>
            )}
          </>
        )}
        {view.needsInfo && (
          <span className="portal-small mt-2 inline-flex items-center gap-1 font-medium text-portal-warning-ink">
            Ver pendência <ArrowRight className="h-3.5 w-3.5" />
          </span>
        )}
      </div>
    </Link>
  );
}
