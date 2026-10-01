'use client';

import Link from 'next/link';
import { QUOTATION_HELP } from '@/app/portal/_shared/quotation-help';
import { Suspense, useCallback, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Handshake,
  History,
  Loader2,
  Radar,
} from 'lucide-react';
import { LoaderComponent } from '@arboria-tech/arboria-ui';
import {
  Button,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui';
import {
  createMyQuotation,
  triggerMyQuotationExtraction,
  useMyQuotations,
} from '@/hooks/use-portal-quotations';
import { matchHistory } from '@/app/portal/_shared/history-match';
import { allowsAutoFill, quotationSources } from '@/app/portal/_shared/demo/client-kind';
import { DataSourceStrip } from '@/app/portal/_shared/demo/data-source-strip';
import { useClientKind } from '@/app/portal/_shared/demo/use-client-profile';
import { flattenQuotations } from '@/app/portal/inteligencia/lib/intel-helpers';
import { useQuotationUploadFlow } from '@/hooks/use-quotation-upload-flow';
import {
  ManualForm,
  type ManualFormDraft,
  type ManualFormValues,
} from '@/app/cotacao/nova-cotacao/components/manual-form';
import { UploadZone } from '@/app/cotacao/nova-cotacao/components/upload-zone';
import { RfqDispatchCard } from '@/app/portal/cotacao/[id]/components/rfq-dispatch-card';
import { PortalExporterSelect } from '@/app/portal/components/portal-exporter-select';
import { PagePortalHeader } from '@/app/portal/_shared/page-header';
import { WhatHappensNextPanel } from '@/app/portal/_shared/demo/what-happens-next';
import { submitToFreitas } from '@/app/portal/_shared/demo/quotation-review';
import { evaluateHardblocks } from '@/app/portal/_shared/demo/quotation-hardblocks';
import {
  snapshotFromDraft,
  type FormSnapshot,
} from '@/app/portal/_shared/demo/quotation-form-snapshot';
import { updateQuotationReview } from '@/app/portal/_shared/demo/use-quotation-review';
import { usePortalModuleReleased } from '@/app/portal/_shared/demo/use-feature-flags';
import {
  ORIGIN_PARAM,
  radarOriginFields,
} from '@/app/portal/inteligencia/lib/price-radar';
import type {
  CreatePortalQuotationPayload,
  PortalQuotationOriginFields,
} from '@/types/portal';
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
 *
 * Além dos valores, o link carrega a ORIGEM (`origem=radar_precos`), que é
 * gravada junto da cotação para se poder medir depois quantas cotações o Radar
 * gerou. Ela é lida separada do pré-preenchimento de propósito: um porto que o
 * formulário não conhece deixa o campo em branco, mas o clique continua tendo
 * vindo do Radar e continua contando.
 */
function usePrefillFromParams(): {
  values: Partial<ManualFormValues>;
  routeLabel: string | null;
  origin: PortalQuotationOriginFields | null;
} {
  const params = useSearchParams();
  const modal = params.get('modal');
  const portoEmbarque = params.get('porto_embarque');
  const portoDestino = params.get('porto_destino');
  const routeLabel = params.get('rota');
  const origem = params.get(ORIGIN_PARAM);

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
      origin: radarOriginFields(origem, routeLabel),
    };
  }, [modal, portoEmbarque, portoDestino, routeLabel, origem]);
}

function PortalNovaCotacaoContent() {
  const router = useRouter();
  const { values: prefill, routeLabel, origin } = usePrefillFromParams();
  // COTACAO V2 (RQ-1). Com a flag ligada o cliente nao escolhe agentes: o envio
  // vai para a fila de revisao da Freitas, e a tela de sucesso com o
  // `RfqDispatchCard` deixa de existir. Com a flag desligada nada abaixo muda.
  const v2 = usePortalModuleReleased('cotacaoV2');
  // SaaS puro (Prompt 3): nada entra preenchido — nem a rota do Radar, nem a
  // leitura de documentos. A regra mora em `client-kind.ts`.
  const clientKind = useClientKind();
  const autoFill = allowsAutoFill(clientKind);
  const [phase, setPhase] = useState<PagePhase>('idle');
  const [createdQuotation, setCreatedQuotation] = useState<Quotation | null>(null);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  // Only the manual form carries an exporter: the upload flow creates the
  // quotation from the extracted documents, where the exporter comes from the
  // extraction (not exercised in this prototype).
  const [exporter, setExporter] = useState<Exporter | null>(null);
  const [formValues, setFormValues] = useState<Partial<ManualFormValues>>({});
  const { data: myQuotations } = useMyQuotations();
  const historyMatch = useMemo(
    () =>
      matchHistory(
        {
          product: formValues.product,
          origins: [formValues.origin, formValues.porto_embarque, formValues.aeroporto_embarque],
          destinations: [...(formValues.porto_destino ?? []), ...(formValues.aeroporto_destino ?? [])],
        },
        flattenQuotations(myQuotations),
      ),
    [formValues, myQuotations],
  );

  // A origem entra no payload aqui, e não dentro do formulário: `ManualForm` é
  // copiado do Centrix (é a mesma tela do analista) e não conhece Radar. Mesma
  // divisão do `exporter_id`, que também é vinculado por fora — ver
  // `backend/app/quotation_exporter.py`.
  const createWithOrigin = useCallback(
    (payload: CreatePortalQuotationPayload) =>
      createMyQuotation(origin ? { ...payload, ...origin } : payload),
    [origin],
  );

  const { uploadAndCreate } = useQuotationUploadFlow({
    createFn: createWithOrigin,
    triggerExtractionFn: triggerMyQuotationExtraction,
  });

  /**
   * O que "Enviar para a Freitas" faz de verdade.
   *
   * A COTACAO CONTINUA SENDO CRIADA PELA API, exatamente como antes (o
   * `createFn` ja rodou quando chegamos aqui) — o que o V2 acrescenta e o
   * OVERLAY local em `entry_review`, com o id devolvido pelo backend. Nenhuma
   * referencia e inventada e a numeracao do seed nao e tocada: o
   * `reference` impresso na confirmacao e o que o repositorio gerou.
   *
   * Na versao integrada esta transicao e um estado da cotacao no backend; aqui
   * ela vive no navegador (ver o cabecalho de `quotation-review.ts`).
   */
  const sendToFreitas = useCallback(
    (quotation: Quotation, form?: FormSnapshot) => {
      updateQuotationReview(quotation.id, (review) =>
        submitToFreitas(review, new Date().toISOString(), form),
      );
      toast.success(`Solicitação ${quotation.reference} enviada à Freitas`);
      router.push(`/portal/cotacoes?destaque=${quotation.id}`);
    },
    [router],
  );

  // Os hardblocks do Orsi (29/09/2026) so valem na V2: com a flag desligada o
  // formulario continua exatamente como era.
  const exporterName = exporter?.name ?? null;
  const hardblocks = useCallback(
    (draft: ManualFormDraft) =>
      evaluateHardblocks(snapshotFromDraft(draft, exporterName)),
    [exporterName],
  );

  const handleManualCreated = (
    quotation: Quotation,
    snapshot?: ManualFormDraft,
  ) => {
    if (v2) {
      // O snapshot guarda o que o payload nao devolve (fator de escolha, NCM,
      // "agentes decidam"): e a base do diff de uma edicao futura e dos
      // hardblocks da revisao de saida.
      sendToFreitas(
        quotation,
        snapshot ? snapshotFromDraft(snapshot, exporterName) : undefined,
      );
      return;
    }
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

    if (v2) {
      sendToFreitas(quotation);
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
        subtitle={
          v2
            ? 'Preencha os dados da carga. A Freitas revisa antes de acionar os agentes.'
            : 'Envie os documentos da sua carga ou preencha os dados manualmente.'
        }
      />

      {/* De onde veio o pré-preenchimento. Sem esta linha, campos já
          preenchidos numa tela de criação leem como resíduo de um rascunho
          antigo — e o cliente apaga o que estava certo. */}
      {!autoFill && (
        <DataSourceStrip
          title="Você informa tudo nesta solicitação"
          lines={quotationSources(clientKind)}
        />
      )}

      {autoFill && routeLabel && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-brand-indigo-800/30 bg-brand-indigo-100 px-4 py-3">
          <Radar className="h-6 w-6 shrink-0 text-brand-indigo" />
          <p className="portal-body text-foreground/80">
            Rota e modal já preenchidos a partir do{' '}
            <span className="font-medium text-foreground">Radar de Preços</span>{' '}
            ({routeLabel}). Confira e complete o resto da carga.
          </p>
        </div>
      )}

      {/* FECHAMENTO DIRETO (Orsi, 29/09/2026). Atalho SECUNDARIO: e navegacao,
          nao a acao da tela, entao fica em indigo e nao em laranja — o CTA da
          pagina continua sendo "Enviar para a Freitas". */}
      {v2 && (
        <Link
          href="/portal/nova-cotacao/fechamento-direto"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex min-w-0 items-start gap-2.5">
            <Handshake className="mt-0.5 h-6 w-6 shrink-0 text-brand-indigo" />
            <span className="min-w-0">
              <span className="portal-body block font-medium text-foreground">
                Já embarca sempre com o mesmo agente nesta rota?
              </span>
              <span className="portal-small block text-portal-neutral">
                {autoFill
                  ? 'Feche direto com o agente preferido da rota, sem cotar. A Freitas revisa antes de instruir o agente.'
                  : 'Registre o pedido direto com o seu agente, informando rota e agente, sem cotar.'}
              </span>
            </span>
          </span>
          <span className="portal-small inline-flex shrink-0 items-center gap-1 font-medium text-brand-indigo">
            Fechar direto com agente preferido{' '}
            <ArrowRight className="h-4 w-4" />
          </span>
        </Link>
      )}

      {/* Com o V2 a tela ganha uma coluna lateral fixa: as quatro etapas do
          RQ-3. Sem ele, o formulario ocupa a largura inteira como sempre
          ocupou — o `grid` so existe quando ha um segundo elemento para
          colocar ao lado. */}
      <div
        className={
          v2 ? 'grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]' : undefined
        }
      >
      <Tabs defaultValue="manual" className="min-w-0">
        <TabsList>
          <TabsTrigger className="data-[state=active]:border-brand-indigo-800" value="manual">Preencher manualmente</TabsTrigger>
          <TabsTrigger className="data-[state=active]:border-brand-indigo-800" value="upload">Enviar arquivos</TabsTrigger>
        </TabsList>

        <TabsContent value="manual" className="mt-4 space-y-4">
          {/* "VOCE JA EMBARCOU ESTA CARGA" (30/09/2026): discreto, informativo,
              e a acao reaproveita o "Cotar novamente" que ja existe. */}
          {historyMatch && (
            <div
              role="status"
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3"
            >
              <p className="portal-body flex items-center gap-2 text-foreground/80">
                <History className="h-5 w-5 shrink-0 text-brand-indigo" />
                {historyMatch.shipped ? 'Você já embarcou esta carga' : 'Você já cotou esta carga'} em{' '}
                {monthLabel(historyMatch.month)} ({historyMatch.reference})
                {historyMatch.destinationUnknown
                  ? ', com o mesmo produto e a mesma origem. O destino não estava registrado nela: confira antes de copiar.'
                  : '.'}
              </p>
              <Link
                href={`/portal/cotacoes/repetir/${historyMatch.quotationId}?retorno=${encodeURIComponent('/portal/nova-cotacao')}`}
                className="portal-small inline-flex min-h-11 items-center gap-1 font-medium text-brand-indigo underline underline-offset-4"
              >
                Copiar dados da cotação anterior <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}
          <ManualForm
            // Remonta se o tipo de cliente mudar depois da hidratação: o
            // formulário lê `initialValues` uma vez, no mount.
            key={clientKind}
            clientId={null}
            onQuotationCreated={handleManualCreated}
            disabled={phase === 'submitting'}
            attachmentFiles={attachmentFiles}
            onAttachmentFilesChange={setAttachmentFiles}
            createFn={createWithOrigin}
            initialValues={autoFill ? prefill : undefined}
            exporterId={exporter?.id ?? null}
            submitLabel={v2 ? 'Enviar para a Freitas' : undefined}
            hardblocks={v2 ? hardblocks : undefined}
            clientFacing
            onValuesChange={setFormValues}
            helpTips={QUOTATION_HELP}
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
          {!autoFill ? (
            <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-border p-6">
              <FileText className="h-6 w-6 text-portal-neutral" />
              <h2 className="portal-h3">Sem leitura automática de documentos</h2>
              <p className="portal-body max-w-2xl text-portal-neutral">
                Na sua conta ninguém lê os documentos para montar a cotação: não
                há operação da Freitas nem integração por trás. Preencha os
                dados na aba “Preencher manualmente” e anexe os arquivos lá —
                eles ficam anexados, aguardando conferência.
              </p>
            </div>
          ) : (
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
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Enviando...
                  </>
                ) : v2 ? (
                  'Enviar para a Freitas'
                ) : (
                  'Solicitar cotação'
                )}
              </Button>
            </div>
          </div>
          )}
        </TabsContent>
      </Tabs>

      {v2 && <WhatHappensNextPanel />}
      </div>
    </div>
  );
}

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
/** "2026-08" -> "agosto de 2026". */
function monthLabel(month: string): string {
  const [year, m] = month.split('-').map(Number);
  return MONTHS[m - 1] ? `${MONTHS[m - 1]} de ${year}` : month;
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
