'use client';

// Fechamento direto com o agente preferido da rota (Orsi, 29/09/2026).
//
// VISÃO DO CLIENTE, e só ela. O pedido vai para o Inbox da Freitas e passa pela
// revisão de entrada como qualquer outra entrada; quem aprova ou devolve é a
// seção "Fechamento direto" do painel de demonstração. Nada aqui chama a API:
// é overlay local, como o resto da V2 (`_shared/demo/direct-close.ts`).
//
// A rota decide o agente. O cliente não escolhe agente nesta tela: ou a rota
// tem um preferido, ou o caminho é cotar — e o estado vazio diz isso e leva à
// Nova cotação com a rota já preenchida.

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Handshake,
  Route,
  Undo2,
} from 'lucide-react';

import {
  Button,
  Combobox,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@/components/ui';
import { INCOTERM_OPTIONS } from '@/constants';
import { cn } from '@/lib/utils';
import { PagePortalHeader } from '@/app/portal/_shared/page-header';
import { REVIEW_SLA_LABEL } from '@/app/portal/_shared/demo/quotation-v2-labels';
import {
  DIRECT_CLOSE_ROUTES,
  DIRECT_CLOSE_STAGE_DESCRIPTIONS,
  DIRECT_CLOSE_STAGE_LABELS,
  EMPTY_DIRECT_CLOSE_FORM,
  EMPTY_MANUAL_ROUTE,
  directCloseIssues,
  requestRouteLabel,
  quoteNormallyHref,
  resubmitDirectClose,
  routeLabel,
  submitDirectClose,
  type DirectCloseForm,
  type DirectCloseRequest,
  type DirectCloseStage,
  type ManualDirectCloseRoute,
} from '@/app/portal/_shared/demo/direct-close';
import { allowsAutoFill, directCloseSources } from '@/app/portal/_shared/demo/client-kind';
import { DataSourceStrip } from '@/app/portal/_shared/demo/data-source-strip';
import { useClientKind } from '@/app/portal/_shared/demo/use-client-profile';
import {
  putDirectClose,
  readDirectCloseStore,
  updateDirectClose,
  useDirectCloseStore,
} from '@/app/portal/_shared/demo/use-direct-close';

const STAGE_TONE: Record<DirectCloseStage, string> = {
  entry_review: 'bg-portal-warning/15 text-portal-warning-ink',
  returned: 'bg-portal-warning/15 text-portal-warning-ink',
  approved: 'bg-portal-success/15 text-portal-success',
};

function StageBadge({ stage }: { stage: DirectCloseStage }) {
  return (
    <span
      className={cn(
        'portal-small inline-flex shrink-0 items-center rounded px-1.5 py-0.5 font-medium',
        STAGE_TONE[stage],
      )}
    >
      {DIRECT_CLOSE_STAGE_LABELS[stage]}
    </span>
  );
}

function Field({
  id,
  label,
  optional,
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {optional && (
          <span className="font-normal text-portal-neutral"> (opcional)</span>
        )}
      </Label>
      {children}
    </div>
  );
}

export default function FechamentoDiretoPage() {
  const store = useDirectCloseStore();
  const [form, setForm] = useState<DirectCloseForm>(EMPTY_DIRECT_CLOSE_FORM);
  /** Set while correcting a returned request: the send becomes a resend. */
  const [correcting, setCorrecting] = useState<DirectCloseRequest | null>(null);
  const [sent, setSent] = useState<DirectCloseRequest | null>(null);
  // SaaS puro (Prompt 3): não há rota combinada com a Freitas nem agente
  // preferido para preencher; o cliente informa rota e agente. Um pedido
  // manual em correção continua manual, qualquer que seja o tipo agora.
  const clientKind = useClientKind();
  const saas = !allowsAutoFill(clientKind);
  const [manual, setManual] = useState<ManualDirectCloseRoute>(EMPTY_MANUAL_ROUTE);
  const manualOrNull = saas || correcting?.manualRoute ? manual : null;

  const route =
    DIRECT_CLOSE_ROUTES.find((item) => item.id === form.routeId) ?? null;
  const issues = directCloseIssues(form, DIRECT_CLOSE_ROUTES, manualOrNull);
  const requests = useMemo(
    () =>
      Object.values(store).sort((a, b) =>
        b.reference.localeCompare(a.reference),
      ),
    [store],
  );

  const set = (patch: Partial<DirectCloseForm>) =>
    setForm((current) => ({ ...current, ...patch }));

  const send = () => {
    const at = new Date().toISOString();
    if (correcting) {
      updateDirectClose(correcting.id, (request) =>
        resubmitDirectClose(request, form, at),
      );
      setSent(readDirectCloseStore()[correcting.id] ?? null);
    } else {
      const request = submitDirectClose(
        readDirectCloseStore(),
        form,
        at,
        DIRECT_CLOSE_ROUTES,
        manualOrNull,
      );
      if (!request) return;
      putDirectClose(request);
      setSent(request);
    }
    setCorrecting(null);
    setForm(EMPTY_DIRECT_CLOSE_FORM);
    setManual(EMPTY_MANUAL_ROUTE);
  };

  const startCorrection = (request: DirectCloseRequest) => {
    setSent(null);
    setCorrecting(request);
    setForm(request.form);
    if (request.manualRoute)
      setManual({ ...request.manualRoute, agent: request.agent });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const shipmentFields = (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field id="fd-produto" label="Mercadoria">
                      <Input
                        id="fd-produto"
                        value={form.product}
                        onChange={(e) => set({ product: e.target.value })}
                        placeholder="Ex.: Peças de reposição"
                      />
                    </Field>
                    <Field id="fd-ref" label="Referência do cliente">
                      <Input
                        id="fd-ref"
                        value={form.clientReference}
                        onChange={(e) =>
                          set({ clientReference: e.target.value })
                        }
                        placeholder="Ex.: PO-12345"
                      />
                    </Field>
                    <Field id="fd-incoterm" label="Incoterm">
                      <Combobox
                        value={form.incoterm}
                        onValueChange={(incoterm) => set({ incoterm })}
                        options={INCOTERM_OPTIONS}
                        placeholder="Selecionar..."
                        searchPlaceholder="Buscar incoterm..."
                      />
                    </Field>
                    <Field id="fd-prontidao" label="Prontidão da carga">
                      <Input
                        id="fd-prontidao"
                        type="date"
                        value={form.readyDate}
                        onChange={(e) => set({ readyDate: e.target.value })}
                      />
                    </Field>
                    <div className="sm:col-span-2">
                      <Field id="fd-carga" label="Carga">
                        <Input
                          id="fd-carga"
                          value={form.cargo}
                          onChange={(e) => set({ cargo: e.target.value })}
                          placeholder="Ex.: 1 × 40’ HC, 12.000 kg"
                        />
                      </Field>
                    </div>
                    <div className="sm:col-span-2">
                      <Field id="fd-obs" label="Observações" optional>
                        <Textarea
                          id="fd-obs"
                          value={form.observations}
                          onChange={(e) =>
                            set({ observations: e.target.value })
                          }
                          rows={3}
                          className="resize-none"
                          placeholder="O que o agente precisa saber sobre este embarque"
                        />
                      </Field>
                    </div>
                  </div>
  );

  return (
    <div className="space-y-8">
      <Link
        href="/portal/nova-cotacao"
        className="portal-small inline-flex items-center gap-1 text-portal-neutral hover:text-brand-indigo"
      >
        <ArrowLeft className="h-4 w-4" /> Nova cotação
      </Link>
      <PagePortalHeader
        title={saas ? 'Fechar direto com o seu agente' : 'Fechar direto com agente preferido'}
        subtitle={
          saas
            ? 'Para rotas em que você já embarca com o mesmo agente: sem cotação. Você informa a rota e o agente.'
            : 'Para rotas em que você já embarca com o mesmo agente: sem cotação. A Freitas revisa o pedido e envia a instrução ao agente.'
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
          {sent ? (
            <section className="portal-card space-y-4 p-6" role="status">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-6 w-6 shrink-0 text-portal-success" />
                <div className="space-y-1">
                  <h2 className="portal-h3">
                    Pedido {sent.reference} enviado à Freitas
                  </h2>
                  <p className="portal-body text-portal-neutral">
                    Ele entrou no Inbox da revisão de entrada. Prazo:{' '}
                    {REVIEW_SLA_LABEL}. Depois da aprovação, a instrução de
                    embarque segue para {sent.agent}.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setSent(null)}>Novo pedido</Button>
                <Button variant="outline" asChild>
                  <Link href="/portal/cotacoes">Ir para Minhas Cotações</Link>
                </Button>
              </div>
            </section>
          ) : (
            <section className="portal-card space-y-6 p-6">
              {correcting && (
                <div
                  role="status"
                  className="flex gap-2.5 rounded-lg border border-portal-warning/40 bg-portal-warning/10 px-4 py-3"
                >
                  <Undo2 className="mt-0.5 h-5 w-5 shrink-0 text-portal-warning-ink" />
                  <div className="min-w-0">
                    <p className="portal-body font-medium text-portal-warning-ink">
                      Corrigindo {correcting.reference}
                    </p>
                    <p className="portal-small text-portal-warning-ink">
                      {correcting.returnReason}
                    </p>
                  </div>
                </div>
              )}

              {manualOrNull ? (
                <>
                  <DataSourceStrip
                    title="Você informa a rota e o agente"
                    lines={directCloseSources('saas')}
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field id="fd-origem" label="Origem">
                      <Input
                        id="fd-origem"
                        value={manual.origin}
                        onChange={(e) => setManual((m) => ({ ...m, origin: e.target.value }))}
                        placeholder="Ex.: Ningbo"
                        disabled={!!correcting}
                      />
                    </Field>
                    <Field id="fd-destino" label="Destino">
                      <Input
                        id="fd-destino"
                        value={manual.destination}
                        onChange={(e) => setManual((m) => ({ ...m, destination: e.target.value }))}
                        placeholder="Ex.: Itajaí"
                        disabled={!!correcting}
                      />
                    </Field>
                    <div className="sm:col-span-2">
                      <Field id="fd-agente" label="Agente com quem você embarca">
                        <Input
                          id="fd-agente"
                          value={manual.agent}
                          onChange={(e) => setManual((m) => ({ ...m, agent: e.target.value }))}
                          placeholder="Nome do agente"
                          disabled={!!correcting}
                        />
                      </Field>
                    </div>
                  </div>
                  {shipmentFields}
                </>
              ) : (
              <>
              <Field id="fd-rota" label="Rota">
                <Select
                  value={form.routeId}
                  onValueChange={(routeId) => set({ routeId })}
                  disabled={!!correcting}
                >
                  <SelectTrigger id="fd-rota">
                    <SelectValue placeholder="Escolha a rota" />
                  </SelectTrigger>
                  <SelectContent>
                    {DIRECT_CLOSE_ROUTES.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {routeLabel(item)} · Marítimo
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              {route && !route.preferredAgent ? (
                // ESTADO VAZIO: a rota existe, o agente preferido nao. Explica
                // de onde o preferido vem e oferece o caminho que funciona.
                <div className="flex flex-col items-start gap-4 rounded-lg border border-dashed border-border p-6">
                  <Route className="h-6 w-6 text-portal-neutral" />
                  <div className="space-y-1">
                    <h3 className="portal-h3">
                      {routeLabel(route)} ainda não tem agente preferido
                    </h3>
                    <p className="portal-body text-portal-neutral">
                      O agente preferido de uma rota é combinado com a Freitas a
                      partir do seu histórico nela. Sem ele, o caminho é cotar:
                      a Freitas aciona os agentes e você compara as propostas.
                    </p>
                  </div>
                  <Button asChild>
                    <Link href={quoteNormallyHref(route)}>
                      Cotar normalmente <ArrowRight className="ml-2 h-5 w-5" />
                    </Link>
                  </Button>
                </div>
              ) : route ? (
                <>
                  <div className="flex items-start gap-3 rounded-lg border border-border bg-brand-indigo-100 px-4 py-3">
                    <Handshake className="mt-0.5 h-6 w-6 shrink-0 text-brand-indigo" />
                    <div className="min-w-0">
                      <p className="portal-small text-portal-neutral">
                        Agente preferido da rota
                      </p>
                      <p className="portal-body font-medium text-foreground">
                        {route.preferredAgent}
                      </p>
                      <p className="portal-small text-portal-neutral">
                        Combinado com a Freitas para {routeLabel(route)}. Para
                        comparar outros agentes,{' '}
                        <Link
                          href={quoteNormallyHref(route)}
                          className="font-medium text-brand-indigo underline underline-offset-4"
                        >
                          cote normalmente
                        </Link>
                        .
                      </p>
                    </div>
                  </div>

                  {shipmentFields}
                </>
              ) : (
                <p className="portal-small text-portal-neutral">
                  Escolha a rota para ver o agente preferido e preencher os
                  dados do embarque.
                </p>
              )}
              </>
              )}

              {(manualOrNull || !(route && !route.preferredAgent)) && (
                <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-4">
                  {(route || manualOrNull) && issues.length > 0 && (
                    <p className="portal-small text-portal-neutral">
                      {issues.length === 1 ? 'Falta' : 'Faltam'}:{' '}
                      {issues.map((issue) => issue.label).join(', ')}
                    </p>
                  )}
                  {correcting && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setCorrecting(null);
                        setForm(EMPTY_DIRECT_CLOSE_FORM);
                        setManual(EMPTY_MANUAL_ROUTE);
                      }}
                    >
                      Desistir da correção
                    </Button>
                  )}
                  <Button disabled={issues.length > 0} onClick={send}>
                    {correcting
                      ? 'Corrigir e reenviar'
                      : 'Enviar para a Freitas'}
                  </Button>
                </div>
              )}
            </section>
          )}

          {requests.length > 0 && (
            <section className="space-y-3" aria-labelledby="fd-pedidos">
              <h2 id="fd-pedidos" className="portal-h2">
                Seus pedidos de fechamento direto
              </h2>
              <ul className="space-y-2">
                {requests.map((request) => {
                  return (
                    <li
                      key={request.id}
                      className="portal-card flex flex-wrap items-start justify-between gap-3 p-4"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="portal-body font-medium text-foreground">
                            {request.reference}
                          </p>
                          <StageBadge stage={request.stage} />
                        </div>
                        <p className="portal-small text-portal-neutral">
                          {requestRouteLabel(request)} ·{' '}
                          {request.agent} · PO {request.form.clientReference}
                        </p>
                        <p className="portal-small text-foreground/80">
                          {DIRECT_CLOSE_STAGE_DESCRIPTIONS[request.stage]}
                        </p>
                        {request.stage === 'returned' &&
                          request.returnReason && (
                            <p className="portal-small flex items-start gap-1.5 text-portal-warning-ink">
                              <Undo2 className="mt-0.5 h-4 w-4 shrink-0" />
                              Ajuste pedido pela Freitas: {request.returnReason}
                            </p>
                          )}
                        {request.stage === 'entry_review' && (
                          <p className="portal-small inline-flex items-center gap-1 text-portal-neutral">
                            <Clock3 className="h-4 w-4" /> Revisão em{' '}
                            {REVIEW_SLA_LABEL}
                          </p>
                        )}
                      </div>
                      {request.stage === 'returned' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => startCorrection(request)}
                        >
                          Corrigir e reenviar
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <section className="portal-card p-5">
            <h2 className="portal-h3">Como funciona</h2>
            <ol className="mt-4 space-y-4">
              {[
                [
                  'Você envia',
                  'A rota, o agente preferido e os dados mínimos do embarque.',
                ],
                [
                  'A Freitas revisa',
                  `Como qualquer entrada, no Inbox. Prazo: ${REVIEW_SLA_LABEL}.`,
                ],
                [
                  'O agente recebe a instrução',
                  'Sem cotação: o embarque segue com o agente preferido.',
                ],
              ].map(([title, body], index) => (
                <li key={title} className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className="portal-small mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted font-medium text-portal-neutral"
                  >
                    {index + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="portal-body block font-medium text-foreground">
                      {title}
                    </span>
                    <span className="portal-small block text-portal-neutral">
                      {body}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
          <p className="portal-small text-portal-neutral">
            Demonstração: os agentes preferidos por rota são fictícios e o
            pedido fica salvo só neste navegador.
          </p>
        </aside>
      </div>
    </div>
  );
}
