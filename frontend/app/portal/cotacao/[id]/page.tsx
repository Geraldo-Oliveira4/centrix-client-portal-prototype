'use client';

import React, { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Ban } from 'lucide-react';
import { LoaderComponent, ErrorComponent } from '@arboria-tech/arboria-ui';

import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui';
import portal_api from '@/lib/portal-api';
import type { SIApi } from '@/hooks/use-shipment-instruction';
import { ShipmentInstructionSection } from '@/components/shipment-instruction-section';
import { useMyQuotation } from '@/hooks/use-portal-quotations';
import {
  canAssembleRfq,
  canCancel,
  canDecide,
  isApproved,
  isAwaitingInfo,
  isCancelled,
  isDeclined,
  isFinalized,
  isPendingAnalystReview,
} from '@/lib/portal-state';
import { formatRoute } from '@/lib/portal-formatters';
import type { PortalProposal } from '@/types/portal';

import { ModalIcon } from '../../_shared/modal-icon';
import { ReliabilityBlock } from '../../inteligencia/components/reliability-block';
import { MarketBlock } from '../../inteligencia/components/market-block';
import { RiskBlock } from '../../inteligencia/components/risk-block';
import { EvidenceBlock } from '../../inteligencia/components/evidence-block';
import { AdditionalCostsCard } from './components/additional-costs-card';
import { AuditPreviewSection } from './components/audit-preview-section';
import { ApproveDialog } from './components/approve-dialog';
import { CancelDialog } from './components/cancel-dialog';
import { DeclineDialog } from './components/decline-dialog';
import { DocumentsSection } from './components/documents-section';
import { HistoryTimeline } from './components/history-timeline';
import { ProposalDetailsCard } from './components/proposal-details-card';
import { ProposalsTable } from './components/proposals-table';
import { RecommendationPanel } from './components/recommendation-panel';
import { RfqDispatchCard } from './components/rfq-dispatch-card';
import { QuotationFooterCard } from './components/quotation-footer-card';
import {
  BestArrivalBanner,
  EmptyProposalsBlock,
  FinalizedApprovedBanner,
  FinalizedCancelledBanner,
  FinalizedDeclinedBanner,
  GuardRailBlockBanner,
  NeedsMoreInfoBanner,
  PendingAnalystReviewBanner,
  SelectionApprovedBanner,
} from './components/quotation-banners';

// Portal client hits the shared SI endpoints through portal_api (portal JWT) and
// the /portal route prefix; the backend authorizes ownership (ARB-2449).
const PORTAL_SI_API: SIApi = { api: portal_api, basePath: '/portal/quotations' };

export default function PortalCotacaoDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { quotation, isLoading, isError } = useMyQuotation(params?.id ?? null);

  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(
    null,
  );
  const [approveOpen, setApproveOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const proposals = quotation?.proposals ?? [];
  const winner = useMemo<PortalProposal | undefined>(
    () => proposals.find((p) => p.is_winner),
    [proposals],
  );
  const finalized = quotation ? isFinalized(quotation.state) : false;

  const selected = useMemo<PortalProposal | undefined>(() => {
    if (!proposals.length) return undefined;
    if (winner) return winner;
    return proposals.find((p) => p.id === selectedProposalId) ?? proposals[0];
  }, [proposals, selectedProposalId, winner]);

  if (isLoading) return <LoaderComponent />;
  if (isError || !quotation) return <ErrorComponent />;

  // Self-service (RFQ dispatch, document upload, history, cancel) is only for
  // quotations the client created via the portal. Analyst-created quotations are
  // view/approve only. Default to the self-service view when the flag is absent
  // (older payloads) to avoid hiding features from portal-origin quotations.
  const isPortalOrigin = quotation.created_via_portal !== false;

  const showActions = canDecide(quotation.state);
  const showCancel = canCancel(quotation.state) && isPortalOrigin;
  const needsInfo = isAwaitingInfo(quotation.state);
  // The client's selection sits in APROVADA_PELO_CLIENTE both while the guard
  // rail holds it (under Freitas review) and after an analyst releases it (choice
  // approved, awaiting close). `guard_rail_active` distinguishes the two so the
  // "em análise" banner clears the moment the analyst approves the selection.
  const pendingReview = isPendingAnalystReview(quotation.state);
  const underReview = pendingReview && !!quotation.guard_rail_active;
  // Once Freitas approves the selection (guard rail released), a portal-origin
  // quotation lets the client generate and send the Shipment Instruction himself
  // (ARB-2449). Analyst-created quotations stay view-only here.
  const canGenerateSI = isPortalOrigin && pendingReview && !underReview;
  // The SI card also stays visible read-only after the quotation closes, so the
  // client keeps seeing the instruction they already sent. Both cases are gated
  // on portal origin — analyst-created quotations never show this card.
  const showShipmentInstruction =
    isPortalOrigin && (canGenerateSI || isApproved(quotation.state));
  const showProposalDetails =
    !isDeclined(quotation.state) && !isCancelled(quotation.state) && !needsInfo;
  const showRfqAssembly =
    canAssembleRfq(quotation.state) && proposals.length === 0 && isPortalOrigin;

  // The three review sub-states (under review / approved-can-generate-SI /
  // approved-processing) drive both the proposals-table hint and the banner slot.
  // Resolve the tri-state once so the two consumers cannot drift.
  const proposalsHeaderHint = !pendingReview
    ? undefined
    : underReview
      ? 'Sua seleção está em análise pela Freitas.'
      : canGenerateSI
        ? 'Proposta aprovada. Gere a instrução de embarque abaixo.'
        : 'Proposta selecionada. Em processamento pela Freitas.';
  const pendingReviewBanner = underReview ? (
    <PendingAnalystReviewBanner proposal={winner} />
  ) : canGenerateSI ? null : (
    <SelectionApprovedBanner proposal={winner} />
  );

  const cotacaoContent = (
    <div className="space-y-6">
      {quotation.guard_rail_block_reason ? (
        <GuardRailBlockBanner reason={quotation.guard_rail_block_reason} />
      ) : null}

      {showRfqAssembly ? (
        <RfqDispatchCard
          quotationId={quotation.id}
          desiredDeadline={quotation.desired_deadline}
          originMissing={!quotation.origin && quotation.incoterm !== 'FOB'}
          onDispatched={() => router.refresh()}
        />
      ) : null}

      {needsInfo ? (
        <NeedsMoreInfoBanner quotation={quotation} />
      ) : isCancelled(quotation.state) ? null : proposals.length > 0 ? (
        <ProposalsTable
          proposals={proposals}
          selectedId={selected?.id ?? null}
          onSelect={setSelectedProposalId}
          winnerId={winner?.id ?? null}
          locked={finalized || pendingReview}
          headerHint={proposalsHeaderHint}
        />
      ) : (
        <EmptyProposalsBlock />
      )}

      {needsInfo ? null : isApproved(quotation.state) && winner ? (
        <FinalizedApprovedBanner proposal={winner} />
      ) : pendingReview ? (
        pendingReviewBanner
      ) : isCancelled(quotation.state) ? (
        <FinalizedCancelledBanner />
      ) : isDeclined(quotation.state) ? (
        <FinalizedDeclinedBanner
          reason={quotation.decline_reason}
          note={quotation.decline_note}
        />
      ) : selected ? (
        <BestArrivalBanner proposal={selected} />
      ) : null}

      {/* MOCK - Auditoria real (Camada de Auditoria de Frete/Fatura) é produto
          separado, sequenciado após GE go-live. Este preview existe apenas para
          visualização conceitual no debate de produto. Só aparece em cotação
          FECHADA, que é quando existe proposta vencedora com valor real para
          servir de base ao comparativo. */}
      {isApproved(quotation.state) ? (
        <>
          <AuditPreviewSection quotationId={quotation.id} />
          {/* Risco (bloco do canvas, relocado) — vive junto da Auditoria porque
              trata dos riscos que aparecem depois do fechamento. Preview: os
              sinais vêm de campos reais, a análise consolidada é ilustrativa. */}
          <RiskBlock />
        </>
      ) : null}

      {showShipmentInstruction ? (
        <ShipmentInstructionSection
          quotation={quotation}
          onSent={() => router.refresh()}
          variant="portal"
          siApi={PORTAL_SI_API}
          canCreate={canGenerateSI}
        />
      ) : null}

      {/* Decisao: coberta pelo painel "Recomendacao por IA" abaixo (nao duplicada). */}
      {!needsInfo && !isCancelled(quotation.state) && proposals.length > 0 ? (
        <RecommendationPanel quotationId={quotation.id} />
      ) : null}

      {/* Inteligencia da cotacao (blocos do canvas, relocados) — decisao
          apoiada por Confiabilidade dos agentes, Mercado (preco) e Evidencia
          de embarques semelhantes, ao lado da comparacao de propostas. Cada
          bloco mantem seu ProvenanceBadge (real vs pre-visualizacao). */}
      {!needsInfo && !isCancelled(quotation.state) && proposals.length > 0 ? (
        <div className="space-y-4">
          {/* Linha 1: Confiabilidade e Mercado lado a lado (blocos curtos).
              Linha 2: Evidencia em largura total (bloco mais alto). Evita o vao
              a direita que o grid unico de 2 colunas criava. */}
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <ReliabilityBlock proposals={proposals} />
            <MarketBlock proposals={proposals} />
          </div>
          <EvidenceBlock quotation={quotation} />
        </div>
      ) : null}

      {showProposalDetails ? (
        <div className="grid gap-6 md:grid-cols-2">
          {selected ? <ProposalDetailsCard proposal={selected} /> : <div />}
          {selected?.additional_costs ? (
            <AdditionalCostsCard items={selected.additional_costs} />
          ) : null}
        </div>
      ) : null}

      <QuotationFooterCard quotation={quotation} />
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
          aria-label="Voltar"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <ModalIcon modal={quotation.modal} className="h-5 w-5 text-portal-neutral" />
          <h1 className="portal-h1 text-foreground">{quotation.reference}</h1>
          {quotation.incoterm ? (
            <span className="portal-small rounded border px-2 py-0.5 font-medium text-portal-neutral">
              {quotation.incoterm}
            </span>
          ) : null}
        </div>
        {showActions || showCancel || needsInfo ? (
          <div className="flex flex-col items-end gap-1 sm:ml-auto">
            <div className="flex items-center gap-2">
              {showActions ? (
                <>
                  <Button variant="outline" onClick={() => setDeclineOpen(true)}>
                    Recusar
                  </Button>
                  <Button
                    onClick={() => setApproveOpen(true)}
                    disabled={!selected}
                  >
                    Aprovar Proposta
                  </Button>
                </>
              ) : null}
              {showCancel ? (
                <Button
                  variant="ghost"
                  className="text-slate-600 hover:text-rose-700"
                  onClick={() => setCancelOpen(true)}
                >
                  <Ban className="mr-1.5 h-4 w-4" />
                  Cancelar cotação
                </Button>
              ) : null}
            </div>
            {!showActions && needsInfo ? (
              <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                Aguardando Informações
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="portal-body text-portal-neutral">
        {formatRoute(quotation)}{' '}
        {quotation.product ? ` · ${quotation.product}` : ''}
      </div>

      {isPortalOrigin ? (
        <Tabs defaultValue="cotacao" className="w-full">
          <TabsList>
            <TabsTrigger value="cotacao">Cotação</TabsTrigger>
            <TabsTrigger value="documentos">Documentos</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="cotacao" className="mt-4">
            {cotacaoContent}
          </TabsContent>

          <TabsContent value="documentos" className="mt-4">
            <DocumentsSection quotationId={quotation.id} />
          </TabsContent>

          <TabsContent value="historico" className="mt-4">
            <HistoryTimeline quotationId={quotation.id} />
          </TabsContent>
        </Tabs>
      ) : (
        cotacaoContent
      )}

      {showActions && selected ? (
        <ApproveDialog
          open={approveOpen}
          onOpenChange={setApproveOpen}
          quotationId={quotation.id}
          proposal={selected}
        />
      ) : null}
      {showActions ? (
        <DeclineDialog
          open={declineOpen}
          onOpenChange={setDeclineOpen}
          quotationId={quotation.id}
        />
      ) : null}
      {showCancel ? (
        <CancelDialog
          open={cancelOpen}
          onOpenChange={setCancelOpen}
          quotationId={quotation.id}
          onCancelled={() => router.refresh()}
        />
      ) : null}
    </div>
  );
}
