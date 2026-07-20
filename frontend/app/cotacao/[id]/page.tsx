'use client';

import { useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Ban,
  CalendarClock,
  Check,
  Copy,
  FileText,
  Loader2,
  MailCheck,
  Pencil,
  RefreshCw,
  Save,
  Send,
  Wrench,
  X,
} from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui';
import { PageTitle } from '@arboria-tech/arboria-ui';
import {
  duplicateQuotation,
  transitionQuotation,
  updateQuotation,
  useQuotation,
  useQuotationLogs,
} from '@/hooks/use-quotations';
import { useProposals } from '@/hooks/use-proposals';
import { useRFQ } from '@/hooks/use-rfq';
import { StateBadge } from '@/app/inbox/components/state-badge';
import { CompletenessBar } from '@/app/cotacao/nova-cotacao/components/completeness-bar';
import { ClientSelector } from '@/app/cotacao/nova-cotacao/components/client-selector';
import { ExporterSelector } from '@/app/cotacao/nova-cotacao/components/exporter-selector';
import { ExtractionResultsGrid } from '@/app/cotacao/nova-cotacao/components/extraction-results-grid';
import { DnaSummaryCard } from '@/app/cotacao/nova-cotacao/components/dna-summary-card';
import { RFQModal } from './components/rfq-modal';
import { ProposalsSection } from './components/proposals-section';
import { RecommendationPanel } from './components/recommendation-panel';
import { HistorySection } from './components/history-section';
import { AuditSection } from './components/audit-section';
import { PortalDecisionBanner } from './components/portal-decision-banner';
import { QuotationTransitionButton } from './components/quotation-transition-button';
import { QuotationTransitionModal } from '@/app/cotacao/components/quotation-transition-modal';
import { UrgencySelect } from './components/urgency-select';
import { PostergarPrazoDialog } from './components/postergar-prazo-dialog';
import { RecotacaoDialog } from './components/recotacao-dialog';
import { DuplicateModal } from './components/duplicate-modal';
import { RFQStatusBanner } from './components/rfq-status-banner';
import { RFQPreflightPanel } from './components/rfq-preflight-panel';
import { NotifyRfqUpdateDialog } from './components/notify-rfq-update-dialog';
import { ShipmentInstructionSection } from '@/components/shipment-instruction-section';
import { AttachmentsSection } from './components/attachments-section';
import { AddNoteModal } from './components/add-note-modal';
import dynamic from 'next/dynamic';

const ClientProposalSection = dynamic(
  () => import('./components/client-proposal-section').then((m) => ({ default: m.ClientProposalSection })),
  { ssr: false },
);
import type { CompletenessField, Quotation, QuotationFieldValues, QuotationModal } from '@/types/quotation';
import type { QuotationClient } from '@/types/client';
import type { Exporter } from '@/types/exporter';
import { COMPLETENESS_FIELDS } from '@/types/quotation';
import { buildQuotationUpdatePayload, quotationToFieldValues } from '@/utils/quotation-fields';
import { useAutosave } from '@/hooks/use-autosave';
import { useServerSync } from '@/hooks/use-server-sync';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function QuotationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { quotation, isLoading, mutate: mutateQuotation } = useQuotation(id ?? null);
  const { rfq, hardBlocks, softWarnings, mutate: mutateRFQ } = useRFQ(quotation ? id : null);
  const { proposals, isLoading: isLoadingProposals } = useProposals(quotation ? id : null);
  const { logs } = useQuotationLogs(quotation ? id : null);

  const [rfqModalOpen, setRfqModalOpen] = useState(false);
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [postgarPrazoOpen, setPostgarPrazoOpen] = useState(false);
  const [fieldValues, setFieldValues] = useState<QuotationFieldValues | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isCorrectingData, setIsCorrectingData] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [recotacaoOpen, setRecotacaoOpen] = useState(false);
  const [notifyRfqUpdateOpen, setNotifyRfqUpdateOpen] = useState(false);
  const [declineModalOpen, setDeclineModalOpen] = useState(false);

  const canEditData =
    quotation?.state === 'TRIAGEM_IA' ||
    quotation?.state === 'AGUARDANDO_DADOS' ||
    isCorrectingData;

  // Tracks whether fieldValues has edits the server doesn't know about yet
  // (either mid-typing before the autosave debounce fires, or an in-flight
  // save). Any other action on this page (client/exporter change, urgency,
  // postponing the deadline, RFQ dispatch, etc.) calls mutateQuotation() and
  // must NOT clobber those edits when the refetched quotation lands.
  const hasUnsavedFieldChangesRef = useRef(false);

  const { autoSaveStatus, markAsSaved } = useAutosave({
    id: quotation?.id ?? null,
    values: fieldValues,
    buildPayload: buildQuotationUpdatePayload,
    save: updateQuotation,
    enabled: canEditData,
    onSaved: () => {
      hasUnsavedFieldChangesRef.current = false;
    },
  });

  // Initialize editable field values from quotation — but only while there
  // are no pending local edits, otherwise a refetch triggered by an unrelated
  // action (e.g. changing the client) would overwrite what the analyst is
  // currently typing in the grid.
  useServerSync(
    quotation,
    () => {
      resyncFieldValuesFromQuotation();
    },
    { skip: hasUnsavedFieldChangesRef.current, once: false },
  );

  const handleFieldChange = (field: keyof QuotationFieldValues, value: string | string[]) => {
    hasUnsavedFieldChangesRef.current = true;
    setFieldValues((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const isBusy = isSaving || autoSaveStatus === 'saving';

  const resyncFieldValuesFromQuotation = () => {
    if (!quotation) return;
    const values = quotationToFieldValues(quotation);
    setFieldValues(values);
    markAsSaved(values);
  };

  const saveFieldValues = async (): Promise<boolean> => {
    if (!quotation || !fieldValues) return false;
    setIsSaving(true);
    const payload = buildQuotationUpdatePayload(fieldValues);
    const updated = await updateQuotation(quotation.id, payload);
    setIsSaving(false);
    if (updated) {
      hasUnsavedFieldChangesRef.current = false;
      markAsSaved(fieldValues);
      mutateQuotation();
    }
    return !!updated;
  };

  const handleSave = async () => {
    await saveFieldValues();
  };

  const handleSaveCorrection = async () => {
    const saved = await saveFieldValues();
    if (saved) {
      await mutateRFQ();
      setIsCorrectingData(false);
      if (rfq?.dispatched_at) {
        setNotifyRfqUpdateOpen(true);
      }
    }
  };

  const handleClientChange = async (client: QuotationClient | null) => {
    if (!quotation) return;
    const updated = await updateQuotation(quotation.id, { client_id: client?.id ?? null });
    if (updated) mutateQuotation();
  };

  const handleExporterChange = async (exporter: Exporter | null) => {
    if (!quotation) return;
    const updated = await updateQuotation(quotation.id, { exporter_id: exporter?.id ?? null });
    if (updated) mutateQuotation();
  };

  // TRIAGEM_IA/AGUARDANDO_DADOS ("Para Cotar") are included so the RFQ can be
  // built and dispatched before the manual move to COTANDO — dispatch is what
  // advances the quotation to COTANDO (rfq_dispatch_service), not the other
  // way around. See _guard_to_cotando in quotation_state_machine.py.
  const canInitiateRFQ =
    quotation?.state === 'TRIAGEM_IA' ||
    quotation?.state === 'AGUARDANDO_DADOS' ||
    quotation?.state === 'COTANDO' ||
    quotation?.state === 'PARA_ANALISE';

  const [markingSent, setMarkingSent] = useState(false);

  const handleMarkAsSent = async () => {
    if (!quotation) return;
    setMarkingSent(true);
    await transitionQuotation(quotation.id, { target_state: 'ENVIADA_CLIENTE' });
    setMarkingSent(false);
    mutateQuotation();
  };

  // Compute missing completeness fields from quotation
  const missingFields: CompletenessField[] = COMPLETENESS_FIELDS.filter((f) => {
    // client_id is not required when the sender is a known freight agent contact
    if (f === 'client_id' && quotation?.client_match_status === 'agent_matched') return false;
    // Origin not required when agent defines collection or when incoterm is FOB
    if (f === 'origin' && (quotation?.agente_define_local_coleta || quotation?.incoterm === 'FOB')) return false;
    // Stackability not required for FCL, Aereo, or LCL
    if (f === 'stackability') {
      const isFcl = quotation?.tipo_embarque === 'FCL';
      const isLcl = quotation?.tipo_embarque === 'LCL';
      const isAereo = quotation?.modal === 'AEREO';
      if (isFcl || isLcl || isAereo) return false;
    }
    return quotation?.[f as keyof typeof quotation] == null;
  }) as CompletenessField[];

  const completenessScore = quotation?.completeness_score ?? 0;

  const handleDuplicate = async (modal?: QuotationModal) => {
    if (!quotation) return;
    setDuplicating(true);
    const clone = await duplicateQuotation(quotation.id, modal);
    setDuplicating(false);
    setDuplicateModalOpen(false);
    if (clone) router.push(`/cotacao/${clone.id}`);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 mt-0.5 shrink-0"
            onClick={() => router.back()}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <PageTitle
                title={isLoading ? 'Carregando...' : (quotation?.reference ?? 'Cotacao')}
              />
              {quotation && (
                <StateBadge state={quotation.state} />
              )}
              {quotation?.priority_score != null && (
                <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-muted text-muted-foreground border-border">
                  P: {Math.round(quotation.priority_score)}
                </span>
              )}
              {quotation && (
                <UrgencySelect
                  value={quotation.urgency ?? null}
                  onChange={async (v) => {
                    await updateQuotation(quotation.id, { urgency: v });
                    mutateQuotation();
                  }}
                />
              )}
            </div>

            {quotation && (
              <p className="text-xs text-muted-foreground">
                Criado em{' '}
                {new Date(quotation.created_at).toLocaleDateString('pt-BR')}
                {quotation.client && (
                  <> · Cliente: <span className="font-medium text-foreground">{quotation.client.name}</span></>
                )}
                {quotation.analyst_name && (
                  <> · Analista: <span className="font-medium text-foreground">{quotation.analyst_name}</span></>
                )}
              </p>
            )}
          </div>
        </div>

        {quotation && (
          <div className="flex items-center gap-2 shrink-0 sm:mt-0.5">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setDuplicateModalOpen(true)}
              disabled={duplicating}
            >
              <Copy className="w-3.5 h-3.5" />
              {duplicating ? 'Duplicando...' : 'Duplicar'}
            </Button>
            {(['COTANDO', 'PARA_ANALISE', 'ENVIADA_CLIENTE'] as const).includes(
              quotation.state as 'COTANDO' | 'PARA_ANALISE' | 'ENVIADA_CLIENTE',
            ) && !isCorrectingData && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setIsCorrectingData(true)}
              >
                <Pencil className="w-3.5 h-3.5" />
                Editar
              </Button>
            )}
            {(quotation.state === 'DECLINADA' || quotation.state === 'CANCELADO') && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setRecotacaoOpen(true)}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Re-cotar
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setPostgarPrazoOpen(true)}
            >
              <CalendarClock className="w-3.5 h-3.5" />
              Postergar Prazo
            </Button>
            {quotation.state === 'ENVIADA_CLIENTE' && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 border-red-300 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950/40"
                onClick={() => setDeclineModalOpen(true)}
              >
                <Ban className="w-3.5 h-3.5" />
                Declinar
              </Button>
            )}
            <QuotationTransitionButton
              quotationId={quotation.id}
              currentState={quotation.state}
              onTransitioned={() => mutateQuotation()}
              hideDecline={quotation.state === 'ENVIADA_CLIENTE'}
            />
            {quotation.state === 'PARA_ANALISE' && (
              <Button
                onClick={handleMarkAsSent}
                disabled={markingSent}
                className="gap-2"
              >
                {markingSent ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <MailCheck className="w-4 h-4" />
                )}
                Proposta Enviada ao Cliente
              </Button>
            )}
            {canInitiateRFQ && (
              <Button
                onClick={() => setRfqModalOpen(true)}
                variant={quotation.state === 'PARA_ANALISE' ? 'outline' : 'default'}
                className="gap-2"
                disabled={!rfq && hardBlocks.length > 0}
                title={!rfq && hardBlocks.length > 0 ? 'Corrija os bloqueios antes de criar a RFQ' : undefined}
              >
                {rfq ? (
                  <><FileText className="w-4 h-4" /> Ver RFQ</>
                ) : (
                  <><Send className="w-4 h-4" /> Iniciar Cotacao</>
                )}
              </Button>
            )}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 gap-2 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Carregando cotacao...
        </div>
      ) : !quotation ? (
        <div className="text-center py-20 text-muted-foreground text-sm">
          Cotacao nao encontrada.
        </div>
      ) : (
        <>
          <PortalDecisionBanner quotation={quotation} logs={logs} />

          {/* ── Shipment Instruction — visible when approved or closed ── */}
          {(quotation.state === 'APROVADA_PELO_CLIENTE' || quotation.state === 'FECHADA') && (
            <ShipmentInstructionSection
              quotation={quotation}
              onSent={() => mutateQuotation()}
            />
          )}

          {/* ── RFQ status / pre-flight panel ── */}
          {canInitiateRFQ && rfq?.dispatched_at && (
            <RFQStatusBanner dispatched onView={() => setRfqModalOpen(true)} hasBlocks={false} blockCount={0} />
          )}
          {canInitiateRFQ && !rfq?.dispatched_at && (
            <RFQPreflightPanel
              hardBlocks={hardBlocks}
              softWarnings={softWarnings}
              rfqExists={!!rfq}
              isCorrectingData={isCorrectingData}
              onStartCorrection={() => setIsCorrectingData(true)}
              onOpenRFQ={() => setRfqModalOpen(true)}
            />
          )}
          {!canInitiateRFQ && rfq && (
            <RFQStatusBanner
              hasBlocks={hardBlocks.length > 0}
              blockCount={hardBlocks.length}
              dispatched={!!rfq.dispatched_at}
              onView={() => setRfqModalOpen(true)}
            />
          )}

          {/* ── Main content tabs ── */}
          <Tabs defaultValue="dados" className="w-full">
            <TabsList className="w-full sm:w-auto grid grid-cols-5 sm:inline-flex">
              <TabsTrigger value="dados">Dados</TabsTrigger>
              <TabsTrigger value="propostas">
                Propostas
              </TabsTrigger>
              <TabsTrigger value="documentos">Documentos</TabsTrigger>
              <TabsTrigger value="historico">Histórico</TabsTrigger>
              <TabsTrigger value="auditoria">Auditoria</TabsTrigger>
            </TabsList>

            {/* ── Tab: Dados ── */}
            <TabsContent value="dados" className="mt-4 flex flex-col gap-6">
              <CompletenessBar
                score={Math.round(completenessScore)}
                missingFields={missingFields}
                hideReadyMessage={!canEditData}
              />
              {/* Extracted data edit form */}
              <div className="rounded-lg border">
                <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Dados Extraídos pela IA
                    </p>
                    {quotation.extracted_at && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Extraído em {new Date(quotation.extracted_at).toLocaleString('pt-BR')}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {isCorrectingData ? (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setIsCorrectingData(false);
                            resyncFieldValuesFromQuotation();
                          }}
                          disabled={isSaving}
                          className="gap-1.5 shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                          Cancelar
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleSaveCorrection}
                          disabled={isBusy || !fieldValues}
                          className="gap-1.5 shrink-0"
                        >
                          {isBusy ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : autoSaveStatus === 'saved' ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : (
                            <Save className="w-3.5 h-3.5" />
                          )}
                          {autoSaveStatus === 'saved' && !isSaving ? 'Salvo' : 'Salvar correções'}
                        </Button>
                      </div>
                    ) : canEditData ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleSave}
                        disabled={isBusy || !fieldValues}
                        className="gap-1.5 shrink-0"
                      >
                        {isBusy ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : autoSaveStatus === 'saved' ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <Save className="w-3.5 h-3.5" />
                        )}
                        {autoSaveStatus === 'saved' && !isSaving ? 'Salvo' : 'Salvar'}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setIsCorrectingData(true)}
                        className="gap-1.5 shrink-0"
                      >
                        <Wrench className="w-3.5 h-3.5" />
                        Corrigir dados
                      </Button>
                    )}
                  </div>
                </div>
                <div className="p-4">
                  {canEditData && (
                    <div className="mb-4 flex flex-col gap-4">
                      <div>
                        <Label className="text-sm font-medium mb-1.5 block">Cliente</Label>
                        <ClientSelector
                          value={quotation.client_id ?? null}
                          onChange={handleClientChange}
                        />
                      </div>
                      <div>
                        <Label className="text-sm font-medium mb-1.5 block">
                          Exportador Cadastrado
                        </Label>
                        <ExporterSelector
                          value={quotation.exporter_id ?? null}
                          onChange={handleExporterChange}
                        />
                      </div>
                    </div>
                  )}
                  {fieldValues ? (
                    <ExtractionResultsGrid
                      values={fieldValues}
                      onChange={handleFieldChange}
                      readOnly={!canEditData}
                      confidenceScores={quotation.confidence_scores}
                      quotation={quotation}
                      onEquipmentsUpdate={canEditData ? async (equipments) => {
                        await updateQuotation(quotation.id, { equipments });
                      } : undefined}
                      onVolumesUpdate={canEditData ? async (volumes) => {
                        await updateQuotation(quotation.id, { volumes });
                      } : undefined}
                    />
                  ) : (
                    <div className="py-6 text-center text-sm text-muted-foreground">
                      Carregando campos...
                    </div>
                  )}
                </div>
              </div>

              {/* DNA do Cliente */}
              {quotation.client && (
                <div className="rounded-lg border">
                  <div className="px-4 py-3 border-b bg-muted/30">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      DNA do Cliente
                    </p>
                  </div>
                  <div className="p-4">
                    <DnaSummaryCard
                      client={quotation.client as QuotationClient}
                      dna={quotation.client_dna ?? null}
                    />
                  </div>
                </div>
              )}
            </TabsContent>

            {/* ── Tab: Propostas ── */}
            <TabsContent value="propostas" className="mt-4 flex flex-col gap-4">
              <ClientProposalSection
                quotationId={quotation.id}
                quotation={quotation}
                proposals={proposals ?? []}
                isLoadingProposals={isLoadingProposals}
                client={quotation.client}
                onMarkAsSent={handleMarkAsSent}
                canMarkAsSent={quotation.state === 'PARA_ANALISE'}
              />
              <ProposalsSection quotationId={quotation.id} quotation={quotation} />
              <div className="mt-4">
                <RecommendationPanel quotationId={quotation.id} />
              </div>
            </TabsContent>

            {/* ── Tab: Documentos ── */}
            <TabsContent value="documentos" className="mt-4">
              <AttachmentsSection
                quotationId={quotation.id}
                hasOriginalEmail={!!quotation.original_email_s3_key}
              />
            </TabsContent>

            {/* ── Tab: Histórico ── */}
            <TabsContent value="historico" className="mt-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Timeline
                </p>
                <Button size="sm" variant="outline" onClick={() => setNoteModalOpen(true)}>
                  <FileText className="h-4 w-4 mr-1" />
                  Adicionar Nota
                </Button>
              </div>
              <HistorySection
                quotationId={quotation.id}
                volumes={quotation.volumes}
                modal={quotation.modal}
                tipoEmbarque={quotation.tipo_embarque}
              />
            </TabsContent>

            {/* ── Tab: Auditoria ── */}
            <TabsContent value="auditoria" className="mt-4">
              <AuditSection quotationId={quotation.id} />
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* RFQ modal */}
      {quotation && (
        <RFQModal
          quotation={quotation}
          open={rfqModalOpen}
          onOpenChange={setRfqModalOpen}
        />
      )}

      {/* Quotation-level note modal */}
      {quotation && (
        <AddNoteModal
          quotationId={quotation.id}
          open={noteModalOpen}
          onOpenChange={setNoteModalOpen}
        />
      )}

      {/* Postergar prazo modal */}
      {quotation && (
        <PostergarPrazoDialog
          currentDeadline={quotation.desired_deadline}
          open={postgarPrazoOpen}
          onOpenChange={setPostgarPrazoOpen}
          onSave={async (newDeadline: string) => {
            await updateQuotation(quotation.id, { desired_deadline: newDeadline });
            mutateQuotation();
            if (rfq?.dispatched_at) {
              setNotifyRfqUpdateOpen(true);
            }
          }}
        />
      )}

      {/* Re-cotacao modal */}
      {quotation && (
        <RecotacaoDialog
          quotationId={quotation.id}
          open={recotacaoOpen}
          onOpenChange={setRecotacaoOpen}
          onCreated={(clone) => router.push(`/cotacao/${clone.id}`)}
        />
      )}

      {/* Notify agents of RFQ update modal */}
      {quotation && (
        <NotifyRfqUpdateDialog
          quotationId={quotation.id}
          open={notifyRfqUpdateOpen}
          onOpenChange={setNotifyRfqUpdateOpen}
        />
      )}

      {/* Duplicate modal */}
      {quotation && (
        <DuplicateModal
          quotation={quotation}
          open={duplicateModalOpen}
          onOpenChange={setDuplicateModalOpen}
          onDuplicate={handleDuplicate}
        />
      )}

      {/* Decline (motivo) modal — reuses the shared transition modal with DECLINADA */}
      {quotation && (
        <QuotationTransitionModal
          open={declineModalOpen}
          onOpenChange={setDeclineModalOpen}
          quotationId={quotation.id}
          targetState="DECLINADA"
          onSuccess={() => mutateQuotation()}
        />
      )}
    </div>
  );
}


