'use client';

import { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, Loader2, Radar } from 'lucide-react';
import { LoaderComponent } from '@arboria-tech/arboria-ui';
import {
  Button,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui';
import { createMyQuotation, triggerMyQuotationExtraction } from '@/hooks/use-portal-quotations';
import { useQuotationUploadFlow } from '@/hooks/use-quotation-upload-flow';
import {
  ManualForm,
  type ManualFormValues,
} from '@/app/cotacao/nova-cotacao/components/manual-form';
import { UploadZone } from '@/app/cotacao/nova-cotacao/components/upload-zone';
import { RfqDispatchCard } from '@/app/portal/cotacao/[id]/components/rfq-dispatch-card';
import { PortalExporterSelect } from '@/app/portal/components/portal-exporter-select';
import { PagePortalHeader } from '@/app/portal/_shared/page-header';
import type { Quotation } from '@/types/quotation';
import type { Exporter } from '@/types/exporter';

type PagePhase = 'idle' | 'submitting' | 'done';

// Os documentos que a Freitas espera do processo. É a lista de DOCUMENTOS, não
// de formatos: ".msg, PDF, Word…" dizia o que o input aceita, nunca o que o
// cliente deveria mandar. Os formatos continuam logo abaixo, como detalhe.
const PORTAL_EXPECTED_DOCUMENTS = [
  'BL / AWB',
  'Invoice',
  'Packing List',
  'Certificado de origem',
  'E-mail do exportador',
];

/**
 * Pré-preenchimento vindo do "Cotar agora" do Radar de Preços
 * (`inteligencia/lib/price-radar.ts::quotationPrefillParams`).
 *
 * Só três campos, e só os que a rota REALMENTE conhece: modal e os dois portos.
 * Mercadoria, prazos e incoterm continuam em branco — chutá-los pelo histórico
 * faria o cliente enviar uma cotação que ele não conferiu, que é pior do que
 * digitá-los.
 *
 * Parâmetro desconhecido ou vazio é simplesmente ignorado: o link é público na
 * barra de endereço, e um valor inesperado não pode quebrar a tela de criação.
 */
function usePrefillFromParams(): {
  values: Partial<ManualFormValues>;
  routeLabel: string | null;
} {
  const params = useSearchParams();
  const modal = params.get('modal');
  const portoEmbarque = params.get('porto_embarque');
  const portoDestino = params.get('porto_destino');
  const routeLabel = params.get('rota');

  return useMemo(() => {
    const values: Partial<ManualFormValues> = {};
    if (modal === 'MARITIMO' || modal === 'AEREO' || modal === 'RODOVIARIO') {
      values.modal = modal;
    }
    if (portoEmbarque) values.porto_embarque = portoEmbarque;
    // `porto_destino` é lista no formulário: a cotação pode nomear vários portos
    // candidatos. O radar conhece um, então a lista sai com um item.
    if (portoDestino) values.porto_destino = [portoDestino];
    return {
      values,
      routeLabel: Object.keys(values).length > 0 ? routeLabel : null,
    };
  }, [modal, portoEmbarque, portoDestino, routeLabel]);
}

function PortalNovaCotacaoContent() {
  const router = useRouter();
  const { values: prefill, routeLabel } = usePrefillFromParams();
  const [phase, setPhase] = useState<PagePhase>('idle');
  const [createdQuotation, setCreatedQuotation] = useState<Quotation | null>(null);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  // Only the manual form carries an exporter: the upload flow creates the
  // quotation from the extracted documents, where the exporter comes from the
  // extraction (not exercised in this prototype).
  const [exporter, setExporter] = useState<Exporter | null>(null);

  const { uploadAndCreate } = useQuotationUploadFlow({
    createFn: createMyQuotation,
    triggerExtractionFn: triggerMyQuotationExtraction,
  });

  const handleManualCreated = (quotation: Quotation) => {
    setCreatedQuotation(quotation);
    setPhase('done');
  };

  const handleUploadSubmit = async () => {
    if (!uploadFiles.length) return;
    setPhase('submitting');

    const quotation = await uploadAndCreate(uploadFiles, {
      source: 'upload',
      files: uploadFiles.map((f) => f.name),
    });

    if (!quotation) {
      setPhase('idle');
      return;
    }

    setCreatedQuotation(quotation);
    setPhase('done');
  };

  if (phase === 'done' && createdQuotation) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 py-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <CheckCircle2 className="h-16 w-16 text-portal-success" />
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Cotação Criada!</h2>
            <p className="text-muted-foreground">
              Referência:{' '}
              <span className="font-semibold text-foreground">
                {createdQuotation.reference}
              </span>
            </p>
            <p className="text-sm text-muted-foreground">
              Selecione abaixo os agentes de carga que devem receber esta
              solicitação.
            </p>
          </div>
        </div>

        <RfqDispatchCard
          quotationId={createdQuotation.id}
          desiredDeadline={createdQuotation.desired_deadline}
          originMissing={
            !createdQuotation.origin &&
            !createdQuotation.agente_define_local_coleta &&
            createdQuotation.incoterm !== 'FOB'
          }
          onDispatched={() => router.push('/portal/cotacoes')}
        />

        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => router.push('/portal/cotacoes')}
          >
            Ver minhas cotações
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PagePortalHeader
        title="Nova Cotação"
        subtitle="Envie os documentos da sua carga ou preencha os dados manualmente."
      />

      {/* De onde veio o pré-preenchimento. Sem esta linha, campos já
          preenchidos numa tela de criação leem como resíduo de um rascunho
          antigo — e o cliente apaga o que estava certo. */}
      {routeLabel && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/[0.04] px-4 py-3">
          <Radar className="h-5 w-5 shrink-0 text-primary" />
          <p className="portal-body text-foreground/80">
            Rota e modal já preenchidos a partir do{' '}
            <span className="font-medium text-foreground">Radar de Preços</span>{' '}
            ({routeLabel}). Confira e complete o resto da carga.
          </p>
        </div>
      )}

      <Tabs defaultValue="manual">
        <TabsList>
          <TabsTrigger value="manual">Preencher manualmente</TabsTrigger>
          <TabsTrigger value="upload">Enviar arquivos</TabsTrigger>
        </TabsList>

        <TabsContent value="manual" className="mt-4">
          <ManualForm
            clientId={null}
            onQuotationCreated={handleManualCreated}
            disabled={phase === 'submitting'}
            attachmentFiles={attachmentFiles}
            onAttachmentFilesChange={setAttachmentFiles}
            createFn={createMyQuotation}
            initialValues={prefill}
            exporterId={exporter?.id ?? null}
            exporterSection={
              <PortalExporterSelect
                value={exporter?.id ?? null}
                onChange={setExporter}
                disabled={phase === 'submitting'}
              />
            }
          />
        </TabsContent>

        <TabsContent value="upload" className="mt-4">
          <div className="space-y-4">
            <p className="portal-small text-portal-neutral">
              Envie o que você já tem do processo — BL ou AWB, Invoice, Packing
              List, certificado de origem, ou o próprio e-mail do exportador. A
              Freitas usa esses documentos para montar a cotação, então nada
              precisa ser digitado duas vezes.
            </p>
            <UploadZone
              files={uploadFiles}
              onFilesChange={setUploadFiles}
              msgUploadProgress={0}
              isUploading={phase === 'submitting'}
              title="Arraste aqui os documentos do processo"
              expectedDocuments={PORTAL_EXPECTED_DOCUMENTS}
            />
            <div className="flex justify-end">
              <Button
                onClick={handleUploadSubmit}
                disabled={!uploadFiles.length || phase === 'submitting'}
              >
                {phase === 'submitting' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  'Solicitar cotação'
                )}
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function PortalNovaCotacaoPage() {
  // `useSearchParams` (o deep link "Cotar agora" do Radar de Preços) exige um
  // limite de Suspense para o prerender estático desta rota — mesmo arranjo de
  // `embarques/page.tsx`.
  return (
    <Suspense fallback={<LoaderComponent />}>
      <PortalNovaCotacaoContent />
    </Suspense>
  );
}
