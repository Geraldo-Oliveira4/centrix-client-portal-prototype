'use client';

import Link from 'next/link';
import { ArrowRight, Hourglass, Sparkles, Undo2, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatBRL, formatShortDate } from '@/lib/portal-formatters';
import type { PortalBucketKey, PortalQuotation } from '@/types/portal';
import { ClientReferenceTag } from '../../_shared/client-reference-tag';
import { ModalIcon } from '../../_shared/modal-icon';
import {
  ChangedFieldsList,
  ResubmittedChip,
  V2StageBadge,
} from '../../_shared/demo/quotation-v2-labels';
import {
  V2_STAGE_DESCRIPTIONS,
  isResubmission,
  lastSubmission,
} from '../../_shared/demo/quotation-review';
import type { QuotationReview } from '../../_shared/demo/quotation-review';
import { cardPresentation } from '../lib/card-presentation';
import { isEmphasized, type Urgency } from '../../_shared/urgency';
import { URGENCY_BORDER_CLASS, UrgencyBadge } from '../../_shared/urgency-badge';

/**
 * Supplier/PO identify the demand first; the next step determines the emphasis.
 *
 * `review` is the Cotação V2 overlay (`_shared/demo/quotation-review.ts`) and is
 * `null` for every quotation that does not have one — which is every quotation
 * when `cotacaoV2` is off. In that case NOTHING below changes: the V2 block
 * replaces the status footer only when there is an overlay to replace it with.
 */
export function QuotationCard({
  quotation: q,
  review = null,
  highlighted = false,
  urgency = null,
}: {
  quotation: PortalQuotation;
  bucket: PortalBucketKey;
  review?: QuotationReview | null;
  /** Recem-enviada: o cartao que o cliente veio ver depois do envio (RQ-6). */
  highlighted?: boolean;
  /**
   * Escala de urgencia (`_shared/urgency.ts`). A borda esquerda segue ELA, nao
   * a coluna: so o que precisa do cliente com prazo curto ganha cor.
   */
  urgency?: Urgency | null;
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
        URGENCY_BORDER_CLASS[urgency?.level ?? 'normal'],
        // O destaque e uma BORDA, nao um fundo: o cartao acabou de mudar de
        // coluna, e mudar tambem a cor do corpo tornaria dificil compara-lo com
        // os vizinhos, que e exatamente o que o cliente veio fazer.
        highlighted && 'ring-2 ring-primary ring-offset-2 ring-offset-card',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3
          className="portal-body font-semibold leading-snug text-foreground"
          title={view.title}
        >
          {view.title}
        </h3>
        {review ? (
          <V2StageBadge stage={review.stage} />
        ) : urgent ? (
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
        {urgency && isEmphasized(urgency.level) && (
          <UrgencyBadge urgency={urgency} className="mb-2" />
        )}
        {review ? (
          <>
            {/* O preco continua aparecendo quando a cotacao ja tem proposta
                vencedora no payload: o overlay muda QUEM o cliente pode ver, nao
                apaga o que ele pode ver. Sem proposta no payload o bloco some
                sozinho, em vez de imprimir "Valor a confirmar" numa etapa em que
                nao ha valor nenhum a confirmar ainda. */}
            {view.deciding && view.showPrice && best && (
              <div className="mb-2">
                <p className="text-xl font-semibold leading-tight text-foreground">
                  {formatBRL(best.total_brl)}
                </p>
                <p className="portal-small mt-1 text-portal-neutral">
                  {best.agent?.name || 'Agente a confirmar'}
                  {best.transit_time != null &&
                    ` · ${best.transit_time} dias de trânsito`}
                </p>
              </div>
            )}
            <V2CardFooter review={review} count={view.count} />
          </>
        ) : view.deciding ? (
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
        {!review && view.needsInfo && (
          <span className="portal-small mt-2 inline-flex items-center gap-1 font-medium text-portal-warning-ink">
            Ver pendência <ArrowRight className="h-3.5 w-3.5" />
          </span>
        )}
      </div>
    </Link>
  );
}

/**
 * O rodapé de uma cotação V2: a frase da etapa, o motivo quando houve
 * devolução, e a ÚNICA ação que a etapa oferece.
 *
 * O CTA é por etapa e não por coluna: "Corrigir e reenviar" (RQ-5) e "Comparar
 * e escolher" (RQ-4) pedem coisas diferentes do cliente, e as três etapas em que
 * a bola está com a Freitas não pedem nada — elas oferecem "Acompanhar", que
 * leva ao detalhe sem prometer uma decisão que ainda não existe.
 */
function V2CardFooter({
  review,
  count,
}: {
  review: QuotationReview;
  count: number;
}) {
  const cta =
    review.stage === 'returned'
      ? 'Corrigir e reenviar'
      : review.stage === 'draft'
        ? 'Continuar preenchendo'
        : review.stage === 'released'
          ? 'Comparar e escolher'
          : 'Acompanhar';
  const released = review.releasedProposalIds?.length ?? 0;
  const emphasis =
    review.stage === 'returned' || review.stage === 'draft'
      ? 'text-portal-warning-ink'
      : review.stage === 'released'
        ? 'text-portal-success'
        : 'text-foreground';

  return (
    <>
      <p className={cn('portal-body font-medium', emphasis)}>
        {V2_STAGE_DESCRIPTIONS[review.stage]}
      </p>
      {/* "Reenviada" fica AQUI, abaixo da frase, e nao ao lado do selo do
          topo: e informacao secundaria sobre a rodada, nao um segundo estado. */}
      {isResubmission(review) && (
        <div className="mt-2 space-y-1">
          <ResubmittedChip />
          <ChangedFieldsList changes={lastSubmission(review)?.changes} max={2} />
        </div>
      )}
      {review.stage === 'returned' && review.returnReason && (
        <p className="portal-small mt-1 flex items-start gap-1.5 text-portal-warning-ink">
          <Undo2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Ajuste pedido pela Freitas: {review.returnReason}
          </span>
        </p>
      )}
      {review.stage === 'released' && released > 0 && (
        <p className="portal-small mt-1 text-portal-success">
          {released}{' '}
          {released === 1
            ? 'proposta liberada pela Freitas'
            : 'propostas liberadas pela Freitas'}
        </p>
      )}
      {review.stage === 'exit_review' && count > 0 && (
        <p className="portal-small mt-1 text-portal-neutral">
          {count} {count === 1 ? 'proposta' : 'propostas'} em revisão pela
          Freitas
        </p>
      )}
      <span className="portal-small mt-2 inline-flex items-center gap-1 font-medium text-brand-indigo">
        {cta} <ArrowRight className="h-3.5 w-3.5" />
      </span>
    </>
  );
}
