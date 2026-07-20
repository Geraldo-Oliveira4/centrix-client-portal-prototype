'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, Send, Play, Save, Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { useAutosave } from '@/hooks/use-autosave';
import {
  Button,
  Label,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui';
import { PageTitle } from '@arboria-tech/arboria-ui';
import { useClients } from '@/hooks/use-clients';
import {
  useQuotation,
  createQuotation,
  triggerQuotationExtraction,
  updateQuotation,
} from '@/hooks/use-quotations';
import { useQuotationUploadFlow } from '@/hooks/use-quotation-upload-flow';
import { COMPLETENESS_FIELDS } from '@/types/quotation';
import type {
  CreateEquipmentItem,
  CreateVolumeItem,
  Quotation,
  QuotationFieldValues,
  CompletenessField,
} from '@/types/quotation';
import { boolStr, buildQuotationUpdatePayload, dnaInsuranceDefault, resolveDnaDestinationYard, quotationToFieldValues } from '@/utils/quotation-fields';
import type { ClientDna, QuotationClient } from '@/types/client';
import { UploadZone, type FileUploadStatus } from './components/upload-zone';
import { ClientSelector } from './components/client-selector';
import { DnaSummaryCard } from './components/dna-summary-card';
import { ManualForm } from './components/manual-form';
import { ExtractionResultsGrid } from './components/extraction-results-grid';
import { CompletenessBar } from './components/completeness-bar';
import { ProcessingState } from './components/processing-state';

type UploadStep = 'idle' | 'uploading' | 'processing' | 'results';

const PROCESSING_TIMEOUT_MS = 120_000; // 2 minutes before showing "proceed manually" hint

function computeLocalScore(values: QuotationFieldValues): {
  score: number;
  missingFields: CompletenessField[];
} {
  const filled: CompletenessField[] = [];
  const missing: CompletenessField[] = [];

  for (const field of COMPLETENESS_FIELDS) {
    // Origin not required when agent defines collection or when incoterm is FOB
    if (field === 'origin' && (values.agente_define_local_coleta === 'true' || values.incoterm === 'FOB')) continue;
    // Stackability not required for FCL, Aereo, or LCL
    if (field === 'stackability') {
      const isFcl = values.tipo_embarque === 'FCL';
      const isLcl = values.tipo_embarque === 'LCL';
      const isAereo = values.modal === 'AEREO';
      if (isFcl || isLcl || isAereo) continue;
    }

    let isFilled = false;
    if (field === 'stackability' || field === 'insurance_required') {
      isFilled = values[field] !== '';
    } else if (field === 'modal' || field === 'service_type') {
      isFilled = values[field] !== '';
    } else {
      const v = values[field as keyof QuotationFieldValues];
      isFilled = typeof v === 'string' && v.trim() !== '';
    }

    if (isFilled) filled.push(field);
    else missing.push(field);
  }

  return {
    score: Math.round((filled.length / (filled.length + missing.length)) * 100),
    missingFields: missing,
  };
}

const EMPTY_FIELD_VALUES: QuotationFieldValues = {
  client_id: '',
  service_type: '',
  modal: '',
  tipo_embarque: '',
  tipo_cotacao: '',
  data_cotacao: '',
  origin: '',
  porto_embarque: '',
  porto_destino: [],
  aeroporto_embarque: '',
  aeroporto_destino: [],
  incluir_entrega_destino_final: '',
  incoterm: '',
  product: '',
  desired_deadline: '',
  data_prontidao: '',
  data_limite_necessidade: '',
  declared_value: '',
  declared_value_currency: '',
  stackability: '',
  carga_tombavel: '',
  insurance_required: '',
  carga_perigosa: '',
  un_number: '',
  imo_class: '',
  temperatura_min: '',
  temperatura_max: '',
  client_reference: '',
  agente_define_local_coleta: '',
  agente_define_porto_embarque: '',
  agente_define_porto_destino: '',
  agente_define_aeroporto_embarque: '',
  agente_define_aeroporto_destino: '',
  ptax_negociada: '',
  price_or_performance: '',
  destination_yard: '',
  endereco_entrega_final: '',
  necessidade_descarga: '',
  ncm: '',
  exportador: '',
  pais_procedencia: '',
  peso_taxado: '',
  observations: '',
};

// Pick the client's DNA for the current operation, defaulting to import.
function pickDna(dnas: ClientDna[], serviceType: string): ClientDna | undefined {
  return dnas.find((d) => d.service_type === (serviceType || 'IMPORTACAO'));
}

// Suggest values from the DNA without ever clobbering fields the analyst already
// filled — each spread only applies when the target field is still empty.
function mergeDnaPrefill(
  prev: QuotationFieldValues,
  dna: ClientDna,
): QuotationFieldValues {
  return {
    ...prev,
    ...(dna.modality && !prev.modal ? { modal: dna.modality } : {}),
    ...(dna.tipo_embarque && !prev.tipo_embarque ? { tipo_embarque: dna.tipo_embarque } : {}),
    ...(() => {
      if (prev.destination_yard) return {};
      // Modal may be empty if being set for the first time in this same batch.
      const modal = prev.modal || dna.modality || null;
      const tipoEmbarque = prev.tipo_embarque || dna.tipo_embarque || null;
      const yard = resolveDnaDestinationYard(dna, modal, tipoEmbarque);
      return yard ? { destination_yard: yard } : {};
    })(),
    ...(dna.price_or_performance && !prev.price_or_performance ? { price_or_performance: dna.price_or_performance } : {}),
    ...(dna.cargo_profile && !prev.product ? { product: dna.cargo_profile } : {}),
    ...(!prev.insurance_required
      ? (() => {
          const d = dnaInsuranceDefault(dna.insurance_responsibility?.value);
          return d ? { insurance_required: d as 'true' | 'false' } : {};
        })()
      : {}),
  };
}

export default function NovaQuotacaoPage() {
  const router = useRouter();
  const { getClientWithDna } = useClients();

  // Client selection
  const [selectedClient, setSelectedClient] = useState<QuotationClient | null>(
    null,
  );
  const [clientDnas, setClientDnas] = useState<ClientDna[]>([]);

  // Quotation state
  const [quotationId, setQuotationId] = useState<string | null>(null);
  const [createdQuotation, setCreatedQuotation] = useState<Quotation | null>(
    null,
  );

  // Upload flow state
  const [uploadStep, setUploadStep] = useState<UploadStep>('idle');
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [fileStatuses, setFileStatuses] = useState<Record<string, FileUploadStatus>>({});
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingTimedOut, setProcessingTimedOut] = useState(false);

  // Editable field values (local state for the results grid)
  const [fieldValues, setFieldValues] =
    useState<QuotationFieldValues>(EMPTY_FIELD_VALUES);

  // Manual tab attachment files (documentation-only — no OCR)
  const [manualAttachments, setManualAttachments] = useState<File[]>([]);

  // Saving state
  const [isSaving, setIsSaving] = useState(false);

  const { autoSaveStatus, markAsSaved } = useAutosave({
    id: quotationId,
    values: fieldValues,
    buildPayload: buildQuotationUpdatePayload,
    save: updateQuotation,
    enabled: createdQuotation !== null,
  });

  // Poll only while processing
  const isPolling = uploadStep === 'processing';
  const { quotation: polledQuotation } = useQuotation(
    isPolling ? quotationId : null,
    isPolling,
  );

  // Stop polling once extraction finishes. `state` no longer moves off
  // TRIAGEM_IA as a side effect of extraction (COTANDO is now reached only
  // via RFQ dispatch), so completion must be read from extraction_status.
  useEffect(() => {
    if (!polledQuotation) return;
    if (
      polledQuotation.extraction_status === 'COMPLETED' ||
      polledQuotation.extraction_status === 'FAILED'
    ) {
      const values = quotationToFieldValues(polledQuotation);
      setFieldValues(values);
      markAsSaved(values);
      setCreatedQuotation(polledQuotation);
      setUploadStep('results');
    }
  }, [polledQuotation, markAsSaved]);

  // Processing timeout
  useEffect(() => {
    if (uploadStep !== 'processing') {
      setProcessingTimedOut(false);
      return;
    }
    const timer = setTimeout(
      () => setProcessingTimedOut(true),
      PROCESSING_TIMEOUT_MS,
    );
    return () => clearTimeout(timer);
  }, [uploadStep]);

  const handleClientChange = useCallback(
    async (client: QuotationClient | null) => {
      setSelectedClient(client);
      setClientDnas([]);

      // Sync client_id to fieldValues for completeness calculation
      setFieldValues((prev) => ({
        ...prev,
        client_id: client?.id ?? '',
      }));

      // If quotation already exists, update it on the backend
      if (createdQuotation && client) {
        const updated = await updateQuotation(createdQuotation.id, {
          client_id: client.id,
        });
        if (updated) {
          setCreatedQuotation(updated);
        }
      }

      if (!client) return;
      const clientWithDna = await getClientWithDna(client.id);
      const dnas = clientWithDna?.dnas ?? [];
      setClientDnas(dnas);

      if (!createdQuotation) {
        // Prefill from the DNA matching the currently-selected operation.
        setFieldValues((prev) => {
          const dna = pickDna(dnas, prev.service_type);
          return dna ? mergeDnaPrefill(prev, dna) : prev;
        });
      }
    },
    [getClientWithDna, createdQuotation],
  );

  const { uploadAndCreate } = useQuotationUploadFlow({
    createFn: createQuotation,
    triggerExtractionFn: triggerQuotationExtraction,
    onFileStatusChange: (filename, status) =>
      setFileStatuses((prev) => ({ ...prev, [filename]: status })),
    onProgress: setUploadProgress,
  });

  const handleUploadAndCreate = async () => {
    if (uploadFiles.length === 0) return;

    setUploadStep('uploading');
    setUploadProgress(0);
    setFileStatuses(Object.fromEntries(uploadFiles.map((f) => [f.name, 'uploading'])));

    const quotation = await uploadAndCreate(uploadFiles, {
      source: 'upload',
      client_id: selectedClient?.id ?? undefined,
      files: uploadFiles.map((f) => f.name),
    });

    if (!quotation) {
      setUploadStep('idle');
      return;
    }

    setQuotationId(quotation.id);
    setCreatedQuotation(quotation);
    toast.success('Arquivos enviados. Aguardando extracao pela IA...');
    setUploadStep('processing');
  };

  const handleManualCreated = (quotation: Quotation) => {
    setQuotationId(quotation.id);
    setCreatedQuotation(quotation);
    const values = quotationToFieldValues(quotation);
    setFieldValues(values);
    markAsSaved(values);
    toast.success(`Cotação ${quotation.reference} criada com sucesso.`);
  };

  const handleFieldChange = (
    field: keyof QuotationFieldValues,
    value: string | string[],
  ) => {
    setFieldValues((prev) => {
      const next = { ...prev, [field]: value };
      // Changing the operation re-suggests DNA values for that operation,
      // still without overwriting anything already filled.
      if (field === 'service_type' && !createdQuotation) {
        const dna = pickDna(clientDnas, value as string);
        if (dna) return mergeDnaPrefill(next, dna);
      }
      return next;
    });
  };

  // DNA shown in the summary follows the currently-selected operation.
  const activeDna = useMemo(
    () => pickDna(clientDnas, fieldValues.service_type) ?? null,
    [clientDnas, fieldValues.service_type],
  );

  const handleProceedManuallyFromProcessing = () => {
    if (createdQuotation) {
      const values = quotationToFieldValues(createdQuotation);
      setFieldValues(values);
      markAsSaved(values);
    }
    setUploadStep('results');
  };

  const { score, missingFields } = useMemo(
    () => computeLocalScore(fieldValues),
    [fieldValues],
  );

  const isExtracting = uploadStep === 'uploading' || uploadStep === 'processing';
  const showCompletenessBar = createdQuotation !== null && !isExtracting;
  const canStartQuotation = createdQuotation !== null && !isExtracting;

  const handleStartQuotation = () => {
    if (!createdQuotation) return;
    router.push(`/cotacao/${createdQuotation.id}`);
  };

  const handleRequestData = () => {
    if (missingFields.length === 0) return;
    toast.info(
      `Campos faltantes: ${missingFields.map((f) => f).join(', ')}. Funcionalidade de solicitação de dados em breve.`,
    );
  };

  const handleSave = async () => {
    if (!createdQuotation) return;
    setIsSaving(true);
    const payload = buildQuotationUpdatePayload(fieldValues);
    const updated = await updateQuotation(createdQuotation.id, payload);
    setIsSaving(false);
    if (updated) {
      // Preserve equipments/volumes — the field-only PUT response omits them
      setCreatedQuotation({
        ...updated,
        equipments: createdQuotation.equipments,
        volumes: createdQuotation.volumes,
      });
      markAsSaved(fieldValues);
    }
  };

  const handleEquipmentsUpdate = async (equipments: CreateEquipmentItem[]) => {
    if (!createdQuotation) return;
    const updated = await updateQuotation(createdQuotation.id, { equipments });
    if (updated) {
      setCreatedQuotation({ ...updated, volumes: createdQuotation.volumes });
    }
  };

  const handleVolumesUpdate = async (volumes: CreateVolumeItem[]) => {
    if (!createdQuotation) return;
    const updated = await updateQuotation(createdQuotation.id, { volumes });
    if (updated) {
      setCreatedQuotation({ ...updated, equipments: createdQuotation.equipments });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => router.back()}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <PageTitle title="Nova Cotação" />
      </div>

      {/* Client selector */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1">
          <Label className="text-sm font-medium">Cliente</Label>
          <span className="text-xs text-muted-foreground">(opcional — identificado automaticamente pelo email)</span>
        </div>
        <ClientSelector
          value={selectedClient?.id ?? null}
          onChange={handleClientChange}
        />
        {selectedClient && (
          <DnaSummaryCard client={selectedClient} dna={activeDna} />
        )}
      </div>

      <hr className="border-border" />

      {/* Creation tabs */}
      <Tabs defaultValue="upload">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="upload" className="flex-1 sm:flex-none" disabled={isExtracting}>
            Upload de Documentos
          </TabsTrigger>
          <TabsTrigger value="manual" className="flex-1 sm:flex-none" disabled={isExtracting}>
            Preenchimento Manual
          </TabsTrigger>
        </TabsList>

        {/* Upload tab */}
        <TabsContent value="upload" className="mt-4 flex flex-col gap-4">
          {uploadStep === 'idle' && (
            <>
              <UploadZone
                files={uploadFiles}
                onFilesChange={setUploadFiles}
                msgUploadProgress={uploadProgress}
                isUploading={false}
              />
              {uploadFiles.length > 0 && (
                <div className="flex justify-end">
                  <Button
                    onClick={handleUploadAndCreate}
                    className="w-full sm:w-auto"
                  >
                    Enviar e processar
                  </Button>
                </div>
              )}
            </>
          )}

          {uploadStep === 'uploading' && (
            <UploadZone
              files={uploadFiles}
              onFilesChange={setUploadFiles}
              msgUploadProgress={uploadProgress}
              isUploading={true}
              fileStatuses={fileStatuses}
            />
          )}

          {uploadStep === 'processing' && (
            <ProcessingState
              timedOut={processingTimedOut}
              onProceedManually={handleProceedManuallyFromProcessing}
            />
          )}

          {uploadStep === 'results' && createdQuotation && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-muted-foreground">
                  Ref:{' '}
                  <span className="font-medium text-foreground">
                    {createdQuotation.reference}
                  </span>
                </span>
              </div>
              <ExtractionResultsGrid
                values={fieldValues}
                onChange={handleFieldChange}
                quotation={createdQuotation}
                onEquipmentsUpdate={handleEquipmentsUpdate}
                onVolumesUpdate={handleVolumesUpdate}
              />
            </div>
          )}
        </TabsContent>

        {/* Manual tab */}
        <TabsContent value="manual" className="mt-4">
          {!createdQuotation ? (
            <ManualForm
              clientId={selectedClient?.id ?? null}
              onQuotationCreated={handleManualCreated}
              disabled={false}
              clientDna={activeDna}
              attachmentFiles={manualAttachments}
              onAttachmentFilesChange={setManualAttachments}
            />
          ) : (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-muted-foreground">
                  Cotação criada:{' '}
                  <span className="font-medium text-foreground">
                    {createdQuotation.reference}
                  </span>
                </span>
              </div>
              <ExtractionResultsGrid
                values={fieldValues}
                onChange={handleFieldChange}
                quotation={createdQuotation}
                onEquipmentsUpdate={handleEquipmentsUpdate}
                onVolumesUpdate={handleVolumesUpdate}
              />
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Completeness + actions */}
      {showCompletenessBar && (
        <>
          <CompletenessBar score={score} missingFields={missingFields} />

          <div className="flex flex-col sm:flex-row justify-end gap-3">
            {missingFields.length > 0 && (
              <Button
                variant="outline"
                onClick={handleRequestData}
                className="w-full sm:w-auto"
              >
                <Send className="w-4 h-4 mr-2" />
                Solicitar Dados
              </Button>
            )}
            <Button
              variant="outline"
              onClick={handleSave}
              disabled={isSaving || autoSaveStatus === 'saving'}
              className="w-full sm:w-auto"
            >
              {isSaving || autoSaveStatus === 'saving' ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : autoSaveStatus === 'saved' ? (
                <Check className="w-4 h-4 mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {autoSaveStatus === 'saved' && !isSaving ? 'Salvo' : 'Salvar'}
            </Button>
            <Button
              onClick={handleStartQuotation}
              disabled={!canStartQuotation}
              className="w-full sm:w-auto"
            >
              <Play className="w-4 h-4 mr-2" />
              Iniciar Cotação
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
