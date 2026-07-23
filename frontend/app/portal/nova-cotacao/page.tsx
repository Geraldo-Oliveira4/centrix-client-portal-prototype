'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2 } from 'lucide-react';
import {
  Button,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui';
import { createMyQuotation, triggerMyQuotationExtraction } from '@/hooks/use-portal-quotations';
import { useQuotationUploadFlow } from '@/hooks/use-quotation-upload-flow';
import { ManualForm } from '@/app/cotacao/nova-cotacao/components/manual-form';
import { UploadZone } from '@/app/cotacao/nova-cotacao/components/upload-zone';
import { RfqDispatchCard } from '@/app/portal/cotacao/[id]/components/rfq-dispatch-card';
import { PortalExporterSelect } from '@/app/portal/components/portal-exporter-select';
import type { Quotation } from '@/types/quotation';
import type { Exporter } from '@/types/exporter';

type PagePhase = 'idle' | 'submitting' | 'done';

export default function PortalNovaCotacaoPage() {
  const router = useRouter();
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
          <CheckCircle2 className="h-16 w-16 text-green-500" />
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Nova Cotação</h1>
        <p className="text-sm text-muted-foreground">
          Envie os documentos da sua carga ou preencha os dados manualmente.
        </p>
      </div>

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
            <UploadZone
              files={uploadFiles}
              onFilesChange={setUploadFiles}
              msgUploadProgress={0}
              isUploading={phase === 'submitting'}
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
