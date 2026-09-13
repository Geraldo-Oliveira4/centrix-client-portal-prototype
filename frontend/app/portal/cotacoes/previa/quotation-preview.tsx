'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  FileText,
  Info,
  RotateCcw,
  Ship,
  Sparkles,
  TriangleAlert,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { useSidebar } from '../../components/sidebar-context';
import { portalFont } from '../../portal-font';
import {
  Quote,
  Offer,
  Stage,
  STORAGE_KEY,
  scenarios,
  labels,
  createQuote,
  recommend,
  validOffer,
  decisionError,
  confirmChoice,
  scheduleRequest,
  availableAgents,
  inviteMoreAgents,
  receiveNextOffer,
  validateCargo,
  money,
  shortDate,
  dayDelta,
} from './model';
import s from './quotation-preview.module.css';
import { reviewGroups } from './review-guide';
import { DraftRequestForm } from './draft-request-form';
import {
  ResponseOffers,
  PreparationSteps,
  WaitingResponses,
} from '../../cotacao/components/quotation-preparation';

type Modal =
  | 'approve'
  | 'dispatch'
  | 'cancel'
  | 'decline'
  | 'shipment'
  | 'instruction'
  | 'invite'
  | 'offer'
  | null;
const terminal = (stage: Stage) =>
  ['closed', 'declined', 'cancelled'].includes(stage);
const scenarioExists = (id: string) => scenarios.some(([key]) => key === id);
const marketMedian = 24100;

export default function QuotationPreview({
  initialScenario,
  initialGuide = false,
}: {
  initialScenario: string;
  initialGuide?: boolean;
}) {
  const { collapsed } = useSidebar();
  const returnFocus = useRef<HTMLElement | null>(null);
  const headingFocus = useRef<HTMLHeadingElement>(null);
  const [scenario, setScenario] = useState(
    scenarioExists(initialScenario) ? initialScenario : 'comparar',
  );
  const [q, setQ] = useState<Quote>(() => createQuote(scenario));
  const [loaded, setLoaded] = useState(false);
  const [selection, setSelection] = useState<string | null>(null);
  const [inspectedAgent, setInspectedAgent] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [list, setList] = useState(initialGuide);
  const [reason, setReason] = useState('');
  const [failNext, setFailNext] = useState(false);
  const [revision, setRevision] = useState(0);
  const [sendMode, setSendMode] = useState<'now' | 'schedule'>('now');
  const [sendAt, setSendAt] = useState('2026-09-14T09:00');
  const [inviteSelection, setInviteSelection] = useState<string[]>([]);
  const [viewedOffer, setViewedOffer] = useState<string | null>(null);
  const offerPreview = q.offers.find((offer) => offer.id === viewedOffer);
  const uninvited = availableAgents.filter(
    (name) => !q.targetAgents.includes(name),
  );

  useEffect(() => {
    let next = createQuote(scenario);
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY + ':' + scenario);
      if (raw) {
        const saved = JSON.parse(raw);
        if (
          saved.id === scenario &&
          saved.stage in labels &&
          Array.isArray(saved.offers) &&
          Array.isArray(saved.events)
        )
          next = saved;
      }
    } catch {
      setNotice(
        'Não foi possível recuperar a prévia salva. O cenário inicial foi aberto.',
      );
    }
    setQ(next);
    setSendMode(next.scheduledFor ? 'schedule' : 'now');
    setSendAt(next.scheduledFor || '2026-09-14T09:00');
    setSelection(next.selected);
    setInspectedAgent(null);
    setExpanded(null);
    setModal(null);
    setError('');
    setLoaded(true);
  }, [scenario, revision]);

  useEffect(() => {
    if (!loaded || q.id !== scenario) return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY + ':' + scenario,
        JSON.stringify(q),
      );
    } catch {
      setNotice(
        'O navegador não permitiu salvar. As alterações duram enquanto esta tela estiver aberta.',
      );
    }
  }, [q, loaded, scenario]);

  const chooseScenario = (id: string) => {
    setLoaded(false);
    setScenario(id);
    setList(false);
    setNotice('');
    setReason('');
    setFailNext(false);
    const url = new URL(window.location.href);
    url.searchParams.set('cenario', id);
    url.searchParams.delete('variacoes');
    window.history.replaceState(null, '', url);
  };
  const reset = () => {
    window.localStorage.removeItem(STORAGE_KEY + ':' + scenario);
    setRevision((n) => n + 1);
    setNotice('Cenário reiniciado.');
    setFailNext(false);
  };
  const update = (patch: Partial<Quote>, event?: string) =>
    setQ((prev) => ({
      ...prev,
      ...patch,
      events: event ? ['Agora — ' + event, ...prev.events] : prev.events,
    }));
  const recommended = recommend(q);
  const chosen = q.offers.find((o) => o.id === selection);
  const winner = q.offers.find((o) => o.id === q.selected);
  const canCompare = q.stage === 'ready';
  const isForm = q.stage === 'draft' || q.stage === 'needs-info';
  const isWaiting = q.stage === 'waiting' || q.stage === 'partial';
  const cheapestComplete = q.offers
    .filter((o) => o.complete && validOffer(o))
    .sort((a, b) => a.total - b.total)[0];
  const focusOffer = chosen ?? recommended ?? q.offers[0];
  const agentProfile =
    q.offers.find((o) => o.id === inspectedAgent) ?? focusOffer;
  const selectOffer = (id: string) => {
    if (!canCompare || decisionError(q, id)) return;
    setSelection(id);
    setInspectedAgent(null);
    update({ selected: id });
    setError('');
  };
  const datesKnown = !!q.needDate;
  const openModal = (value: Modal) => {
    returnFocus.current = document.activeElement as HTMLElement;
    setError('');
    setModal(value);
  };
  const simulateFailure = () => {
    if (!failNext) return false;
    setFailNext(false);
    setError(
      'Não foi possível confirmar agora. Sua seleção foi mantida; tente novamente.',
    );
    return true;
  };
  const approve = () => {
    const issue = decisionError(q, selection);
    if (issue) {
      setError(issue);
      return;
    }
    if (simulateFailure()) return;
    setQ(confirmChoice(q, selection!));
    setError('');
    setModal(null);
    setNotice(
      'Escolha registrada nesta prévia. A Freitas é responsável pela próxima etapa.',
    );
  };
  const dispatch = () => {
    if (sendMode === 'schedule') {
      try {
        const scheduled = scheduleRequest(q, sendAt);
        if (simulateFailure()) return;
        setQ(scheduled);
        setModal(null);
        setNotice(
          'Programação salva nesta prévia. Nenhum envio automático será executado.',
        );
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : 'Não foi possível programar.',
        );
      }
      return;
    }
    if (!q.targetAgents.length) {
      setError('Selecione pelo menos um agente.');
      return;
    }
    if (!q.manualDraft && !validateCargo(q.weight, q.volume)) {
      setError('Complete peso e volume antes de enviar.');
      return;
    }
    if (simulateFailure()) return;
    update(
      {
        stage: 'waiting',
        scheduledFor: null,
        sentAt: '13/09 às 10:30',
        responseBy: q.responseBy,
        agentCount: q.targetAgents.length,
        offers: [],
      },
      'Solicitação enviada para ' +
        q.targetAgents.length +
        ' agentes (simulação local).',
    );
    setModal(null);
    setNotice(
      'Solicitação registrada na prévia. Nenhuma mensagem externa foi enviada.',
    );
  };
  const nextResponse = () => {
    const next = receiveNextOffer(q);
    setQ(next);
    setNotice(
      next === q
        ? 'Não há outra resposta preparada nesta simulação. Os demais agentes continuam pendentes.'
        : 'Nova proposta disponível para consulta. Você decide se avança ou aguarda outras respostas.',
    );
  };
  const invite = () => {
    try {
      const next = inviteMoreAgents(q, inviteSelection);
      if (simulateFailure()) return;
      setQ(next);
      setModal(null);
      setNotice(
        'Convites adicionais registrados na prévia. Nenhuma mensagem foi enviada; as propostas recebidas foram mantidas.',
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Não foi possível adicionar os agentes.',
      );
    }
  };
  const mainStatusTone =
    q.stage === 'needs-info'
      ? s.amber
      : q.stage === 'ready' || q.stage === 'closed'
        ? s.green
        : s.neutral;

  return (
    <div
      className={s.workspace}
      style={
        { '--q-sidebar': collapsed ? '56px' : '240px' } as React.CSSProperties
      }
    >
      <div className={s.previewbar}>
        <span>
          Prévia local{' '}
          <span className={s.muted}>/ dados e ações ilustrativos</span>
        </span>
        <div className={s.previewControls}>
          {!list && (
            <a className={s.textButton} href="?variacoes=1">
              Ver variações
            </a>
          )}
          <label htmlFor="preview-scenario" className={s.srOnly}>
            Cenário da prévia
          </label>
          <select
            id="preview-scenario"
            value={scenario}
            onChange={(e) => chooseScenario(e.target.value)}
          >
            {reviewGroups.map((group) => (
              <optgroup key={group.title} label={group.title}>
                {group.items.map(({ id }) => (
                  <option key={id} value={id}>
                    {scenarios.find(([key]) => key === id)?.[1]}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <button
            className={s.iconButton}
            title="Reiniciar este cenário"
            aria-label="Reiniciar este cenário"
            onClick={reset}
          >
            <RotateCcw size={14} />
          </button>
          <details className={s.simulations}>
            <summary>Simular</summary>
            <div>
              <label>
                <input
                  type="checkbox"
                  checked={failNext}
                  onChange={(e) => setFailNext(e.target.checked)}
                />{' '}
                Falha na próxima confirmação
              </label>
              {(isWaiting || canCompare) && (
                <button onClick={nextResponse}>Receber próxima proposta</button>
              )}
              {q.stage === 'review' && (
                <>
                  <button
                    onClick={() =>
                      update(
                        { stage: 'released' },
                        'Freitas liberou a escolha.',
                      )
                    }
                  >
                    Liberar escolha
                  </button>
                  <button
                    onClick={() => {
                      update(
                        {
                          stage: 'ready',
                          selected: null,
                          reason:
                            'A Freitas pediu revisar a condição de free time antes de confirmar.',
                        },
                        'Escolha devolvida para revisão.',
                      );
                      setSelection(null);
                      setInspectedAgent(null);
                    }}
                  >
                    Devolver escolha
                  </button>
                </>
              )}
              {q.stage === 'released' && (
                <button
                  onClick={() =>
                    update(
                      { stage: 'closed' },
                      'Contratação confirmada. Embarque vinculado.',
                    )
                  }
                >
                  Confirmar contratação
                </button>
              )}
              <small>
                Relógio: 13/09/2026. Os cenários ficam salvos neste navegador.
              </small>
            </div>
          </details>
        </div>
      </div>

      {list ? (
        <section className={s.listView}>
          <h1>Variações do detalhe de cotação</h1>
          <p className={s.muted}>
            Guia de revisão para produto e desenvolvimento · 14 variações
            navegáveis.
          </p>
          <div className={s.guideNote}>
            <strong>O Kanban atual da main permanece como visão geral.</strong>
            <p>
              Este guia reúne os detalhes abertos a partir de cada etapa. Dados
              e ações são demonstrativos; a lista abaixo serve à revisão do
              protótipo.
            </p>
            <p>
              Comece por Preencher detalhes e avance até a escolha. Use{' '}
              <strong>Simular</strong> para receber propostas, liberar ou
              devolver uma escolha e testar falhas. Os cenários guardam
              alterações neste navegador;{' '}
              <strong>Reiniciar este cenário</strong> recupera o estado inicial
              somente da variação aberta.
            </p>
          </div>
          {reviewGroups.map((group) => (
            <section key={group.title} className={s.guideGroup}>
              <h2>{group.title}</h2>
              <div className={s.panel}>
                {group.items.map(({ id, check }) => (
                  <a key={id} className={s.listRow} href={'?cenario=' + id}>
                    <span>
                      <strong>
                        {scenarios.find(([key]) => key === id)?.[1]}
                      </strong>
                      <small>{check}</small>
                    </span>
                    <span className={s.guideOpen}>
                      Abrir variação <ChevronRight size={16} />
                    </span>
                  </a>
                ))}
              </div>
            </section>
          ))}
        </section>
      ) : (
        <>
          <div className={s.backRow}>
            <a className={s.textButton} href="/portal/cotacoes">
              <ArrowLeft size={16} /> Minhas cotações
            </a>
            <span>{q.reference}</span>
          </div>
          <header className={s.heading}>
            <div>
              <h1 ref={headingFocus} tabIndex={-1}>
                {q.supplier || 'Fornecedor não informado'}{' '}
                <span className={s.po}>{q.po}</span>
              </h1>
              <p>{q.product}</p>
            </div>
            <span className={s.status + ' ' + mainStatusTone}>
              {q.stage === 'ready' || q.stage === 'closed' ? (
                <CheckCircle2 size={14} />
              ) : (
                <Clock3 size={14} />
              )}{' '}
              {labels[q.stage]}
            </span>
          </header>
          <section className={s.context} aria-label="Contexto da solicitação">
            <div className={s.route}>
              <Ship size={20} />
              <div>
                <strong>
                  {q.origin} <ArrowRight size={14} /> {q.destination}
                </strong>
                <small>
                  {q.modal} · {q.equipment} · {q.incoterm}
                </small>
              </div>
            </div>
            <div>
              <small>Carga pronta em</small>
              <strong>{shortDate(q.readyDate)}</strong>
            </div>
            <div className={s.cargoNeed}>
              <small>Sua necessidade de chegada</small>
              <strong>
                {q.needDate
                  ? 'Até ' + shortDate(q.needDate)
                  : 'Data não informada'}
              </strong>
              <span>
                No porto · {q.destination}
                {q.needDate ? ' · ' + q.needDate.slice(0, 4) : ''}
              </span>
            </div>
            <details className={s.contextNote}>
              <summary aria-label="Sobre a data de chegada">
                <Info size={16} />
              </summary>
              <p>
                A necessidade informada é de chegada ao porto de Santos. Entrega
                na fábrica não está incluída nesta previsão.
              </p>
            </details>
          </section>

          {notice && (
            <div className={s.notice} role="status">
              <span>{notice}</span>
              <button
                className={s.iconButton}
                aria-label="Dispensar aviso"
                onClick={() => setNotice('')}
              >
                <X size={15} />
              </button>
            </div>
          )}
          {q.reason && q.stage === 'ready' && (
            <div className={s.warning} role="status">
              <TriangleAlert size={18} />
              <div>
                <strong>Revise sua escolha</strong>
                <p>{q.reason}</p>
              </div>
            </div>
          )}

          {(isForm || isWaiting || q.stage === 'scheduled') && (
            <PreparationSteps waiting={isWaiting} />
          )}
          {q.stage === 'scheduled' && (
            <section className={s.panel}>
              <div className={s.sectionHeading}>
                <div>
                  <h2>Envio programado aos agentes</h2>
                  <p>A solicitação está preparada e ainda não foi enviada.</p>
                </div>
              </div>
              <div className={s.responseSummary}>
                <div>
                  <small>Data e horário de envio · Brasília</small>
                  <strong>
                    {shortDate(q.scheduledFor?.slice(0, 10) || null)} às{' '}
                    {q.scheduledFor?.slice(11, 16)}
                  </strong>
                </div>
                <div>
                  <small>Destinatários</small>
                  <strong>{q.targetAgents.join(', ')}</strong>
                </div>
              </div>
              <div className={s.waitFooter}>
                <p>
                  Programação demonstrativa, salva neste navegador. O envio
                  automático ainda não está conectado.
                </p>
                <div className="flex flex-wrap gap-4">
                  <button
                    className={s.textButton}
                    onClick={() => {
                      update({ stage: 'draft' });
                      setSendMode('schedule');
                      setNotice(
                        'Revise os dados e confirme a programação novamente.',
                      );
                    }}
                  >
                    Editar programação
                  </button>
                  <button
                    className={s.textButton}
                    onClick={() => {
                      update(
                        { stage: 'draft', scheduledFor: null },
                        'Programação cancelada; rascunho preservado.',
                      );
                      setSendMode('now');
                      setNotice(
                        'Programação cancelada. Seu rascunho foi mantido.',
                      );
                    }}
                  >
                    Cancelar programação
                  </button>
                </div>
              </div>
            </section>
          )}

          {isForm && loaded && (
            <section>
              <div className={s.sectionHeading}>
                <div>
                  <h2>Rascunho da solicitação</h2>
                  <p>
                    O mesmo formulário de uma nova cotação, com os dados já
                    preenchidos. Salve para continuar depois ou revise o envio.
                  </p>
                </div>
                <span className={s.subtleTag}>Ainda não enviada</span>
              </div>
              <DraftRequestForm
                key={q.id}
                quotation={q}
                onSave={(patch) => {
                  update(patch);
                  setNotice(
                    'Rascunho salvo neste navegador. A solicitação não foi enviada.',
                  );
                }}
                onReview={(patch) => {
                  update({ ...patch, stage: 'draft' });
                  openModal('dispatch');
                }}
              />
            </section>
          )}

          {(isWaiting ||
            (canCompare && q.offers.length < q.targetAgents.length)) && (
            <WaitingResponses
              comparisonAvailable
              onInvite={() => {
                setInviteSelection([]);
                openModal('invite');
              }}
              onView={(name) => {
                setViewedOffer(
                  q.offers.find((offer) => offer.agent === name)?.id || null,
                );
                openModal('offer');
              }}
              onCompare={
                isWaiting
                  ? () => {
                      update(
                        { stage: 'ready' },
                        'Revisão das propostas disponíveis iniciada sem esperar todos os agentes.',
                      );
                      setNotice(
                        'Você está revisando ' +
                          q.offers.length +
                          ' proposta(s). Os demais agentes continuam pendentes.',
                      );
                    }
                  : undefined
              }
              count={q.offers.length}
              deadline={q.responseBy}
              sentAt={q.sentAt}
              rows={q.targetAgents.map((name) => ({
                id: name,
                name,
                received: q.offers.some((offer) => offer.agent === name),
              }))}
              onRefresh={() =>
                setNotice(
                  'A prévia já mostra as respostas registradas. Use Simular para demonstrar a chegada de novas propostas.',
                )
              }
            />
          )}

          {['review', 'released', 'closed'].includes(q.stage) && winner && (
            <section className={s.outcome}>
              <div className={s.outcomeIcon}>
                {q.stage === 'closed' ? (
                  <CheckCircle2 size={23} />
                ) : (
                  <Clock3 size={23} />
                )}
              </div>
              <div className={s.outcomeBody}>
                <h2>
                  {q.stage === 'review'
                    ? 'Você escolheu ' + winner.agent
                    : q.stage === 'released'
                      ? 'Sua escolha foi liberada'
                      : 'Contratação confirmada com ' + winner.agent}
                </h2>
                <p>
                  {q.stage === 'review'
                    ? 'A Freitas está revisando as condições antes da confirmação. Você não precisa fazer nada agora.'
                    : q.stage === 'released'
                      ? 'A Freitas aprovou as condições. A próxima etapa é preparar a instrução de embarque.'
                      : 'As condições contratadas estão preservadas. Acompanhe os próximos marcos no embarque vinculado.'}
                </p>
                <div className={s.outcomeMetrics}>
                  <span>
                    <small>Valor da oferta</small>
                    <strong>{money(winner.total)}</strong>
                  </span>
                  <span>
                    <small>Chegada prevista ao porto</small>
                    <strong>{shortDate(winner.arrival)}</strong>
                  </span>
                  <span>
                    <small>Free time no destino</small>
                    <strong>{winner.freeDays} dias</strong>
                  </span>
                </div>
                {q.stage !== 'review' && (
                  <button
                    className={s.primary}
                    onClick={() =>
                      openModal(
                        q.stage === 'closed' ? 'shipment' : 'instruction',
                      )
                    }
                  >
                    {q.stage === 'closed'
                      ? 'Acompanhar embarque'
                      : 'Ver instrução de embarque'}
                    <ArrowRight size={16} />
                  </button>
                )}
              </div>
            </section>
          )}

          {(q.stage === 'declined' || q.stage === 'cancelled') && (
            <section className={s.panel + ' ' + s.formPanel}>
              <h2>{labels[q.stage]}</h2>
              <p className={s.muted}>
                {q.reason || 'Sem motivo adicional registrado.'}
              </p>
              <p>
                Encerrada em 13/09/2026. Os dados e o histórico continuam
                disponíveis abaixo.
              </p>
              <button
                className={s.secondary}
                onClick={() => chooseScenario('rascunho')}
              >
                Abrir cenário de nova solicitação
              </button>
            </section>
          )}

          {canCompare && (
            <ResponseOffers waiting={isWaiting} count={q.offers.length}>
              <section className={s.panel}>
                <div className={s.sectionHeading}>
                  <div>
                    <h2>
                      {canCompare
                        ? q.offers.length === 1
                          ? 'Revise a proposta recebida'
                          : 'Compare e escolha sua proposta'
                        : 'Proposta recebida'}
                    </h2>
                    <p>
                      {canCompare
                        ? q.offers.length === 1
                          ? 'Há uma oferta disponível. Confira as condições antes de escolher.'
                          : 'Veja o valor, a chegada e o que muda entre as ofertas.'
                        : 'Disponível para consulta. A seleção será liberada após a análise das respostas.'}
                    </p>
                  </div>
                  <span className={s.muted}>{q.offers.length} ofertas</span>
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
                          Chegada ao porto
                          {q.needDate && (
                            <small className={s.needReference}>
                              Necessária até {shortDate(q.needDate)}
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
                      {q.offers.map((o) => {
                        const rec = recommended?.id === o.id;
                        const selected = selection === o.id;
                        const marketDifference = Math.round(
                          (1 - o.total / marketMedian) * 100,
                        );
                        const selectable =
                          canCompare && !decisionError(q, o.id);
                        const late =
                          o.arrival && q.needDate
                            ? dayDelta(o.arrival, q.needDate)
                            : 0;
                        return (
                          <React.Fragment key={o.id}>
                            <tr
                              className={
                                (selected ? s.selectedRow : '') +
                                ' ' +
                                (!validOffer(o) ? s.expiredRow : '') +
                                ' ' +
                                (selectable ? s.selectableRow : '')
                              }
                              onClick={(event) => {
                                if (
                                  (event.target as HTMLElement).closest(
                                    'button, input, a, summary',
                                  )
                                )
                                  return;
                                selectOffer(o.id);
                              }}
                            >
                              <td data-label="Selecionar">
                                <input
                                  type="radio"
                                  name="proposal"
                                  aria-label={'Selecionar oferta de ' + o.agent}
                                  checked={selected}
                                  disabled={
                                    !canCompare || !!decisionError(q, o.id)
                                  }
                                  onClick={() => setInspectedAgent(null)}
                                  onChange={() => selectOffer(o.id)}
                                />
                              </td>
                              <td data-label="Agente / armador">
                                <strong className={s.agentName}>
                                  {o.agent}
                                </strong>
                                <small>{o.carrier}</small>
                                {rec ? (
                                  <span className={s.recommendedTag}>
                                    <Sparkles size={11} /> Recomendada
                                  </span>
                                ) : cheapestComplete?.id === o.id ? (
                                  <span className={s.quietTag}>
                                    Menor valor completo
                                  </span>
                                ) : null}
                              </td>
                              <td data-label="Valor informado">
                                <strong className={s.price}>
                                  {money(o.total)}
                                </strong>
                                {canCompare && o.complete && (
                                  <small className={s.marketComparison}>
                                    {marketDifference === 0
                                      ? 'Próximo da referência de mercado'
                                      : `${Math.abs(marketDifference)}% ${marketDifference > 0 ? 'abaixo' : 'acima'} do mercado`}
                                  </small>
                                )}
                                <small
                                  className={!o.complete ? s.warningText : ''}
                                >
                                  {o.complete
                                    ? 'Taxas de destino incluídas'
                                    : 'Taxas de destino a confirmar'}
                                </small>
                              </td>
                              <td data-label="Chegada ao porto">
                                <strong>{shortDate(o.arrival)}</strong>
                                <small>
                                  {o.transit === null
                                    ? 'Trânsito não informado'
                                    : o.transit + ' dias de trânsito'}
                                </small>
                                {datesKnown && o.arrival && (
                                  <span
                                    className={
                                      late > 0 ? s.warningText : s.goodText
                                    }
                                  >
                                    {late > 0
                                      ? late + ' dias após sua necessidade'
                                      : late === 0
                                        ? 'Na data necessária'
                                        : Math.abs(late) +
                                          ' dias antes da necessidade'}
                                  </span>
                                )}
                              </td>
                              <td data-label="Condições">
                                <strong>{o.route}</strong>
                                <small>
                                  {o.freeDays === null
                                    ? 'Free time não informado'
                                    : o.freeDays + ' dias de free time'}
                                </small>
                                {!o.complete && (
                                  <span className={s.warningText}>
                                    Escopo incompleto
                                  </span>
                                )}
                              </td>
                              <td data-label="Validade">
                                <strong>{shortDate(o.validity)}</strong>
                                <small
                                  className={
                                    !validOffer(o) ? s.warningText : ''
                                  }
                                >
                                  {!o.validity
                                    ? 'Confirmar com agente'
                                    : validOffer(o)
                                      ? '2026'
                                      : 'Vencida'}
                                </small>
                              </td>
                              <td>
                                <button
                                  className={s.detailButton}
                                  aria-label={'Detalhes de ' + o.agent}
                                  aria-expanded={expanded === o.id}
                                  onClick={() =>
                                    setExpanded(expanded === o.id ? null : o.id)
                                  }
                                >
                                  {expanded === o.id ? (
                                    <ChevronDown size={18} />
                                  ) : (
                                    <ChevronRight size={18} />
                                  )}
                                  <span className={s.mobileOnly}>
                                    Ver detalhes
                                  </span>
                                </button>
                              </td>
                            </tr>
                            {expanded === o.id && (
                              <tr className={s.expansionRow}>
                                <td colSpan={7}>
                                  <OfferDetails offer={o} />
                                  {decisionError(q, o.id) && canCompare && (
                                    <div className={s.detailIssue}>
                                      <p>{decisionError(q, o.id)}</p>
                                      <button
                                        className={s.secondary}
                                        disabled={q.events.some((e) =>
                                          e.includes(
                                            'Revisão da oferta ' + o.service,
                                          ),
                                        )}
                                        onClick={() => {
                                          update(
                                            {},
                                            'Revisão da oferta ' +
                                              o.service +
                                              ' solicitada (simulação).',
                                          );
                                          setNotice(
                                            'Pedido registrado localmente para revisão de ' +
                                              o.service +
                                              '.',
                                          );
                                        }}
                                      >
                                        {q.events.some((e) =>
                                          e.includes(
                                            'Revisão da oferta ' + o.service,
                                          ),
                                        )
                                          ? 'Revisão solicitada'
                                          : 'Solicitar revisão da oferta'}
                                      </button>
                                    </div>
                                  )}
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
                    Valores em BRL. Entrega na fábrica e seguro da carga não
                    estão incluídos.{' '}
                    <strong>Chegada é uma previsão ao porto.</strong>
                  </span>
                </div>
              </section>
            </ResponseOffers>
          )}

          {canCompare && (
            <section className={s.recommendation}>
              <Sparkles size={21} />
              <div>
                <h2>
                  {recommended ? 'Recomendação Centrix' : 'Antes de recomendar'}
                </h2>
                <p>
                  {recommended ? (
                    <>
                      <strong>{recommended.agent}</strong> tem o menor valor
                      completo entre as ofertas válidas que atendem à chegada
                      necessária em <strong>{shortDate(q.needDate)}</strong>.
                    </>
                  ) : q.offers.length === 1 ? (
                    'Há apenas uma oferta recebida. Você pode revisar suas condições, mas ainda não há alternativas para comparar.'
                  ) : !q.needDate ? (
                    'Informe sua necessidade de chegada e confirme a validade das ofertas para receber uma recomendação fundamentada.'
                  ) : (
                    'Nenhuma oferta válida e completa atende à necessidade informada. Confirme as condições com os agentes antes de escolher.'
                  )}
                </p>
                {recommended &&
                  cheapestComplete &&
                  recommended.id !== cheapestComplete.id && (
                    <p className={s.tradeoff}>
                      {money(recommended.total - cheapestComplete.total)} a mais
                      que {cheapestComplete.agent}.{' '}
                      {recommended.transit !== null &&
                        cheapestComplete.transit !== null && (
                          <>
                            {cheapestComplete.transit - recommended.transit}{' '}
                            dias a menos de trânsito.
                          </>
                        )}{' '}
                      {recommended.freeDays && cheapestComplete.freeDays && (
                        <>
                          {recommended.freeDays - cheapestComplete.freeDays}{' '}
                          dias adicionais de free time.
                        </>
                      )}
                    </p>
                  )}
                <details>
                  <summary>
                    Entender a recomendação <ChevronDown size={13} />
                  </summary>
                  <p>
                    Critério desta solicitação: chegar ao porto até{' '}
                    {shortDate(q.needDate)}, com escopo completo e menor valor
                    entre as ofertas elegíveis. Chegadas informadas nas ofertas,
                    com saída prevista em 21/09; nenhuma data foi calculada a
                    partir de hoje. Confirme espaço e saída antes da
                    contratação.
                  </p>
                  <p>
                    Ofertas vencidas, sem validade ou com taxas de destino
                    pendentes não são recomendadas. A escolha continua sendo
                    sua. Cálculo demonstrativo, sem modelo de IA conectado.
                  </p>
                </details>
              </div>
            </section>
          )}

          {canCompare && focusOffer && (
            <div className={s.insights}>
              <section
                className={s.agentProfile}
                aria-labelledby="agent-profile-title"
              >
                <div className={s.profileHeader}>
                  <div>
                    <h2 id="agent-profile-title">Raio X do agente de cargas</h2>
                    <p className={s.muted}>
                      Histórico para ajudar na sua escolha
                    </p>
                  </div>
                  <label className={s.agentPicker}>
                    <span>Consultar agente</span>
                    <select
                      value={agentProfile.id}
                      onChange={(event) =>
                        setInspectedAgent(event.target.value)
                      }
                    >
                      {q.offers.map((offer) => (
                        <option key={offer.id} value={offer.id}>
                          {offer.agent}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <p className={s.profileContext} aria-live="polite">
                  <strong>{agentProfile.agent}</strong>
                  <span>
                    {agentProfile.id === chosen?.id
                      ? 'Agente da sua escolha'
                      : agentProfile.id === recommended?.id
                        ? 'Agente da proposta recomendada'
                        : 'Consultando histórico · sua escolha permanece igual'}
                  </span>
                </p>
                <dl className={s.profileMetrics}>
                  <div>
                    <dt>Cumprimento de prazo</dt>
                    <dd>
                      {agentProfile.completed > 0 ? (
                        <>
                          <strong>
                            {agentProfile.onTime} de {agentProfile.completed}
                          </strong>
                          <span>chegadas no prazo</span>
                        </>
                      ) : (
                        <strong>Sem histórico</strong>
                      )}
                    </dd>
                    <p>
                      {agentProfile.completed > 0
                        ? `Após o previsto no porto: ${agentProfile.completed - agentProfile.onTime} de ${agentProfile.completed}.`
                        : 'Ainda não há chegadas para avaliar.'}
                    </p>
                  </div>
                  <div>
                    <dt>Cotado × cobrado</dt>
                    <dd>
                      {agentProfile.audited > 0 ? (
                        <>
                          <strong>
                            {agentProfile.discrepancies === 0
                              ? 'Nenhuma'
                              : agentProfile.discrepancies}
                          </strong>
                          <span>
                            {agentProfile.discrepancies > 1
                              ? 'divergências confirmadas'
                              : 'divergência confirmada'}
                          </span>
                        </>
                      ) : (
                        <strong>Sem auditorias</strong>
                      )}
                    </dd>
                    <p>
                      {agentProfile.audited > 0
                        ? `${agentProfile.audited} fretes conferidos nesta amostra.`
                        : 'Ainda não há cobranças conferidas.'}
                    </p>
                  </div>
                  <div>
                    <dt>Experiência nesta rota</dt>
                    <dd>
                      <strong>
                        {agentProfile.completed > 0
                          ? agentProfile.completed
                          : 'Sem histórico'}
                      </strong>
                      {agentProfile.completed > 0 && (
                        <span>embarques concluídos</span>
                      )}
                    </dd>
                    <p>
                      {q.origin} → {q.destination} · {q.modal} · {q.equipment}
                    </p>
                  </div>
                </dl>
                <p className={s.profileReading}>
                  {agentProfile.completed > 0
                    ? 'Use esse histórico junto ao prazo e às condições da proposta. A pontualidade observada não garante a próxima chegada.'
                    : 'Ainda não há histórico suficiente para avaliar este agente. Confirme as condições da proposta antes de escolher.'}
                </p>
                <p className={s.muted}>
                  Março a agosto de 2026 · amostra demonstrativa nesta rota
                </p>
                <details key={agentProfile.id}>
                  <summary>
                    Ver histórico e evidências <ChevronDown size={13} />
                  </summary>
                  <div className={s.evidence}>
                    <table>
                      <thead>
                        <tr>
                          <th scope="col">O que foi observado</th>
                          <th scope="col">Base de comparação</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>
                            {agentProfile.onTime} de {agentProfile.completed}{' '}
                            chegadas no prazo
                          </td>
                          <td>
                            Data prevista × realizada no porto, em embarques
                            concluídos.
                          </td>
                        </tr>
                        <tr>
                          <td>
                            {agentProfile.discrepancies}{' '}
                            {agentProfile.discrepancies === 1
                              ? 'divergência'
                              : 'divergências'}{' '}
                            em {agentProfile.audited} auditorias
                          </td>
                          <td>
                            Condições cotadas × cobrança, considerando apenas
                            divergências confirmadas.
                          </td>
                        </tr>
                        <tr>
                          <td>
                            {agentProfile.completed} operações semelhantes
                          </td>
                          <td>
                            Mesmo agente, rota e modal, no período informado.
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    <p>
                      Atrasos podem envolver armador, porto ou outros fatores. A
                      amostra não atribui responsabilidade ao agente;
                      contestações em aberto não contam como divergência
                      confirmada.
                    </p>
                    <small>
                      Dados fictícios para revisão da experiência. Registros
                      individuais e documentos de origem ainda não estão
                      conectados. Duração e causas dos atrasos, atendimento e
                      resolução não estão disponíveis nesta base.
                    </small>
                  </div>
                </details>
              </section>
            </div>
          )}

          {['review', 'released', 'closed'].includes(q.stage) && winner && (
            <details className={s.support}>
              <summary>
                Condição {q.stage === 'closed' ? 'contratada' : 'selecionada'}{' '}
                <ChevronDown size={16} />
              </summary>
              <OfferDetails offer={winner} />
            </details>
          )}

          <div className={s.supportGroup}>
            <details className={s.support}>
              <summary>
                Dados da solicitação <ChevronDown size={16} />
              </summary>
              <dl className={s.dataGrid}>
                <div>
                  <dt>Fornecedor</dt>
                  <dd>{q.supplier || 'Não informado'}</dd>
                </div>
                <div>
                  <dt>PO</dt>
                  <dd>{q.po}</dd>
                </div>
                <div>
                  <dt>Carga</dt>
                  <dd>{q.product}</dd>
                </div>
                <div>
                  <dt>Peso bruto</dt>
                  <dd>{q.weight ? q.weight + ' kg' : 'A completar'}</dd>
                </div>
                <div>
                  <dt>Volume</dt>
                  <dd>{q.volume ? q.volume + ' m³' : 'A completar'}</dd>
                </div>
                <div>
                  <dt>Prontidão</dt>
                  <dd>{shortDate(q.readyDate)}</dd>
                </div>
                <div>
                  <dt>Equipamento</dt>
                  <dd>{q.equipment}</dd>
                </div>
                <div>
                  <dt>Incoterm</dt>
                  <dd>{q.incoterm}</dd>
                </div>
              </dl>
            </details>
            <details className={s.support}>
              <summary>
                Documentos <span className={s.count}>2</span>
                <ChevronDown size={16} />
              </summary>
              <div className={s.documentRow}>
                <FileText size={19} />
                <div>
                  <strong>Commercial invoice</strong>
                  <small>INV-2026-0842 · Hanwha Industrial</small>
                </div>
                <span>Documento demonstrativo</span>
              </div>
              <div className={s.documentRow}>
                <FileText size={19} />
                <div>
                  <strong>Packing list</strong>
                  <small>PL-2026-0842 · 48 volumes</small>
                </div>
                <span>Documento demonstrativo</span>
              </div>
              <p className={s.muted}>
                Referências para leitura da experiência; arquivos originais não
                estão anexados nesta prévia.
              </p>
            </details>
            <details className={s.support}>
              <summary>
                Histórico da cotação{' '}
                <span className={s.count}>{q.events.length}</span>
                <ChevronDown size={16} />
              </summary>
              <ol className={s.history}>
                {q.events.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ol>
            </details>
          </div>
          <footer className={s.pageFooter}>
            <span>Atualização da base demonstrativa: 13/09, 09:40</span>
            {!terminal(q.stage) && (
              <button
                className={s.textButton}
                onClick={() => openModal(canCompare ? 'decline' : 'cancel')}
              >
                {canCompare
                  ? 'Não vou escolher estas propostas'
                  : 'Cancelar solicitação'}
              </button>
            )}
          </footer>

          {canCompare && (
            <div className={s.decisionBar}>
              {chosen ? (
                <div>
                  <span className={s.decisionLabel}>Sua escolha</span>
                  <strong>
                    {chosen.agent} <span>{money(chosen.total)}</span>
                  </strong>
                  <small>
                    {chosen.arrival && q.needDate && chosen.arrival > q.needDate
                      ? 'Atenção: chegada após sua necessidade.'
                      : 'Confira as condições antes de confirmar.'}
                  </small>
                </div>
              ) : (
                <div>
                  <strong>Qual proposta faz mais sentido para você?</strong>
                  <small>Selecione uma oferta na tabela para continuar.</small>
                </div>
              )}
              <button
                className={s.primary}
                disabled={!chosen || !!decisionError(q, chosen.id)}
                onClick={() => openModal('approve')}
              >
                Revisar escolha
                <ArrowRight size={16} />
              </button>
            </div>
          )}
        </>
      )}

      <Dialog
        open={modal !== null}
        onOpenChange={(open) => {
          if (!open) {
            setModal(null);
            setError('');
          }
        }}
      >
        <DialogContent
          className={[s.modal, portalFont.variable].join(' ')}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (returnFocus.current?.isConnected) returnFocus.current.focus();
            else headingFocus.current?.focus();
          }}
        >
          <DialogTitle>
            {modal === 'invite'
              ? 'Convidar mais agentes'
              : modal === 'offer'
                ? 'Proposta de ' + (offerPreview?.agent || 'agente')
                : modal === 'approve'
                  ? 'Revise sua escolha'
                  : modal === 'dispatch'
                    ? 'Revise a solicitação aos agentes'
                    : modal === 'cancel'
                      ? 'Cancelar esta solicitação?'
                      : modal === 'decline'
                        ? 'Encerrar sem escolher uma proposta'
                        : modal === 'shipment'
                          ? 'Embarque vinculado'
                          : 'Instrução de embarque'}
          </DialogTitle>
          <DialogDescription>
            {modal === 'invite'
              ? 'Escolha agentes disponíveis que ainda não receberam esta solicitação. Os convites existentes não serão reenviados.'
              : modal === 'offer'
                ? 'Pré-visualização da oferta recebida. Consultar não seleciona nem contrata.'
                : modal === 'approve'
                  ? 'Ao confirmar, a oferta seguirá para análise da Freitas. A contratação ainda não estará concluída.'
                  : modal === 'dispatch'
                    ? 'Confira a carga e os agentes que receberão a solicitação.'
                    : modal === 'shipment'
                      ? 'Continuidade demonstrativa da cotação até o acompanhamento.'
                      : modal === 'instruction'
                        ? 'Dados da condição liberada para preparação do embarque.'
                        : 'O histórico será preservado. Esta ação é apenas local à prévia.'}
          </DialogDescription>
          {modal === 'invite' && (
            <>
              <dl className={s.dataGrid}>
                <div>
                  <dt>Solicitação</dt>
                  <dd>
                    {q.reference} · {q.product}
                  </dd>
                </div>
                <div>
                  <dt>Já convidados</dt>
                  <dd>{q.targetAgents.join(', ')}</dd>
                </div>
              </dl>
              <fieldset className={s.agentChoices}>
                <legend>Disponíveis para convidar</legend>
                {uninvited.map((name) => (
                  <label key={name}>
                    <input
                      type="checkbox"
                      checked={inviteSelection.includes(name)}
                      onChange={(event) =>
                        setInviteSelection(
                          event.target.checked
                            ? [...inviteSelection, name]
                            : inviteSelection.filter((item) => item !== name),
                        )
                      }
                    />
                    {name}
                  </label>
                ))}
                {!uninvited.length && (
                  <p>Todos os agentes disponíveis já foram convidados.</p>
                )}
              </fieldset>
              <p className={s.modalNote}>
                Convite simulado com os dados desta solicitação. Nenhum e-mail
                será enviado.
              </p>
            </>
          )}
          {modal === 'offer' && offerPreview && (
            <>
              <div className={s.modalOffer}>
                <span>
                  {offerPreview.service} · {offerPreview.carrier}
                </span>
                <strong>{money(offerPreview.total)}</strong>
              </div>
              <dl className={s.dataGrid}>
                <div>
                  <dt>Chegada ao porto</dt>
                  <dd>{shortDate(offerPreview.arrival)}</dd>
                </div>
                <div>
                  <dt>Trânsito</dt>
                  <dd>{offerPreview.transit ?? 'Não informado'} dias</dd>
                </div>
                <div>
                  <dt>Validade</dt>
                  <dd>{shortDate(offerPreview.validity)}</dd>
                </div>
                <div>
                  <dt>Free time</dt>
                  <dd>{offerPreview.freeDays ?? 'Não informado'} dias</dd>
                </div>
              </dl>
              <p className={s.modalNote}>
                {offerPreview.complete
                  ? 'Frete e taxas de origem e destino informados.'
                  : 'Oferta incompleta: confirme as taxas pendentes.'}{' '}
                Entrega final e seguro não incluídos.
              </p>
              {offerPreview.arrival &&
                q.needDate &&
                offerPreview.arrival > q.needDate && (
                  <p className={s.warning}>
                    Chegada prevista após a sua necessidade. Confira esse
                    impacto antes de escolher.
                  </p>
                )}
            </>
          )}
          {modal === 'approve' && chosen && (
            <>
              <div className={s.modalOffer}>
                <span>
                  {chosen.agent} · {chosen.carrier}
                </span>
                <strong>{money(chosen.total)}</strong>
                <span>{chosen.service}</span>
              </div>
              <dl className={s.dataGrid}>
                <div>
                  <dt>Chegada ao porto</dt>
                  <dd>{shortDate(chosen.arrival)}</dd>
                </div>
                <div>
                  <dt>Validade</dt>
                  <dd>{shortDate(chosen.validity)} de 2026</dd>
                </div>
                <div>
                  <dt>Free time</dt>
                  <dd>{chosen.freeDays ?? 'Não informado'} dias</dd>
                </div>
                <div>
                  <dt>Cobertura</dt>
                  <dd>Frete + taxas de origem e destino</dd>
                </div>
              </dl>
              <p className={s.modalNote}>
                Entrega na fábrica e seguro da carga não incluídos. Saída e
                espaço sujeitos a confirmação.
              </p>
              {chosen.arrival && q.needDate && chosen.arrival > q.needDate && (
                <p className={s.warning}>
                  <TriangleAlert size={17} /> A chegada prevista é{' '}
                  {dayDelta(chosen.arrival, q.needDate)} dias após sua
                  necessidade. Considere esse impacto antes de confirmar.
                </p>
              )}
            </>
          )}
          {modal === 'dispatch' && (
            <>
              <dl className={s.dataGrid}>
                <div>
                  <dt>Carga</dt>
                  <dd>{q.product}</dd>
                </div>
                <div>
                  <dt>Peso / volume</dt>
                  <dd>
                    {q.weight} kg / {q.volume} m³
                  </dd>
                </div>
                <div>
                  <dt>Rota</dt>
                  <dd>{q.origin} → {q.destination}</dd>
                </div>
                <div>
                  <dt>Necessidade no porto</dt>
                  <dd>{shortDate(q.needDate)}</dd>
                </div>
              </dl>
              <fieldset className={s.agentChoices}>
                <legend>Enviar para</legend>
                {['Alpha Cargo', 'Beta Logistics', 'Gamma Comex'].map((a) => (
                  <label key={a}>
                    <input
                      type="checkbox"
                      checked={q.targetAgents.includes(a)}
                      onChange={(e) =>
                        update({
                          targetAgents: e.target.checked
                            ? [...q.targetAgents, a]
                            : q.targetAgents.filter((n) => n !== a),
                        })
                      }
                    />
                    {a}
                  </label>
                ))}
              </fieldset>
              <fieldset className={s.agentChoices}>
                <legend>Quando enviar</legend>
                <label>
                  <input
                    type="radio"
                    name="send-mode"
                    checked={sendMode === 'now'}
                    onChange={() => setSendMode('now')}
                  />
                  Enviar agora
                </label>
                <label>
                  <input
                    type="radio"
                    name="send-mode"
                    checked={sendMode === 'schedule'}
                    onChange={() => setSendMode('schedule')}
                  />
                  Programar envio
                </label>
              </fieldset>
              {sendMode === 'schedule' && (
                <label className={s.scheduleField}>
                  Data e horário de envio · Brasília
                  <input
                    type="datetime-local"
                    value={sendAt}
                    min="2026-09-13T10:31"
                    onChange={(event) => setSendAt(event.target.value)}
                  />
                  <small>
                    Relógio da demonstração: 13/09/2026, 10:30. Programar não
                    envia agora.
                  </small>
                </label>
              )}
              <p className={s.modalNote}>
                Envio simulado. Nenhum e-mail será enviado aos agentes.
              </p>
            </>
          )}
          {(modal === 'cancel' || modal === 'decline') && (
            <label className={s.reasonField}>
              Motivo
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explique o motivo para manter o contexto da decisão."
              />
            </label>
          )}
          {modal === 'shipment' && (
            <div className={s.shipmentPreview}>
              <span className={s.status + ' ' + s.green}>
                Contratação confirmada
              </span>
              <h3>{q.reference.replace('COT-', 'EMB-')}</h3>
              <p>
                {q.po} · {q.supplier}
              </p>
              <ol>
                <li>Escolha e condições confirmadas</li>
                <li>
                  <strong>Próximo: confirmar booking</strong>
                  <small>Responsável: {winner?.agent ?? 'A definir'}</small>
                </li>
                <li>Saída prevista: {shortDate(winner?.departure ?? null)}</li>
                <li>
                  Chegada ao porto prevista:{' '}
                  {shortDate(winner?.arrival ?? null)}
                </li>
              </ol>
              <small>Prévia do vínculo. Não foi criado um embarque real.</small>
            </div>
          )}
          {modal === 'instruction' && (
            <div className={s.shipmentPreview}>
              <h3>
                {q.po} · {q.supplier}
              </h3>
              <p>
                Destino: Santos · {q.equipment} · {q.incoterm}
              </p>
              <p>
                {q.weight} kg · {q.volume} m³
              </p>
              <p>
                Condição liberada: {winner?.service} · {winner?.agent}
              </p>
              <p className={s.modalNote}>
                A preparação e o envio da instrução completa permanecem no fluxo
                existente. Este resumo demonstra a próxima etapa, sem envio.
              </p>
            </div>
          )}
          {error && (
            <p role="alert" className={s.error}>
              {error}
            </p>
          )}
          <div className={s.modalActions}>
            <button className={s.secondary} onClick={() => setModal(null)}>
              {modal === 'shipment' || modal === 'instruction'
                ? 'Voltar à cotação'
                : 'Voltar'}
            </button>
            {modal === 'invite' && (
              <button
                className={s.primary}
                disabled={!inviteSelection.length}
                onClick={invite}
              >
                Enviar convite para {inviteSelection.length}{' '}
                {inviteSelection.length === 1 ? 'agente' : 'agentes'}
              </button>
            )}
            {modal === 'approve' && (
              <button className={s.primary} onClick={approve}>
                Confirmar escolha
              </button>
            )}
            {modal === 'dispatch' && (
              <button
                className={s.primary}
                disabled={!q.targetAgents.length}
                onClick={dispatch}
              >
                {sendMode === 'schedule'
                  ? 'Confirmar programação'
                  : 'Enviar solicitação'}
              </button>
            )}
            {(modal === 'cancel' || modal === 'decline') && (
              <button
                className={s.primary}
                disabled={!reason.trim()}
                onClick={() => {
                  if (simulateFailure()) return;
                  update(
                    {
                      stage: modal === 'cancel' ? 'cancelled' : 'declined',
                      reason: reason.trim(),
                    },
                    'Solicitação encerrada: ' + reason.trim(),
                  );
                  setModal(null);
                  setNotice('Encerramento registrado nesta prévia.');
                }}
              >
                Confirmar encerramento
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OfferDetails({ offer }: { offer: Offer }) {
  return (
    <div className={s.offerDetails}>
      <div>
        <h3>Composição do valor</h3>
        <table>
          <tbody>
            {offer.charges.map((c) => (
              <tr key={c.label}>
                <td>{c.label}</td>
                <td>{c.amount === null ? 'Não informado' : money(c.amount)}</td>
              </tr>
            ))}
            <tr>
              <th>Total informado</th>
              <th>{money(offer.total)}</th>
            </tr>
          </tbody>
        </table>
        <small>
          Valores em BRL por contêiner. Conversão informada na oferta; sem
          recálculo cambial nesta prévia.
        </small>
        <div className={s.marketBasis}>
          <h3>Referência de mercado</h3>
          {offer.complete ? (
            <p>
              Mediana de <strong>{money(marketMedian)}</strong> · 18 ofertas
              equivalentes · últimos 30 dias.
            </p>
          ) : (
            <p>
              As taxas de destino ainda não foram informadas. Complete os custos
              para comparar esta oferta com o mercado.
            </p>
          )}
          <p>
            Busan → Santos · marítimo FCL · 1 × 40’ HC · FOB. Frete e taxas de
            origem/destino em BRL; entrega final e seguro excluídos em toda a
            amostra.
          </p>
          <p>
            Mediana dos 30 dias anteriores: {money(23500)}. Variação de +2,6%;
            não é previsão do próximo preço.
          </p>
          <small>
            Base demonstrativa · atualizada em 12/09/2026. Percentuais
            arredondados; escopos incompletos não recebem comparação percentual.
          </small>
        </div>
      </div>
      <div>
        <h3>Condições da oferta</h3>
        <dl>
          <div>
            <dt>Saída prevista</dt>
            <dd>{shortDate(offer.departure)}</dd>
          </div>
          <div>
            <dt>Serviço</dt>
            <dd>
              {offer.route} · {offer.carrier}
            </dd>
          </div>
          <div>
            <dt>Free time no destino</dt>
            <dd>
              {offer.freeDays === null
                ? 'Não informado'
                : offer.freeDays + ' dias'}
            </dd>
          </div>
          <div>
            <dt>Pagamento</dt>
            <dd>15 dias após a chegada</dd>
          </div>
          <div>
            <dt>Não incluídos</dt>
            <dd>
              Entrega final e seguro da carga
              {!offer.complete ? '; taxas de destino não informadas' : ''}
            </dd>
          </div>
        </dl>
        <small>
          Fonte: {offer.service} · recebida em 12/09/2026. Condições
          demonstrativas; espaço sujeito à confirmação.
        </small>
      </div>
    </div>
  );
}
