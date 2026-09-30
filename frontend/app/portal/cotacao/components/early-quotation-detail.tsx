'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, Clock3, Pencil, Undo2, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useMyClient, useQuotationAgents } from '@/hooks/use-portal-quotations';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui';
import { formatBRL, formatDate } from '@/lib/portal-formatters';
import type { PortalQuotation, PortalProposal } from '@/types/portal';
import { DraftRequestForm } from '../../cotacoes/previa/draft-request-form';
import type { Quote } from '../../cotacoes/previa/model';
import {
  editableQuotation,
  mergeInvitations,
} from '../../cotacoes/lib/preparation-model';
import { requestIssue } from '../../cotacoes/lib/repeat-model';
import { PreparationSteps, WaitingResponses } from './quotation-preparation';
import {
  ChangedFieldsList,
  REVIEW_SLA_LABEL,
  ResubmittedChip,
  V2StageBadge,
} from '../../_shared/demo/quotation-v2-labels';
import { WhatHappensNextPanel } from '../../_shared/demo/what-happens-next';
import {
  V2_CLIENT_CANCELLABLE_STAGES,
  V2_STAGE_DESCRIPTIONS,
  agentsNotified,
  canResubmitEdit,
  cancelByClient,
  isResubmission,
  lastSubmission,
  resubmitEdited,
  submitToFreitas,
} from '../../_shared/demo/quotation-review';
import {
  evaluateHardblocks,
  hardblockCountLabel,
} from '../../_shared/demo/quotation-hardblocks';
import {
  draftPatchFromSnapshot,
  snapshotFromDraft,
} from '../../_shared/demo/quotation-form-snapshot';
import { reviewDueAt } from '../../_shared/demo/review-sla';
import { effectiveProposals } from '../../_shared/demo/quotation-demo-proposals';
import {
  readQuotationReviewStore,
  updateQuotationReview,
  useQuotationReview,
} from '../../_shared/demo/use-quotation-review';
import { CancelDialog } from '../[id]/components/cancel-dialog';
import type { ManualFormDraft } from '../../../cotacao/nova-cotacao/components/manual-form';
import { usePortalModuleReleased } from '../../_shared/demo/use-feature-flags';
import s from '../../cotacoes/previa/quotation-preview.module.css';

type Preparation = { quote: Quote; waiting: boolean; invited: string[] };

export function EarlyQuotationDetail({
  quotation: source,
  refresh,
}: {
  quotation: PortalQuotation;
  refresh: () => void;
}) {
  const { client } = useMyClient();
  const catalog = useQuotationAgents(source.id);
  // COTACAO V2. `v2` so e verdadeiro quando a flag esta ligada E esta cotacao
  // tem overlay: uma cotacao antiga, sem overlay, continua com a escolha de
  // agentes e o "Revisar convite" de sempre, mesmo com a flag ligada.
  const v2Released = usePortalModuleReleased('cotacaoV2');
  const overlay = useQuotationReview(source.id);
  const v2 = v2Released && overlay != null;
  const [saved, setSaved] = useState<Preparation>(() => ({
    quote: editableQuotation(source),
    waiting: false,
    invited: [],
  }));
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [review, setReview] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [viewed, setViewed] = useState<PortalProposal | null>(null);
  // Cotação V2: the client reopened the form while the entry review runs
  // (Orsi, 29/09/2026). Local on purpose — until they resend, the Freitas keeps
  // reviewing the version it has, and abandoning the edit changes nothing.
  const [editingInReview, setEditingInReview] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [hasSavedDraft, setHasSavedDraft] = useState(false);
  const key = client
    ? `centrix-preparation-v1:${client.id}:${source.id}`
    : null;
  useEffect(() => {
    if (!key) return;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const value = JSON.parse(raw);
        if (!value?.quote?.manualDraft || !Array.isArray(value.invited))
          throw new Error();
        setSaved(value);
        setHasSavedDraft(true);
      }
      setLoaded(true);
    } catch {
      setError(
        'Não foi possível recuperar o rascunho. Os dados salvos não serão sobrescritos.',
      );
    }
  }, [key]);
  const write = (next: Preparation) => {
    if (!key || !loaded) return false;
    try {
      localStorage.setItem(key, JSON.stringify(next));
      window.dispatchEvent(new Event('centrix-preparation'));
      setSaved(next);
      setError('');
      return true;
    } catch {
      setError(
        'Não foi possível salvar. Mantenha esta tela aberta e tente novamente.',
      );
      return false;
    }
  };
  const q = saved.quote;
  // Na V2 quem decide se o formulario esta aberto e a ETAPA, nao o `state` do
  // payload: uma cotacao que ja esta com a Freitas continua AGUARDANDO_DADOS no
  // backend (a V2 nao tem estado no servidor), e sem esta linha o cliente
  // poderia reeditar e reenviar uma solicitacao que ja esta em revisao.
  const stage = v2 ? overlay!.stage : null;
  const editing = v2
    ? stage === 'draft' ||
      stage === 'returned' ||
      (stage === 'entry_review' && editingInReview)
    : source.state === 'AGUARDANDO_DADOS' && !saved.waiting;
  // The stage moved while the client was editing (the Freitas approved and the
  // RFQ went out, by hand or by the automatic reply). Close the form and SAY
  // why, instead of letting it vanish with the edits in it.
  useEffect(() => {
    if (editingInReview && stage !== 'entry_review') {
      setEditingInReview(false);
      setError(
        stage === 'cancelled'
          ? ''
          : 'A Freitas aprovou a solicitação e acionou os agentes enquanto você editava. As alterações não foram enviadas. Se algo mudou, cancele esta solicitação e abra uma nova.',
      );
    }
  }, [editingInReview, stage]);
  // A quotation sent from Nova cotação has no local draft: the form would
  // reopen from the payload, which does not carry the choice factor, the NCM
  // or the "agentes decidam" switches. The snapshot sent with it gives them
  // back, so the client is not asked again for what they already answered.
  const formQuote = useMemo(() => {
    if (!v2 || hasSavedDraft || !overlay?.submittedForm || !q.manualDraft) {
      return q;
    }
    const patch = draftPatchFromSnapshot(overlay.submittedForm);
    const values: Record<string, unknown> = { ...q.manualDraft.values };
    for (const [key, value] of Object.entries(patch.values)) {
      if (values[key] == null || values[key] === '') values[key] = value;
    }
    return {
      ...q,
      manualDraft: {
        ...q.manualDraft,
        values: values as ManualFormDraft['values'],
        flags: { ...q.manualDraft.flags, ...patch.flags },
      },
    };
  }, [v2, hasSavedDraft, overlay?.submittedForm, q]);
  const proposals = source.proposals || [];
  const invited = mergeInvitations(
    catalog.rfqDispatched ? catalog.selectedAgentIds : [],
    mergeInvitations(
      proposals.map((p) => p.agent_id),
      saved.invited,
    ),
  );
  const available = catalog.agents.filter((a) => !invited.includes(a.id));
  const awaitingResponses = catalog.rfqDispatched || invited.length > 0;
  const names = (id: string) =>
    catalog.agents.find((a) => a.id === id)?.name ||
    proposals.find((p) => p.agent_id === id)?.agent?.name ||
    'Agente não identificado';
  const apply = (patch: Partial<Quote>) => ({
    ...saved,
    quote: { ...saved.quote, ...patch },
  });
  /**
   * "Enviar para a Freitas" (RQ-1) e "Corrigir e reenviar" (RQ-5).
   *
   * A MESMA transicao para os dois botoes — o que muda e de que etapa ela sai,
   * e o overlay registra qual das duas aconteceu (`submitted` x `resubmitted`).
   * Nenhum agente e escolhido aqui: na V2 quem os aciona e a revisao de entrada.
   */
  const sendToFreitas = (patch?: Partial<Quote>) => {
    const next = patch ? apply(patch) : saved;
    const draft = next.quote.manualDraft;
    const form = draft ? snapshotFromDraft(draft, next.quote.supplier) : null;
    // Na V2 o portao e a lista do Orsi, a mesma que desabilita o botao. O
    // `requestIssue` do fluxo antigo pedia coisas que ela nao pede (prazo de
    // resposta futuro, peso e volume) e travaria a correcao por outro motivo.
    if (form) {
      const { blocks } = evaluateHardblocks(form);
      if (blocks.length) {
        setSaved(next);
        setError(
          `${hardblockCountLabel(blocks.length)} para enviar: ${blocks
            .map((block) => block.label)
            .join(', ')}.`,
        );
        return;
      }
    }
    // Le o store, nao o snapshot do React: a autorresposta pode ter avancado a
    // etapa enquanto o cliente digitava.
    const current = readQuotationReviewStore()[source.id] ?? overlay;
    const from = current?.stage ?? 'draft';
    if (from === 'entry_review' && current && form) {
      const check = canResubmitEdit(current, form);
      if (check === 'no_changes') {
        setError('');
        setNotice(
          'Nada mudou em relação à versão que a Freitas está revisando. Altere um campo para reenviar, ou descarte a edição.',
        );
        return;
      }
    }
    if (from !== 'draft' && from !== 'returned' && from !== 'entry_review') {
      setEditingInReview(false);
      return;
    }
    if (patch && !write(next)) return;
    const at = new Date().toISOString();
    updateQuotationReview(source.id, (review) =>
      review.stage === 'entry_review' && form
        ? resubmitEdited(review, form, at)
        : submitToFreitas(review, at, form ?? undefined),
    );
    setError('');
    setSelected([]);
    setReview(false);
    setEditingInReview(false);
    setNotice(
      from === 'draft'
        ? `Solicitação ${source.reference} enviada à Freitas. Ela entrou no Inbox da revisão de entrada (prazo: ${REVIEW_SLA_LABEL}).`
        : from === 'returned'
          ? `Correção enviada. ${source.reference} voltou ao Inbox da Freitas e a revisão recomeçou (prazo: ${REVIEW_SLA_LABEL}).`
          : `Alterações reenviadas. ${source.reference} voltou ao Inbox da Freitas como nova rodada e a revisão recomeçou (prazo: ${REVIEW_SLA_LABEL}).`,
    );
  };
  const cancellable =
    v2 && stage != null && V2_CLIENT_CANCELLABLE_STAGES.includes(stage);
  const due =
    v2 && (stage === 'entry_review' || stage === 'exit_review')
      ? reviewDueAt(overlay!.stageEnteredAt)
      : null;
  const approvedProposal =
    v2 && stage === 'approved'
      ? effectiveProposals(source).find(
          (p) => p.id === overlay!.approvedProposalId,
        )
      : undefined;
  const send = () => {
    const valid = selected.filter((id) =>
      available.some((agent) => agent.id === id),
    );
    if (!valid.length || catalog.isLoading || catalog.isError) {
      setError('Selecione agentes disponíveis para continuar.');
      return;
    }
    if (editing) {
      const issue = requestIssue(q);
      if (issue) {
        setError(issue);
        return;
      }
    }
    if (
      write({
        ...saved,
        waiting: true,
        invited: mergeInvitations(saved.invited, valid),
      })
    ) {
      setSelected([]);
      setReview(false);
      setNotice(
        'Envio simulado. Os agentes selecionados agora aparecem no acompanhamento abaixo.',
      );
    }
  };
  if (!loaded)
    return <div className="p-6">{error || 'Carregando solicitação…'}</div>;
  return (
    <div className={s.workspace + ' mx-auto max-w-6xl space-y-5'}>
      <Link
        className="portal-small underline underline-offset-4"
        href="/portal/cotacoes"
      >
        Voltar às cotações
      </Link>
      <header className={s.heading}>
        <h1 className="text-2xl font-semibold">
          {v2 && stage === 'returned'
            ? 'Corrigir e reenviar'
            : v2 && stage === 'entry_review' && editing
              ? 'Editar solicitação em revisão'
              : editing
                ? 'Preencher solicitação'
                : v2 && stage === 'approved'
                  ? 'Proposta aprovada'
                  : v2 && stage === 'cancelled'
                    ? 'Solicitação cancelada'
                    : v2
                      ? 'Com a Freitas'
                : awaitingResponses
                  ? 'Aguardando agentes'
                  : 'Preparar envio aos agentes'}
        </h1>
        <p className="portal-body mt-2 text-portal-neutral">
          {source.reference} · {q.product || 'Mercadoria a informar'}
        </p>
      </header>
      <p className="portal-small text-portal-neutral">
        Prévia · alterações e convites salvos neste navegador. Nenhum envio real
        é realizado.
      </p>
      {/* FAIXA DA DEVOLUCAO (RQ-5): o motivo escrito pela Freitas fica visivel
          enquanto o cliente corrige, e nao dentro de um historico que ele teria
          de abrir. */}
      {v2 && overlay?.stage === 'returned' && overlay.returnReason && (
        <div
          role="status"
          className="flex gap-2.5 rounded-lg border border-portal-warning/40 bg-portal-warning/10 px-4 py-3"
        >
          <Undo2 className="mt-0.5 h-5 w-5 shrink-0 text-portal-warning-ink" />
          <div className="min-w-0">
            <p className="portal-body font-medium text-portal-warning-ink">
              A Freitas devolveu esta solicitação para ajuste
            </p>
            <p className="portal-small text-portal-warning-ink">
              {overlay.returnReason}
            </p>
          </div>
        </div>
      )}
      {v2 && overlay && overlay.stage !== 'returned' && (
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <V2StageBadge stage={overlay.stage} />
            {isResubmission(overlay) && <ResubmittedChip />}
            <span className="portal-small text-portal-neutral">
              {V2_STAGE_DESCRIPTIONS[overlay.stage]}
            </span>
            {due && (
              <span className="portal-small inline-flex items-center gap-1 text-portal-neutral">
                <Clock3 className="h-4 w-4 shrink-0" />
                Prazo da revisão: até{' '}
                {due.toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}
          </div>
          {isResubmission(overlay) && (
            <ChangedFieldsList
              changes={lastSubmission(overlay)?.changes}
              max={6}
            />
          )}
        </div>
      )}
      {/* EDICAO EM REVISAO (Orsi, 29/09/2026): a faixa diz o que acontece com
          a versao que a Freitas ja tem, e oferece a saida sem reenviar. */}
      {v2 && stage === 'entry_review' && editing && (
        <div
          role="status"
          className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-brand-indigo-800/30 bg-brand-indigo-100 px-4 py-3"
        >
          <div className="flex min-w-0 flex-1 gap-2.5">
            <Pencil className="mt-0.5 h-5 w-5 shrink-0 text-brand-indigo" />
            <div className="min-w-0">
              <p className="portal-body font-medium text-foreground">
                Você está editando uma solicitação em revisão
              </p>
              <p className="portal-small text-foreground/80">
                A Freitas continua com a versão enviada até você reenviar. Ao
                reenviar, a solicitação volta ao Inbox como nova rodada e a
                revisão recomeça (prazo: {REVIEW_SLA_LABEL}).
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditingInReview(false);
              setError('');
              setNotice(
                'Você saiu da edição sem reenviar. A Freitas segue revisando a versão enviada.',
              );
            }}
          >
            Sair sem reenviar
          </Button>
        </div>
      )}
      {/* Aprovada e cancelada nao estao mais na jornada de preparo: a regua
          diria "aguardando" sobre uma cotacao que ja terminou. */}
      {!(v2 && (stage === 'approved' || stage === 'cancelled')) && (
        <PreparationSteps
          waiting={v2 ? !editing : !editing && awaitingResponses}
          subtext={
            v2 && !editing ? V2_STAGE_DESCRIPTIONS[overlay!.stage] : undefined
          }
        />
      )}
      {error && (
        <p role="alert" className="text-portal-warning-ink">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="portal-body">
          {notice}
        </p>
      )}
      {editing ? (
        <div className={v2 ? 'grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]' : undefined}>
        <section className={s.panel + ' ' + s.formPanel}>
          <div className={s.sectionHeading}>
            <div>
              <h2>
                {v2 && stage === 'returned'
                  ? 'Corrigir e reenviar'
                  : v2 && stage === 'entry_review'
                    ? 'Editar e reenviar'
                    : 'Rascunho da solicitação'}
              </h2>
              <p>
                {v2 && stage === 'entry_review'
                  ? 'O formulário inteiro está aberto. Altere o que mudou e reenvie.'
                  : v2
                    ? 'Confira os dados e envie. A Freitas revisa antes de acionar os agentes.'
                    : 'Continue o formulário de onde parou. Revise os dados antes de selecionar os agentes.'}
              </p>
            </div>
          </div>
          <DraftRequestForm
            quotation={formQuote}
            reviewLabel={
              v2
                ? stage === 'returned'
                  ? 'Corrigir e reenviar'
                  : stage === 'entry_review'
                    ? 'Reenviar para a Freitas'
                    : 'Enviar para a Freitas'
                : undefined
            }
            hardblocks={
              v2
                ? (draft, supplier) =>
                    evaluateHardblocks(snapshotFromDraft(draft, supplier))
                : undefined
            }
            onSave={(patch) => {
              if (write(apply(patch)))
                setNotice('Rascunho salvo neste navegador.');
            }}
            onReview={(patch) => {
              if (v2) {
                sendToFreitas(patch);
                return;
              }
              const next = apply(patch);
              setSaved(next);
              const issue = requestIssue(next.quote);
              if (issue) {
                setError(issue);
                return;
              }
              setError('');
              setSelected([]);
              setReview(true);
            }}
          />
          {v2 && cancellable && (
            <div className="flex justify-end px-6 pb-5">
              <button
                className={s.textButton}
                onClick={() => setCancelOpen(true)}
              >
                Não vou mais cotar · Cancelar solicitação
              </button>
            </div>
          )}
        </section>
        {v2 && <WhatHappensNextPanel />}
        </div>
      ) : (
        <>
          <section className={s.context} aria-label="Necessidade da carga">
            <div className={s.route}>
              <div>
                <small>Rota da solicitação</small>
                <strong>
                  {q.origin} → {q.destination}
                </strong>
                <small>PO: {q.po || 'não informado'}</small>
              </div>
            </div>
            <div>
              <small>Carga pronta em</small>
              <strong>
                {q.readyDate ? formatDate(q.readyDate) : 'Não informada'}
              </strong>
            </div>
            <div className={s.cargoNeed}>
              <small>Sua necessidade de chegada</small>
              <strong>
                {q.needDate ? formatDate(q.needDate) : 'Não informada'}
              </strong>
            </div>
          </section>
          {v2 && overlay && stage === 'approved' ? (
            <section className={s.panel}>
              <div className={s.sectionHeading}>
                <div>
                  <h2 className="flex items-center gap-2">
                    <CheckCircle2 className="h-6 w-6 shrink-0 text-portal-success" />
                    Proposta aprovada
                  </h2>
                  <p>
                    {approvedProposal
                      ? `Você aprovou a proposta de ${approvedProposal.agent?.name || 'agente selecionado'} (${formatBRL(approvedProposal.total_brl)}). `
                      : ''}
                    A Freitas recebeu a instrução de fechamento e o embarque já
                    está em Meus Embarques.
                  </p>
                </div>
                <Link className={s.textButton} href="/portal/embarques">
                  Acompanhar embarque <ArrowRight size={16} />
                </Link>
              </div>
            </section>
          ) : v2 && overlay && stage === 'cancelled' ? (
            <section className={s.panel}>
              <div className={s.sectionHeading}>
                <div>
                  <h2 className="flex items-center gap-2">
                    <XCircle className="h-6 w-6 shrink-0 text-portal-neutral" />
                    Solicitação cancelada
                  </h2>
                  <p>
                    Justificativa registrada: “
                    {[...overlay.history]
                      .reverse()
                      .find((event) => event.kind === 'cancelled')?.reason ??
                      'não informada'}
                    ”. A cotação está no Histórico, junto das canceladas.
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <Link className={s.textButton} href="/portal/cotacoes?tab=historico">
                    Ver no Histórico <ArrowRight size={16} />
                  </Link>
                  <Link className={s.textButton} href="/portal/nova-cotacao">
                    Abrir nova cotação <ArrowRight size={16} />
                  </Link>
                </div>
              </div>
            </section>
          ) : v2 && overlay && stage ? (
            <section className={s.panel}>
              <div className={s.sectionHeading}>
                <div>
                  <h2>Com a Freitas</h2>
                  <p>{V2_STAGE_DESCRIPTIONS[stage]}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4 border-t border-border px-6 py-4">
                {stage === 'entry_review' ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditingInReview(true);
                        setNotice('');
                        setError('');
                      }}
                    >
                      <Pencil className="mr-2 h-5 w-5" />
                      Editar solicitação
                    </Button>
                    <p className="portal-small min-w-0 flex-1 text-portal-neutral">
                      O formulário inteiro reabre. Ao reenviar, a solicitação
                      volta ao Inbox como nova rodada e a revisão recomeça.
                    </p>
                  </>
                ) : agentsNotified(stage) ? (
                  <p className="portal-small min-w-0 flex-1 text-portal-neutral">
                    Os agentes já receberam o pedido, por isso os dados não
                    podem mais ser editados por aqui: mudar agora exigiria um
                    novo pedido. Se algo mudou, cancele esta solicitação e abra
                    uma nova cotação.
                  </p>
                ) : null}
                {cancellable && (
                  <button
                    className={s.textButton}
                    onClick={() => setCancelOpen(true)}
                  >
                    Cancelar solicitação
                  </button>
                )}
              </div>
            </section>
          ) : null}
          {awaitingResponses && (!v2 || (stage != null && agentsNotified(stage))) ? (
            <WaitingResponses
              rows={invited.map((id) => ({
                id,
                name:
                  names(id) +
                  (saved.invited.includes(id) ? ' · convite simulado' : ''),
                received: proposals.some((p) => p.agent_id === id),
              }))}
              count={proposals.length}
              deadline={
                q.manualDraft?.values.desired_deadline
                  ? formatDate(q.manualDraft.values.desired_deadline)
                  : null
              }
              loading={catalog.isLoading}
              unavailable={catalog.isError}
              onRefresh={() => {
                void catalog.mutate();
                refresh();
              }}
              onView={(id) =>
                setViewed(proposals.find((p) => p.agent_id === id) || null)
              }
            />
          ) : v2 ? // Na V2 nao existe "envio nao confirmado" do lado do cliente:
          // quem diz onde a solicitacao esta e o painel acima.
          null : (
            <section className={s.panel}>
              <div className={s.sectionHeading}>
                <div>
                  <h2>Envio aos agentes não confirmado</h2>
                  <p>
                    {catalog.isLoading
                      ? 'Consultando o envio desta solicitação…'
                      : catalog.isError
                        ? 'Não foi possível consultar o envio. Atualize para tentar novamente.'
                        : 'Nenhum convite enviado consta nesta solicitação. Selecione os destinatários abaixo para revisar o envio.'}
                  </p>
                </div>
                <button
                  className={s.textButton}
                  onClick={() => {
                    void catalog.mutate();
                    refresh();
                  }}
                >
                  Atualizar
                </button>
              </div>
            </section>
          )}
          {/* ESCOLHA DE AGENTES — SOME NA V2 (RQ-1).
              Na V2 quem aciona os agentes e a revisao de entrada da Freitas,
              depois de conferir os dados. Deixar o bloco visivel (ainda que
              desabilitado) ofereceria ao cliente uma decisao que ele nao tem
              mais, e "Convidar outros agentes" contradiz diretamente o painel
              que acabou de dizer que ele nao precisa escolher ninguem. */}
          {!v2 && (
          <section className={s.panel}>
            <div className={s.sectionHeading}>
              <div>
                <h2>
                  {awaitingResponses
                    ? 'Convidar outros agentes'
                    : 'Selecionar agentes'}
                </h2>
                <p>
                  {awaitingResponses
                    ? 'Os agentes já convidados permanecem acima. Selecione outros para ampliar a cotação.'
                    : 'Escolha quem receberá esta solicitação. Você confere os destinatários antes de confirmar.'}
                </p>
              </div>
            </div>
            <div className="space-y-3 p-6">
              {catalog.isLoading ? (
                <p>Consultando agentes disponíveis…</p>
              ) : catalog.isError ? (
                <p>
                  Não foi possível consultar o catálogo.{' '}
                  <Button variant="ghost" onClick={() => void catalog.mutate()}>
                    Tentar novamente
                  </Button>
                </p>
              ) : !available.length ? (
                <p>Nenhum outro agente disponível nesta cotação.</p>
              ) : (
                available.map((agent) => (
                  <label
                    className="flex items-center gap-3 border-b py-3 last:border-0 portal-body"
                    key={agent.id}
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(agent.id)}
                      onChange={(e) =>
                        setSelected(
                          e.target.checked
                            ? [...selected, agent.id]
                            : selected.filter((id) => id !== agent.id),
                        )
                      }
                    />
                    {agent.name}
                  </label>
                ))
              )}
              <Button
                variant="outline"
                disabled={
                  !selected.length || catalog.isError || catalog.isLoading
                }
                onClick={() => setReview(true)}
              >
                Revisar convite{selected.length ? ` (${selected.length})` : ''}
              </Button>
            </div>
          </section>
          )}
        </>
      )}
      {v2 && cancellable && stage && (
        <CancelDialog
          open={cancelOpen}
          onOpenChange={setCancelOpen}
          quotationId={source.id}
          agentsNotified={agentsNotified(stage)}
          onCancelled={(justification) => {
            updateQuotationReview(source.id, (entry) =>
              cancelByClient(entry, justification, new Date().toISOString()),
            );
            setEditingInReview(false);
            setNotice('');
            setError('');
            refresh();
          }}
        />
      )}
      <Dialog open={review} onOpenChange={setReview}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing
                ? 'Revisar envio da solicitação'
                : 'Convidar outros agentes'}
            </DialogTitle>
            <DialogDescription>
              Confira os destinatários. Este envio é simulado e preserva as
              respostas já recebidas.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm">
            {source.reference} · {q.product}
            <br />
            {q.origin} → {q.destination}
          </p>
          {editing ? (
            <fieldset className="space-y-3">
              <legend className="mb-3 text-sm">Selecione os agentes</legend>
              {catalog.isLoading ? (
                <p>Consultando agentes…</p>
              ) : catalog.isError ? (
                <p>Catálogo indisponível. Volte e tente novamente.</p>
              ) : (
                available.map((agent) => (
                  <label key={agent.id} className="flex gap-3 text-sm">
                    <input
                      type="checkbox"
                      checked={selected.includes(agent.id)}
                      onChange={(e) =>
                        setSelected(
                          e.target.checked
                            ? [...selected, agent.id]
                            : selected.filter((id) => id !== agent.id),
                        )
                      }
                    />
                    {agent.name}
                  </label>
                ))
              )}
            </fieldset>
          ) : (
            <ul className="space-y-2 text-sm">
              {selected.map((id) => (
                <li key={id}>{names(id)}</li>
              ))}
            </ul>
          )}
          {error && <p role="alert">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReview(false)}>
              Voltar
            </Button>
            <Button
              disabled={
                !selected.length || catalog.isError || catalog.isLoading
              }
              onClick={send}
            >
              Confirmar envio · simulação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!viewed}
        onOpenChange={(open) => {
          if (!open) setViewed(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Proposta recebida</DialogTitle>
            <DialogDescription>
              Consulta da resposta disponível. A escolha será feita na etapa de
              comparação.
            </DialogDescription>
          </DialogHeader>
          {viewed && (
            <div className="space-y-3 text-sm">
              <p>{viewed.agent?.name || 'Agente não informado'}</p>
              <p>Transportador: {viewed.carrier || 'não informado'}</p>
              <p>
                Trânsito:{' '}
                {viewed.transit_time
                  ? viewed.transit_time + ' dias'
                  : 'não informado'}
              </p>
              <p>
                Rota:{' '}
                {[viewed.proposal_origin, viewed.proposal_destination]
                  .filter(Boolean)
                  .join(' → ') || 'não informada'}
              </p>
              <p>
                {Number.isFinite(viewed.total_brl) && viewed.total_brl > 0
                  ? formatBRL(viewed.total_brl)
                  : 'Total não informado'}
              </p>
              <p>
                Validade:{' '}
                {viewed.validity
                  ? formatDate(viewed.validity)
                  : 'não informada'}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
