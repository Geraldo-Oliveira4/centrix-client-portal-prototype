'use client';

import { useEffect, useState } from 'react';
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
  const editing = source.state === 'AGUARDANDO_DADOS' && !saved.waiting;
  const proposals = source.proposals || [];
  const invited = mergeInvitations(
    catalog.rfqDispatched ? catalog.selectedAgentIds : [],
    mergeInvitations(
      proposals.map((p) => p.agent_id),
      saved.invited,
    ),
  );
  const available = catalog.agents.filter((a) => !invited.includes(a.id));
  const names = (id: string) =>
    catalog.agents.find((a) => a.id === id)?.name ||
    proposals.find((p) => p.agent_id === id)?.agent?.name ||
    'Agente não identificado';
  const apply = (patch: Partial<Quote>) => ({
    ...saved,
    quote: { ...saved.quote, ...patch },
  });
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
    <div className="mx-auto max-w-6xl space-y-6">
      <Link
        className="portal-small underline underline-offset-4"
        href="/portal/cotacoes"
      >
        Voltar às cotações
      </Link>
      <header>
        <h1 className="text-2xl font-semibold">
          {editing ? 'Preencher solicitação' : 'Aguardando agentes'}
        </h1>
        <p className="portal-body mt-2 text-portal-neutral">
          {source.reference} · {q.product || 'Mercadoria a informar'}
        </p>
      </header>
      <p className="portal-small text-portal-neutral">
        Prévia · alterações e convites salvos neste navegador. Nenhum envio real
        é realizado.
      </p>
      <PreparationSteps waiting={!editing} />
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
        <section className={s.panel + ' ' + s.formPanel}>
          <div className={s.sectionHeading}>
            <div>
              <h2>Rascunho da solicitação</h2>
              <p>
                Continue o formulário de onde parou. Revise os dados antes de
                selecionar os agentes.
              </p>
            </div>
          </div>
          <DraftRequestForm
            quotation={q}
            onSave={(patch) => {
              if (write(apply(patch)))
                setNotice('Rascunho salvo neste navegador.');
            }}
            onReview={(patch) => {
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
        </section>
      ) : (
        <>
          <section className="border-b pb-4 portal-body">
            <p>
              {q.origin} → {q.destination}
            </p>
            <p className="mt-2 text-portal-neutral">
              Necessidade de chegada:{' '}
              {q.needDate ? formatDate(q.needDate) : 'não informada'} · PO:{' '}
              {q.po || 'não informado'}
            </p>
          </section>
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
            onRefresh={() => { void catalog.mutate(); refresh(); }}
            onView={(id) =>
              setViewed(proposals.find((p) => p.agent_id === id) || null)
            }
          />
          <section className={s.panel}>
            <div className={s.sectionHeading}>
              <div>
                <h2>Convidar outros agentes</h2>
                <p>
                  Os agentes já convidados permanecem acima. Selecione outros
                  para ampliar a cotação.
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
                  <label className="flex gap-3 portal-body" key={agent.id}>
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
        </>
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
