'use client';

// Telas 3 a 6 — a jornada "novo embarque a partir de um PO", do lado do
// cliente.
//
// A rota já está mapeada para o módulo `embarqueViaPo` desde o Prompt 1
// (`feature-flags.ts`), então com a flag desligada quem abrir esta URL recebe o
// `ModuleNotReleased` do layout e nada daqui chega a montar.
//
// A FREITAS NÃO TEM TELA. A fila de validação e a tela de validação (Telas 10 e
// 11) são do Centrix interno e ficam fora deste protótipo; aqui a Freitas é a
// seção "Embarque via PO" do painel de demonstração.

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, FileText, Info, Loader2, PenLine } from 'lucide-react';
import { LoaderComponent } from '@arboria-tech/arboria-ui';
import { toast } from 'react-toastify';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { UploadZone } from '@/app/cotacao/nova-cotacao/components/upload-zone';
import { useMyShipments } from '@/hooks/use-portal-shipments';
import { useMyQuotations } from '@/hooks/use-portal-quotations';
import { ESTADO_LABELS } from '@/types/portal-shipment';

import { PagePortalHeader } from '../../_shared/page-header';
import {
  PO_READ_DURATION_MS,
  PO_READ_FIELDS,
  PO_READ_FIELD_LABELS,
  simulateRead,
  type PoDocumentPreview,
} from '../../_shared/demo/shipment-po-read';
import {
  createDraft,
  nextPoReference,
  saveDraft,
  submitToFreitas,
  type DuplicateCandidate,
  type PoShipmentData,
  type ShipmentPoReview,
} from '../../_shared/demo/shipment-po-review';
import {
  putShipmentPoReview,
  readShipmentPoStore,
  useShipmentPoStore,
} from '../../_shared/demo/use-shipment-po-review';
import { usePoReadFailure } from '../../_shared/demo/po-review-view';
import { indexQuotations, routePartsOf } from '../../inteligencia/lib/shipment-dimensions';
import { flattenQuotations } from '../../inteligencia/lib/intel-helpers';
import { allowsAutoFill, poSources } from '../../_shared/demo/client-kind';
import { DataSourceStrip } from '../../_shared/demo/data-source-strip';
import { useClientKind } from '../../_shared/demo/use-client-profile';
import { PoForm } from './po-form';

type Step = 'upload' | 'form';

const STEPS = ['Enviar o PO', 'Conferir os dados', 'Enviar à Freitas'];

/**
 * Limite de tamanho do anexo.
 *
 * PLACEHOLDER: a spec diz "mesmo padrão de tamanho do upload da cotação" e
 * deixa o número exato como "[limite a definir]". A constante existe para que
 * o valor apareça uma vez só na tela.
 */
const PO_SIZE_LIMIT_LABEL = 'até [limite a definir] MB';

function Stepper({ current }: { current: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-3 gap-y-2 portal-card px-5 py-4">
      {STEPS.map((label, index) => (
        <li key={label} className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className={cn(
              'portal-small flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-medium',
              index < current
                ? 'bg-portal-success text-background'
                : index === current
                  ? 'bg-brand-indigo text-white'
                  : 'bg-muted text-portal-neutral',
            )}
          >
            {index < current ? <Check className="h-4 w-4" /> : index + 1}
          </span>
          <span
            className={cn(
              'portal-body',
              index === current
                ? 'font-medium text-foreground'
                : 'text-portal-neutral',
            )}
          >
            {label}
          </span>
          {index < STEPS.length - 1 && (
            <span aria-hidden="true" className="hidden h-px w-8 bg-border sm:block" />
          )}
        </li>
      ))}
    </ol>
  );
}

function PortalNovoEmbarqueContent() {
  const router = useRouter();
  const params = useSearchParams();
  const resumeId = params.get('rascunho');
  const manualParam = params.get('manual') === '1';

  const failRead = usePoReadFailure();
  const store = useShipmentPoStore();
  const { shipments } = useMyShipments();
  const { data: quotationsData } = useMyQuotations();

  const [step, setStep] = useState<Step>(manualParam ? 'form' : 'upload');
  const [files, setFiles] = useState<File[]>([]);
  const [reading, setReading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [readFieldCount, setReadFieldCount] = useState(0);
  const [draft, setDraft] = useState<ShipmentPoReview | null>(null);
  const [preview, setPreview] = useState<PoDocumentPreview | null>(null);
  // A leitura FALHOU? O anexo fica, os campos não. A tela precisa saber disso
  // para não dizer "lemos o arquivo" sobre um documento que ela não leu.
  const [readFailed, setReadFailed] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  // SaaS puro (Prompt 3): o PO é ANEXADO, não lido. Ninguém extrai os dados
  // por você; o arquivo fica aguardando conferência e os campos vêm vazios.
  const clientKind = useClientKind();
  const saas = !allowsAutoFill(clientKind);

  // Retomar um rascunho (ou editar um embarque em análise) abre direto o
  // formulário, com o que já estava preenchido.
  useEffect(() => {
    if (!resumeId) return;
    const entry = readShipmentPoStore()[resumeId];
    if (!entry) return;
    setDraft(entry);
    setStep('form');
  }, [resumeId]);

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
    },
    [],
  );

  /**
   * Os embarques que já existem, para o dedup (RQ-5).
   *
   * Vêm da API E do overlay: um PO já usado num embarque aberto por PO também
   * é um duplicado, e olhar só a carteira do backend deixaria passar o segundo
   * envio do mesmo número dentro da própria demonstração.
   */
  const candidates = useMemo<DuplicateCandidate[]>(() => {
    const byQuotation = indexQuotations(flattenQuotations(quotationsData));
    const fromApi = shipments
      .filter((s) => s.client_reference)
      .map((s) => {
        const route = routePartsOf(s, byQuotation);
        return {
          id: s.id,
          reference: s.referencia,
          route: `${route.origin} → ${route.destination}`,
          createdAt: s.created_at,
          stateLabel: ESTADO_LABELS[s.estado] ?? s.estado,
          poNumbers: [s.client_reference as string],
        };
      });
    const fromOverlay = Object.entries(store)
      .filter(([id, entry]) => id !== resumeId && entry.data.poNumbers.length > 0)
      .map(([id, entry]) => ({
        id,
        reference: entry.reference,
        route: 'A definir',
        createdAt: entry.history[0]?.at ?? entry.stageEnteredAt,
        stateLabel: entry.stage === 'active' ? 'Ativo' : 'Em análise',
        poNumbers: entry.data.poNumbers,
      }));
    return [...fromOverlay, ...fromApi];
  }, [shipments, quotationsData, store, resumeId]);

  const newReference = useCallback(
    () => nextPoReference(readShipmentPoStore(), shipments.map((s) => s.referencia)),
    [shipments],
  );

  const startReading = (file: File) => {
    setReading(true);
    setProgress(0);
    setReadFieldCount(0);
    const stepMs = PO_READ_DURATION_MS / PO_READ_FIELDS.length;
    // Um temporizador por campo: é o que faz o cliente VER a leitura
    // acontecendo, em vez de uma barra que anda sozinha.
    PO_READ_FIELDS.forEach((_, index) => {
      timers.current.push(
        setTimeout(
          () => {
            setReadFieldCount(index + 1);
            setProgress(Math.round(((index + 1) / PO_READ_FIELDS.length) * 100));
          },
          stepMs * (index + 1),
        ),
      );
    });
    timers.current.push(
      setTimeout(() => {
        const result = simulateRead(file.name, { fail: failRead });
        const at = new Date().toISOString();
        setDraft(
          createDraft(
            newReference(),
            'po',
            at,
            result.data,
            result.attachmentName,
            result.confidence,
          ),
        );
        setPreview(result.preview);
        setReadFailed(!result.ok);
        setReading(false);
        if (!result.ok) {
          toast.warn(
            'Não conseguimos ler este PO. O arquivo ficou anexado — preencha os dados na próxima etapa.',
          );
        }
      }, PO_READ_DURATION_MS),
    );
  };

  const attachWithoutReading = (file: File) => {
    setDraft(createDraft(newReference(), 'po', new Date().toISOString(), {}, file.name));
    setPreview(null);
    setReadFailed(false);
  };

  const goManual = () => {
    setDraft(createDraft(newReference(), 'manual', new Date().toISOString()));
    setPreview(null);
    setReadFailed(false);
    setStep('form');
  };

  const persist = (data: PoShipmentData, submit: boolean) => {
    if (!draft) return;
    const at = new Date().toISOString();
    const id = resumeId ?? `po-${Date.now()}`;
    const saved = saveDraft(draft, data, at, draft.attachmentName);
    const next = submit ? submitToFreitas(saved, at) : saved;
    putShipmentPoReview(id, next);
    if (submit) {
      toast.success(
        `${next.reference} criado. A Freitas vai revisar antes de ativar.`,
      );
      router.push(`/portal/embarques?tab=lista&destaque=${id}`);
      return;
    }
    setDraft(next);
    toast.success('Rascunho salvo. Retome em “Abrir novo embarque”.');
  };

  return (
    <div className="space-y-6">
      <nav className="portal-small text-portal-neutral">
        <Link href="/portal/embarques" className="hover:underline">
          Meus Embarques
        </Link>
        <span className="mx-1.5">›</span>
        <span className="text-foreground">Novo embarque a partir de um PO</span>
      </nav>

      <PagePortalHeader
        title="Novo embarque a partir de um PO"
        subtitle={
          step === 'upload'
            ? saas
              ? 'Anexe o PO e preencha os dados do embarque. O arquivo fica anexado, aguardando conferência.'
              : 'Anexe o PO. Lemos o documento e você só confere os dados.'
            : saas && draft?.attachmentName
              ? `${draft.attachmentName} anexado, aguardando conferência. Preencha os dados abaixo: nada foi lido do arquivo.`
            : readFailed && draft?.attachmentName
              ? `Não conseguimos ler o ${draft.attachmentName}. Ele ficou anexado — preencha os dados abaixo.`
              : draft?.attachmentName
                ? `Lemos o ${draft.attachmentName}. Corrija o que estiver diferente.`
                : 'Preencha os dados do embarque. A Freitas revisa antes de ativar.'
        }
      />

      <Stepper current={step === 'upload' ? 0 : 1} />

      {step === 'upload' ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
          <div className="min-w-0 space-y-4">
            <UploadZone
              files={files}
              onFilesChange={(next) => {
                setFiles(next);
                const file = next[next.length - 1];
                if (file) {
                  if (saas) attachWithoutReading(file);
                  else startReading(file);
                }
              }}
              msgUploadProgress={0}
              isUploading={reading}
              title="Arraste o PO aqui ou clique para anexar"
              expectedDocuments={['Purchase Order']}
            />
            <p className="portal-small text-portal-neutral">
              PDF, Word, Excel ou imagem · {PO_SIZE_LIMIT_LABEL}
            </p>

            {(reading || draft) && files.length > 0 && (
              <section className="portal-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="portal-body flex items-center gap-2 font-medium text-foreground">
                    <FileText className="h-4 w-4 shrink-0 text-portal-neutral" />
                    {files[files.length - 1].name}
                  </p>
                  <span className="portal-small text-portal-neutral">
                    {saas
                      ? 'Anexado · aguardando conferência'
                      : reading
                        ? 'Lendo o documento…'
                        : 'Leitura concluída'}
                  </span>
                </div>
                {!saas && (
                <>
                <div
                  className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-valuenow={progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Progresso da leitura do PO"
                >
                  <div
                    className="h-full rounded-full bg-brand-indigo transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {PO_READ_FIELDS.map((field, index) => (
                    <li
                      key={field}
                      className={cn(
                        'portal-small rounded px-1.5 py-0.5',
                        index < readFieldCount
                          ? 'bg-portal-success/15 text-portal-success'
                          : 'bg-muted text-portal-neutral',
                      )}
                    >
                      {PO_READ_FIELD_LABELS[field]}
                    </li>
                  ))}
                </ul>
                </>
                )}
              </section>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={goManual}
                className="portal-body inline-flex items-center gap-1.5 font-medium text-brand-indigo hover:underline"
              >
                <PenLine className="h-4 w-4 shrink-0" />
                Não tenho o arquivo. Preencher manualmente
              </button>
              <div className="flex gap-2">
                <Button variant="outline" asChild>
                  <Link href="/portal/embarques">Cancelar</Link>
                </Button>
                <Button
                  disabled={reading || !draft}
                  onClick={() => setStep('form')}
                >
                  {reading ? (
                    <>
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      Lendo…
                    </>
                  ) : (
                    'Continuar'
                  )}
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {saas ? (
              <DataSourceStrip title="De onde vêm os dados" lines={poSources(clientKind)} />
            ) : (
            <section className="portal-card p-5">
              <h2 className="portal-h3">O que lemos do PO</h2>
              <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5">
                {PO_READ_FIELDS.map((field) => (
                  <li key={field} className="portal-small text-portal-neutral">
                    {PO_READ_FIELD_LABELS[field]}
                  </li>
                ))}
              </ul>
              <p className="portal-small mt-3 text-portal-neutral">
                Você corrige o que estiver errado na próxima etapa.
              </p>
            </section>
            )}

            <div className="flex gap-2.5 rounded-lg border border-brand-indigo-800/30 bg-brand-indigo-100 px-4 py-3">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-brand-indigo" />
              <p className="portal-small text-foreground/80">
                A Freitas revisa o embarque antes de ele ficar ativo. Você
                acompanha o status em Meus Embarques.
              </p>
            </div>

            {/* RQ-11 */}
            <div className="flex gap-2.5 rounded-lg border border-border bg-muted/30 px-4 py-3">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-portal-neutral" />
              <p className="portal-small text-portal-neutral">
                Em breve: importação automática dos seus processos, direto do seu
                despachante.
              </p>
            </div>
          </div>
        </div>
      ) : draft ? (
        <>
        {saas && (
          <DataSourceStrip title="Você informa os dados do PO" lines={poSources(clientKind)} />
        )}
        <PoForm
          review={draft}
          preview={preview}
          candidates={candidates}
          onSaveDraft={(data) => persist(data, false)}
          onSubmit={(data) => persist(data, true)}
        />
        </>
      ) : (
        <LoaderComponent />
      )}
    </div>
  );
}

export default function PortalNovoEmbarquePage() {
  return (
    <Suspense fallback={<LoaderComponent />}>
      <PortalNovoEmbarqueContent />
    </Suspense>
  );
}
