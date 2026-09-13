'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Clock3,
  Info,
  Ship,
  Sparkles,
} from 'lucide-react';
import { LoaderComponent, ErrorComponent } from '@arboria-tech/arboria-ui';
import {
  useMyQuotation,
  useMyRecommendation,
  useQuotationAgents,
} from '@/hooks/use-portal-quotations';
import {
  buildNeedsInfoMailto,
  canAssembleRfq,
  canCancel,
  canDecide,
  isApproved,
  isAwaitingInfo,
  isCancelled,
  isDeclined,
  isPendingAnalystReview,
} from '@/lib/portal-state';
import {
  formatBRL,
  formatCurrency,
  formatDate,
  formatRoute,
  formatTotals,
} from '@/lib/portal-formatters';
import type { PortalProposal, PortalQuotation } from '@/types/portal';
import { MODAL_LABELS, PROPOSAL_ROUTE_TYPE_LABELS } from '@/types/quotation';
import portal_api from '@/lib/portal-api';
import type { SIApi } from '@/hooks/use-shipment-instruction';
import { ShipmentInstructionSection } from '@/components/shipment-instruction-section';
import { useSidebar } from '../../components/sidebar-context';
import {
  EvidenceBody,
  evidenceFootnote,
  useEvidence,
} from '../../inteligencia/components/evidence-block';
import { ApproveDialog } from './components/approve-dialog';
import { CancelDialog } from './components/cancel-dialog';
import { DeclineDialog } from './components/decline-dialog';
import { DocumentsSection } from './components/documents-section';
import { HistoryTimeline } from './components/history-timeline';
import { RecommendationPanel } from './components/recommendation-panel';
import { RfqDispatchCard } from './components/rfq-dispatch-card';
import { QuotationFooterCard } from './components/quotation-footer-card';
import { AuditPreviewSection } from './components/audit-preview-section';
import { RiskBlock } from '../../inteligencia/components/risk-block';
import {
  GuardRailBlockBanner,
  PendingAnalystReviewBanner,
  SelectionApprovedBanner,
  FinalizedCancelledBanner,
  FinalizedDeclinedBanner,
} from './components/quotation-banners';
import {
  proposalIssue,
  illustrativeAgentHistory,
  illustrativeMarketReference,
} from '../lib/detail-model';
import s from '../../cotacoes/previa/quotation-preview.module.css';
import {
  ResponseOffers,
  PreparationSteps,
  RequestSummary,
  WaitingResponses,
} from '../components/quotation-preparation';

const PORTAL_SI_API: SIApi = {
  api: portal_api,
  basePath: '/portal/quotations',
};

export default function PortalCotacaoDetailPage() {
  const params = useParams<{ id: string }>();
  const { quotation, isLoading, isError, mutate } = useMyQuotation(
    params?.id ?? null,
  );
  if (isLoading) return <LoaderComponent />;
  if (isError || !quotation) return <ErrorComponent />;
  return (
    <QuotationDetail
      key={quotation.id}
      quotation={quotation}
      refresh={() => void mutate()}
    />
  );
}

function QuotationDetail({
  quotation: q,
  refresh,
}: {
  quotation: PortalQuotation;
  refresh: () => void;
}) {
  const { collapsed } = useSidebar();
  const [selection, setSelection] = useState<string | null>(null);
  const [inspected, setInspected] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [dialog, setDialog] = useState<'approve' | 'decline' | 'cancel' | null>(
    null,
  );
  const proposals = q.proposals ?? [];
  const winner = proposals.find((p) => p.is_winner);
  const chosen = proposals.find((p) => p.id === selection);
  const { recommendation } = useMyRecommendation(
    canDecide(q.state) ? q.id : null,
  );
  const recommended = proposals.find(
    (p) =>
      (recommendation?.recommended_proposal_id
        ? p.id === recommendation.recommended_proposal_id
        : p.is_recommended) && !proposalIssue(p),
  );
  const profile =
    proposals.find((p) => p.id === inspected) ??
    winner ??
    chosen ??
    recommended ??
    proposals[0];
  const deciding = canDecide(q.state);
  const portalOrigin = q.created_via_portal !== false;
  const needsInfo = isAwaitingInfo(q.state);
  const assembling =
    portalOrigin && canAssembleRfq(q.state) && !proposals.length;
  const agents = useQuotationAgents(
    portalOrigin && (canAssembleRfq(q.state) || q.state === 'PARA_ANALISE')
      ? q.id
      : null,
  );
  const pendingReview = isPendingAnalystReview(q.state);
  const underReview = pendingReview && !!q.guard_rail_active;
  const canGenerateSI = portalOrigin && pendingReview && !underReview;
  const closed = isApproved(q.state);
  const cancelled = isCancelled(q.state);
  const declined = isDeclined(q.state);
  const waiting =
    !needsInfo &&
    !deciding &&
    !pendingReview &&
    !closed &&
    !cancelled &&
    !declined;
  const status = needsInfo
    ? 'Faltam informações'
    : deciding
      ? 'Pronta para escolher'
      : underReview
        ? 'Escolha em análise'
        : pendingReview
          ? 'Escolha liberada'
          : closed
            ? 'Cotação fechada'
            : cancelled
              ? 'Cotação cancelada'
              : declined
                ? 'Cotação recusada'
                : assembling &&
                    !agents.isLoading &&
                    !agents.isError &&
                    !agents.rfqDispatched
                  ? 'Solicitação em preparo'
                  : proposals.length
                    ? 'Respostas parciais'
                    : 'Aguardando agentes';
  const marketReference = illustrativeMarketReference(proposals);
  const select = (p: PortalProposal) => {
    if (!deciding || proposalIssue(p)) return;
    setSelection(p.id);
    setInspected(null);
  };

  return (
    <div
      className={s.workspace}
      style={
        { '--q-sidebar': collapsed ? '56px' : '240px' } as React.CSSProperties
      }
    >
      <div className={s.backRow}>
        <a className={s.textButton} href="/portal/cotacoes">
          <ArrowLeft size={16} /> Minhas cotações
        </a>
        <a className={s.textButton} href="/portal/cotacoes/previa?variacoes=1">
          Ver variações do protótipo
        </a>
      </div>
      <header className={s.heading}>
        <div>
          <h1>
            {q.reference} <span className={s.po}>{q.client_reference}</span>
          </h1>
          <p>{q.product || 'Carga não informada'}</p>
        </div>
        <span
          className={
            s.status +
            ' ' +
            (needsInfo ? s.amber : deciding || closed ? s.green : s.neutral)
          }
        >
          <Clock3 size={14} /> {status}
        </span>
      </header>
      <section className={s.context} aria-label="Necessidade da carga">
        <div className={s.route}>
          <Ship size={20} />
          <div>
            <strong>{formatRoute(q)}</strong>
            <small>
              {q.modal ? MODAL_LABELS[q.modal] : 'Modal não informado'} ·{' '}
              {q.incoterm || 'Incoterm a informar'} ·{' '}
              {formatTotals(q.totals, q.modal)}
            </small>
          </div>
        </div>
        <div>
          <small>Carga pronta em</small>
          <strong>
            {q.data_prontidao
              ? formatDate(q.data_prontidao)
              : 'Data não informada'}
          </strong>
        </div>
        <div className={s.cargoNeed}>
          <small>Sua necessidade de chegada</small>
          <strong>
            {q.data_limite_necessidade
              ? 'Até ' + formatDate(q.data_limite_necessidade)
              : 'Data não informada'}
          </strong>
          <span>
            {q.endereco_entrega_final ||
              q.porto_destino?.[0] ||
              q.aeroporto_destino?.[0] ||
              'Destino a confirmar'}
          </span>
        </div>
        <details className={s.contextNote}>
          <summary aria-label="Sobre a previsão de chegada">
            <Info size={16} />
          </summary>
          <p>
            A data necessária orienta sua escolha. Confirme com o agente a
            saída, a chegada e se o prazo cobre a entrega no endereço desejado.
          </p>
        </details>
      </section>

      {q.guard_rail_block_reason && (
        <GuardRailBlockBanner reason={q.guard_rail_block_reason} />
      )}
      {(needsInfo || waiting) && (
        <PreparationSteps
          waiting={!needsInfo && (!assembling || agents.rfqDispatched)}
        />
      )}
      {needsInfo && (
        <RequestSummary
          rows={[
            { label: 'Fornecedor', value: q.exporter_name },
            { label: 'Pedido / PO', value: q.client_reference },
            { label: 'Mercadoria', value: q.product },
            { label: 'Local de coleta', value: q.origin },
            {
              label: 'Peso bruto',
              value: q.totals?.weight_kg ? q.totals.weight_kg + ' kg' : null,
            },
            {
              label: 'Volume',
              value: q.totals?.volume_m3 ? q.totals.volume_m3 + ' m³' : null,
            },
          ]}
        >
          <div className={s.waitFooter}>
            <p>
              Os dados registrados estão preservados. Campos não informados
              precisam ser conferidos antes do envio.
            </p>
            <a
              className={s.textButton}
              href={buildNeedsInfoMailto(q.reference)}
            >
              Complementar por e-mail <ArrowRight size={14} />
            </a>
          </div>
        </RequestSummary>
      )}
      {assembling &&
        (agents.isLoading ? (
          <LoaderComponent />
        ) : agents.isError ? (
          <section className={s.panel + ' ' + s.formPanel}>
            <p>Não foi possível consultar o envio aos agentes.</p>
            <button
              className={s.secondary}
              onClick={() => void agents.mutate()}
            >
              Tentar novamente
            </button>
          </section>
        ) : (
          <RfqDispatchCard
            quotationId={q.id}
            desiredDeadline={q.desired_deadline}
            originMissing={!q.origin && q.incoterm !== 'FOB'}
            onDispatched={refresh}
          />
        ))}
      {waiting && (!assembling || agents.rfqDispatched) && (
        <WaitingResponses
          count={proposals.length}
          deadline={q.desired_deadline ? formatDate(q.desired_deadline) : null}
          loading={agents.isLoading}
          unavailable={agents.isError}
          rows={Array.from(
            new Set([
              ...agents.selectedAgentIds,
              ...proposals.map((p) => p.agent_id),
            ]),
          ).map((id) => ({
            id,
            name:
              agents.agents.find((a) => a.id === id)?.name ||
              proposals.find((p) => p.agent_id === id)?.agent?.name ||
              'Agente convidado',
            received: proposals.some((p) => p.agent_id === id),
          }))}
          onRefresh={() => {
            refresh();
            void agents.mutate();
          }}
        />
      )}
      {underReview && <PendingAnalystReviewBanner proposal={winner} />}
      {pendingReview && !underReview && (
        <SelectionApprovedBanner proposal={winner} />
      )}
      {closed && (
        <section className={s.outcome}>
          <div>
            <h2>
              {winner
                ? 'Contratação confirmada com ' +
                  (winner.agent?.name || 'agente selecionado')
                : 'Cotação fechada'}
            </h2>
            <p>
              {winner
                ? formatBRL(winner.total_brl)
                : 'Consulte as condições registradas abaixo.'}
            </p>
            <a className={s.textButton} href="/portal/embarques">
              Acompanhar meus embarques <ArrowRight size={16} />
            </a>
          </div>
        </section>
      )}
      {cancelled && <FinalizedCancelledBanner />}
      {declined && (
        <FinalizedDeclinedBanner
          reason={q.decline_reason}
          note={q.decline_note}
        />
      )}

      {proposals.length > 0 && (
        <ResponseOffers waiting={waiting} count={proposals.length}>
          <section className={s.panel}>
            <div className={s.sectionHeading}>
              <div>
                <h2>
                  {deciding
                    ? 'Compare e escolha sua proposta'
                    : 'Propostas recebidas'}
                </h2>
                <p>
                  {deciding
                    ? 'Veja o valor, o prazo e o que muda entre as ofertas.'
                    : 'Condições disponíveis para consulta.'}
                </p>
              </div>
              <span className={s.muted}>{proposals.length} ofertas</span>
            </div>
            <div className={s.tableWrap}>
              <table className={s.offersTable}>
                <thead>
                  <tr>
                    <th>
                      <span className={s.srOnly}>Selecionar</span>
                    </th>
                    <th>Agente / armador</th>
                    <th>Valor informado</th>
                    <th>
                      Prazo e chegada
                      {q.data_limite_necessidade && (
                        <small className={s.needReference}>
                          Necessária até {formatDate(q.data_limite_necessidade)}
                        </small>
                      )}
                    </th>
                    <th>Condições</th>
                    <th>Validade</th>
                    <th>
                      <span className={s.srOnly}>Detalhes</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {proposals.map((p) => {
                    const issue = proposalIssue(p);
                    const selected = (winner?.id ?? chosen?.id) === p.id;
                    const difference =
                      marketReference && p.total_brl > 0
                        ? Math.round((1 - p.total_brl / marketReference) * 100)
                        : null;
                    return (
                      <React.Fragment key={p.id}>
                        <tr
                          className={
                            (selected ? s.selectedRow : '') +
                            ' ' +
                            (deciding && !issue ? s.selectableRow : '')
                          }
                          onClick={(event) => {
                            if (
                              !(event.target as HTMLElement).closest(
                                'button, input, a, summary',
                              )
                            )
                              select(p);
                          }}
                        >
                          <td data-label="Selecionar">
                            <input
                              type="radio"
                              name="proposal"
                              aria-label={
                                'Selecionar oferta de ' +
                                (p.agent?.name || 'agente')
                              }
                              checked={selected}
                              disabled={!deciding || !!issue}
                              onClick={() => setInspected(null)}
                              onChange={() => select(p)}
                            />
                          </td>
                          <td data-label="Agente / armador">
                            <strong className={s.agentName}>
                              {p.agent?.name || 'Agente não informado'}
                            </strong>
                            <small>
                              {p.carrier || 'Armador não informado'}
                            </small>
                            {p.is_winner ? (
                              <span className={s.recommendedTag}>
                                Escolhida
                              </span>
                            ) : recommended?.id === p.id ? (
                              <span className={s.recommendedTag}>
                                <Sparkles size={11} /> Recomendada
                              </span>
                            ) : null}
                          </td>
                          <td data-label="Valor informado">
                            <strong className={s.price}>
                              {formatBRL(p.total_brl)}
                            </strong>
                            {difference !== null && (
                              <small className={s.marketComparison}>
                                {difference === 0
                                  ? 'Próximo da referência de mercado'
                                  : `${Math.abs(difference)}% ${difference > 0 ? 'abaixo' : 'acima'} do mercado`}
                              </small>
                            )}
                            <small>Confira a composição e as exclusões</small>
                          </td>
                          <td data-label="Prazo e chegada">
                            <strong>
                              {p.transit_time == null
                                ? 'Trânsito não informado'
                                : p.transit_time + ' dias de trânsito'}
                            </strong>
                            <small>Data de chegada a confirmar</small>
                          </td>
                          <td data-label="Condições">
                            <strong>
                              {p.route_type
                                ? PROPOSAL_ROUTE_TYPE_LABELS[p.route_type]
                                : 'Rota a confirmar'}
                            </strong>
                            <small>
                              {p.insurance_included
                                ? 'Seguro incluído'
                                : 'Seguro não incluído'}
                            </small>
                            <small>
                              {p.prazo_pagamento_dias == null
                                ? 'Pagamento a confirmar'
                                : 'Pagamento em ' +
                                  p.prazo_pagamento_dias +
                                  ' dias'}
                            </small>
                          </td>
                          <td data-label="Validade">
                            <strong>{formatDate(p.validity)}</strong>
                            {issue && (
                              <small className={s.warningText}>{issue}</small>
                            )}
                          </td>
                          <td>
                            <button
                              className={s.detailButton}
                              aria-label={
                                'Detalhes de ' + (p.agent?.name || 'agente')
                              }
                              aria-expanded={expanded === p.id}
                              onClick={() =>
                                setExpanded(expanded === p.id ? null : p.id)
                              }
                            >
                              {expanded === p.id ? (
                                <ChevronDown size={18} />
                              ) : (
                                <ChevronRight size={18} />
                              )}
                              <span className={s.mobileOnly}>Ver detalhes</span>
                            </button>
                          </td>
                        </tr>
                        {expanded === p.id && (
                          <tr className={s.expansionRow}>
                            <td colSpan={7}>
                              <ProposalDetails
                                proposal={p}
                                marketReference={marketReference}
                              />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className={s.tableNote}>
              <Info size={14} />
              <span>
                O prazo de trânsito não confirma uma data de chegada. Confira
                saída, taxas, free time e entrega final antes de escolher.
              </span>
            </div>
          </section>
        </ResponseOffers>
      )}

      {deciding && (
        <section className={s.recommendation}>
          <Sparkles size={21} />
          <div>
            <h2>
              {recommended ? 'Recomendação Centrix' : 'Antes de recomendar'}
            </h2>
            <p>
              {recommended ? (
                <>
                  <strong>
                    {recommended.agent?.name || 'Agente recomendado'}
                  </strong>{' '}
                  é a indicação entre as propostas recebidas. Confira abaixo os
                  critérios e as diferenças.
                </>
              ) : (
                'Ainda não há indicação válida para esta cotação. Confira prazo, validade e condições das propostas.'
              )}
            </p>
            <details>
              <summary>
                Entender a recomendação <ChevronDown size={13} />
              </summary>
              <RecommendationPanel quotationId={q.id} proposals={proposals} />
              <p>A indicação não confirma atendimento à sua data necessária.</p>
            </details>
          </div>
        </section>
      )}
      {profile && !cancelled && !needsInfo && !waiting && (
        <AgentProfile
          quotation={q}
          proposal={profile}
          proposals={proposals}
          chosenId={winner?.id ?? chosen?.id}
          onInspect={setInspected}
        />
      )}

      {portalOrigin && (canGenerateSI || closed) && (
        <ShipmentInstructionSection
          quotation={q}
          onSent={refresh}
          variant="portal"
          siApi={PORTAL_SI_API}
          canCreate={canGenerateSI}
        />
      )}
      <div className={s.supportGroup}>
        {closed && (
          <details className={s.support}>
            <summary>
              Conferência de frete e riscos <ChevronDown size={16} />
            </summary>
            <AuditPreviewSection quotationId={q.id} />
            <RiskBlock />
          </details>
        )}
        <details className={s.support}>
          <summary>
            Dados da solicitação <ChevronDown size={16} />
          </summary>
          <QuotationFooterCard quotation={q} />
          {q.observations && <p>{q.observations}</p>}
        </details>
        {portalOrigin && (
          <>
            <details className={s.support}>
              <summary>
                Documentos <ChevronDown size={16} />
              </summary>
              <DocumentsSection quotationId={q.id} />
            </details>
            <details className={s.support}>
              <summary>
                Histórico da cotação <ChevronDown size={16} />
              </summary>
              <HistoryTimeline quotationId={q.id} />
            </details>
          </>
        )}
      </div>
      <footer className={s.pageFooter}>
        <span>Atualizada em {formatDate(q.updated_at)}</span>
        <div className="flex flex-wrap gap-4">
          {deciding && (
            <button
              className={s.textButton}
              onClick={() => setDialog('decline')}
            >
              Não vou escolher estas propostas
            </button>
          )}
          {portalOrigin && canCancel(q.state) && (
            <button
              className={s.textButton}
              onClick={() => setDialog('cancel')}
            >
              Cancelar solicitação
            </button>
          )}
        </div>
      </footer>
      {deciding && (
        <div className={s.decisionBar}>
          <div>
            {chosen ? (
              <>
                <small>Sua escolha</small>
                <strong>
                  {chosen.agent?.name}{' '}
                  <span>· {formatBRL(chosen.total_brl)}</span>
                </strong>
                {proposalIssue(chosen) && (
                  <small>{proposalIssue(chosen)}</small>
                )}
              </>
            ) : (
              <strong>Selecione uma proposta para continuar</strong>
            )}
          </div>
          <button
            className={s.primary}
            disabled={!chosen || !!proposalIssue(chosen)}
            onClick={() => setDialog('approve')}
          >
            Continuar com esta proposta <ArrowRight size={16} />
          </button>
        </div>
      )}
      {deciding && chosen && !proposalIssue(chosen) && (
        <ApproveDialog
          open={dialog === 'approve'}
          onOpenChange={(open) => setDialog(open ? 'approve' : null)}
          quotationId={q.id}
          proposal={chosen}
        />
      )}
      {deciding && (
        <DeclineDialog
          open={dialog === 'decline'}
          onOpenChange={(open) => setDialog(open ? 'decline' : null)}
          quotationId={q.id}
        />
      )}
      {portalOrigin && canCancel(q.state) && (
        <CancelDialog
          open={dialog === 'cancel'}
          onOpenChange={(open) => setDialog(open ? 'cancel' : null)}
          quotationId={q.id}
          onCancelled={refresh}
        />
      )}
    </div>
  );
}

function ProposalDetails({
  proposal: p,
  marketReference,
}: {
  proposal: PortalProposal;
  marketReference: number | null;
}) {
  return (
    <div className={s.formPanel}>
      <h3>{p.numero_oferta || 'Condições da oferta'}</h3>
      <dl className={s.dataGrid}>
        <div>
          <dt>Frete internacional (USD)</dt>
          <dd>{formatCurrency(p.freight_value)}</dd>
        </div>
        <div>
          <dt>Total normalizado (BRL)</dt>
          <dd>{formatBRL(p.total_brl)}</dd>
        </div>
        <div>
          <dt>Saída / chegada</dt>
          <dd>Confirmar datas com o agente</dd>
        </div>
        <div>
          <dt>Free time</dt>
          <dd>Confirmar com o agente</dd>
        </div>
      </dl>
      {p.observations && <p>{p.observations}</p>}
      {p.route_detail && <p>{p.route_detail}</p>}
      {Object.keys(p.taxes_breakdown ?? {}).length > 0 && (
        <details className={s.support}>
          <summary>
            Taxas informadas <ChevronDown size={16} />
          </summary>
          <dl className={s.dataGrid}>
            {Object.entries(p.taxes_breakdown).map(([label, amount]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{amount.toLocaleString('pt-BR')}</dd>
              </div>
            ))}
          </dl>
          <p className={s.muted}>
            Confira a moeda de cada taxa na proposta original.
          </p>
        </details>
      )}
      {p.additional_costs?.length ? (
        <div>
          <h3>Custos adicionais previstos</h3>
          {p.additional_costs.map((cost, index) => (
            <p key={index}>
              <strong>{cost.label}</strong> ·{' '}
              {formatCurrency(cost.amount_min, cost.currency)} a{' '}
              {formatCurrency(cost.amount_max, cost.currency)} {cost.unit}{' '}
              {cost.note && '· ' + cost.note}
            </p>
          ))}
        </div>
      ) : null}
      <p className={s.muted}>
        {p.insurance_included
          ? 'Seguro incluído na oferta.'
          : 'Seguro não incluído na oferta.'}{' '}
        Confirme o escopo das taxas de destino e da entrega final.
      </p>
      {marketReference && (
        <details className={s.support}>
          <summary>
            Contexto de mercado <ChevronDown size={16} />
          </summary>
          <p>
            Referência desta comparação:{' '}
            <strong>{formatBRL(marketReference)}</strong>. A mesma base é usada
            para todas as ofertas.
          </p>
          <p className={s.muted}>
            Referência ilustrativa do protótipo, sem índice externo de mercado
            conectado.
          </p>
        </details>
      )}
    </div>
  );
}

function AgentProfile({
  quotation,
  proposal,
  proposals,
  chosenId,
  onInspect,
}: {
  quotation: PortalQuotation;
  proposal: PortalProposal;
  proposals: PortalProposal[];
  chosenId?: string;
  onInspect: (id: string) => void;
}) {
  const history = illustrativeAgentHistory(proposal.agent_id);
  const evidence = useEvidence({ ...quotation, proposals: [proposal] });
  return (
    <section className={s.agentProfile} aria-labelledby="agent-profile-title">
      <div className={s.profileHeader}>
        <div>
          <h2 id="agent-profile-title">Raio X do agente de cargas</h2>
          <p className={s.muted}>Histórico para ajudar na sua escolha</p>
        </div>
        <label className={s.agentPicker}>
          <span>Consultar agente</span>
          <select
            value={proposal.id}
            onChange={(event) => onInspect(event.target.value)}
          >
            {proposals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.agent?.name || 'Agente não informado'}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className={s.profileContext} aria-live="polite">
        <strong>{proposal.agent?.name || 'Agente não informado'}</strong>
        <span>
          {proposal.id === chosenId
            ? 'Agente da sua escolha'
            : 'Consultando histórico · sua escolha permanece igual'}
        </span>
      </p>
      <dl className={s.profileMetrics}>
        <div>
          <dt>Cumprimento de prazo</dt>
          <dd>
            <strong>
              {history.onTime} de {history.completed}
            </strong>
            <span>chegadas no prazo</span>
          </dd>
          <p>{history.completed - history.onTime} chegadas após o previsto.</p>
        </div>
        <div>
          <dt>Cotado × cobrado</dt>
          <dd>
            <strong>
              {history.discrepancies === 0 ? 'Nenhuma' : history.discrepancies}
            </strong>
            <span>divergências confirmadas</span>
          </dd>
          <p>{history.audited} fretes conferidos nesta amostra.</p>
        </div>
        <div>
          <dt>Experiência na rota</dt>
          <dd>
            <strong>{history.completed}</strong>
            <span>embarques concluídos</span>
          </dd>
          <p>{formatRoute(quotation)}</p>
        </div>
      </dl>
      <p className={s.profileReading}>
        Use o histórico junto ao prazo e às condições da proposta. A
        pontualidade observada não garante a próxima chegada.
      </p>
      <details key={proposal.id} className={s.support}>
        <summary>
          Ver histórico e critérios <ChevronDown size={16} />
        </summary>
        <p className={s.muted}>
          Indicadores demonstrativos: amostra de março a agosto de 2026.
          Registros individuais de pontualidade e auditoria ainda não estão
          conectados.
        </p>
        <EvidenceBody {...evidence} />
        <p className={s.muted}>
          {evidenceFootnote(evidence.scope, evidence.modalLabel)}
        </p>
      </details>
    </section>
  );
}
