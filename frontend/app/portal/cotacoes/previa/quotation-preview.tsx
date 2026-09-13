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
  validateCargo,
  money,
  shortDate,
  dayDelta,
} from './model';
import s from './quotation-preview.module.css';

type Modal =
  | 'approve'
  | 'dispatch'
  | 'cancel'
  | 'decline'
  | 'shipment'
  | 'instruction'
  | null;
const terminal = (stage: Stage) =>
  ['closed', 'declined', 'cancelled'].includes(stage);
const scenarioExists = (id: string) => scenarios.some(([key]) => key === id);

export default function QuotationPreview({
  initialScenario,
}: {
  initialScenario: string;
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
  const [expanded, setExpanded] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [list, setList] = useState(false);
  const [search, setSearch] = useState('');
  const [reason, setReason] = useState('');
  const [failNext, setFailNext] = useState(false);
  const [revision, setRevision] = useState(0);
  const [formErrors, setFormErrors] = useState(false);

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
    setSelection(next.selected);
    setExpanded(null);
    setModal(null);
    setError('');
    setFormErrors(false);
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
  const completeForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateCargo(q.weight, q.volume)) {
      setFormErrors(true);
      return;
    }
    setFormErrors(false);
    if (q.stage === 'needs-info') {
      update(
        { stage: 'draft' },
        'Complemento registrado: peso bruto e volume. Solicitação pronta para revisão.',
      );
      setNotice(
        'Dados complementados. Revise os agentes antes de enviar a solicitação.',
      );
    } else openModal('dispatch');
  };
  const dispatch = () => {
    if (!q.targetAgents.length) {
      setError('Selecione pelo menos um agente.');
      return;
    }
    if (!validateCargo(q.weight, q.volume)) {
      setError('Complete peso e volume antes de enviar.');
      return;
    }
    if (simulateFailure()) return;
    update(
      {
        stage: 'waiting',
        sentAt: '13/09 às 10:30',
        responseBy: '14/09 às 17:00',
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
    const all = createQuote('comparar').offers.filter((o) =>
      q.targetAgents.includes(o.agent),
    );
    const next = all.slice(0, Math.min(q.offers.length + 1, all.length));
    update(
      {
        offers: next,
        stage: next.length === q.agentCount ? 'ready' : 'partial',
      },
      'Nova proposta recebida' +
        (next.length === q.agentCount
          ? ' e ofertas liberadas para escolha.'
          : '; aguardando demais agentes.'),
    );
    setNotice(
      next.length === q.agentCount
        ? 'Todas as respostas chegaram. As propostas foram liberadas nesta simulação.'
        : 'Uma resposta foi adicionada. A cotação ainda aguarda liberação para escolha.',
    );
  };
  const mainStatusTone =
    q.stage === 'needs-info'
      ? s.amber
      : q.stage === 'ready' || q.stage === 'closed'
        ? s.green
        : s.neutral;
  const formsComplete = validateCargo(q.weight, q.volume);

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
          <label htmlFor="preview-scenario" className={s.srOnly}>
            Cenário da prévia
          </label>
          <select
            id="preview-scenario"
            value={scenario}
            onChange={(e) => chooseScenario(e.target.value)}
          >
            {scenarios.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
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
              {isWaiting && (
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
          <h1>Cotações da prévia</h1>
          <p className={s.muted}>
            Abra uma solicitação para percorrer a jornada.
          </p>
          <input
            className={s.search}
            aria-label="Buscar cotação da prévia"
            placeholder="Buscar fornecedor, PO ou situação"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className={s.panel}>
            {scenarios
              .filter(([id, name]) =>
                [name, createQuote(id).supplier, createQuote(id).po]
                  .join(' ')
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .map(([id, name]) => (
                <button
                  key={id}
                  className={s.listRow}
                  onClick={() => chooseScenario(id)}
                >
                  <span>
                    <strong>
                      {createQuote(id).supplier || 'Fornecedor não informado'}
                    </strong>
                    <small>
                      {createQuote(id).po} · {createQuote(id).reference}
                    </small>
                  </span>
                  <span>{name}</span>
                  <ChevronRight size={18} />
                </button>
              ))}
          </div>
        </section>
      ) : (
        <>
          <div className={s.backRow}>
            <button className={s.textButton} onClick={() => setList(true)}>
              <ArrowLeft size={16} /> Minhas cotações
            </button>
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
            <div>
              <small>Necessidade no porto</small>
              <strong>
                {q.needDate ? shortDate(q.needDate) : 'Não informada'}
              </strong>
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

          {isForm && (
            <section className={s.panel + ' ' + s.formPanel}>
              <div className={s.sectionHeading}>
                <div>
                  <h2>
                    {q.stage === 'needs-info'
                      ? 'Complete os dados da carga'
                      : 'Finalize sua solicitação'}
                  </h2>
                  <p>
                    {q.stage === 'needs-info'
                      ? 'Faltam duas informações para preparar a solicitação aos agentes.'
                      : 'Os dados já preenchidos foram mantidos. Confira o que falta e revise o envio.'}
                  </p>
                </div>
                <span className={s.subtleTag}>
                  {formsComplete ? 'Dados preenchidos' : '2 campos necessários'}
                </span>
              </div>
              {q.stage === 'needs-info' && (
                <div className={s.requestNote}>
                  <strong>Marina · Freitas</strong>
                  <span>12/09, 14:10</span>
                  <p>
                    “Confirme o peso bruto e o volume total, incluindo as
                    embalagens. Precisamos desses dados para que os agentes
                    cotem a mesma carga.”
                  </p>
                </div>
              )}
              <form onSubmit={completeForm} noValidate>
                <div className={s.fields}>
                  <label>
                    Peso bruto total <span className={s.required}>*</span>
                    <div className={s.inputUnit}>
                      <input
                        aria-invalid={
                          formErrors && !validateCargo(q.weight, '1')
                        }
                        aria-describedby="weight-hint"
                        inputMode="decimal"
                        value={q.weight}
                        onChange={(e) => update({ weight: e.target.value })}
                        placeholder="Ex.: 12400"
                      />
                      <span>kg</span>
                    </div>
                    <small id="weight-hint">
                      Inclua o peso das embalagens.
                    </small>
                  </label>
                  <label>
                    Volume total <span className={s.required}>*</span>
                    <div className={s.inputUnit}>
                      <input
                        aria-invalid={
                          formErrors && !validateCargo('1', q.volume)
                        }
                        aria-describedby="volume-hint"
                        inputMode="decimal"
                        value={q.volume}
                        onChange={(e) => update({ volume: e.target.value })}
                        placeholder="Ex.: 52"
                      />
                      <span>m³</span>
                    </div>
                    <small id="volume-hint">
                      Informe o volume da carga embalada.
                    </small>
                  </label>
                </div>
                {formErrors && (
                  <p className={s.error} role="alert">
                    Informe peso e volume maiores que zero. Use vírgula ou ponto
                    para decimais, sem separador de milhar.
                  </p>
                )}
                <div className={s.formBottom}>
                  <span>
                    <Check size={14} /> Rascunho salvo neste navegador
                  </span>
                  <button className={s.primary} type="submit">
                    {q.stage === 'needs-info'
                      ? 'Enviar complemento'
                      : 'Revisar solicitação'}
                    <ArrowRight size={16} />
                  </button>
                </div>
              </form>
            </section>
          )}

          {isWaiting && (
            <section className={s.panel}>
              <div className={s.sectionHeading}>
                <div>
                  <h2>
                    {q.stage === 'partial'
                      ? 'As respostas estão chegando'
                      : 'Sua solicitação está com os agentes'}
                  </h2>
                  <p>
                    Enviada em {q.sentAt}. {q.offers.length} de {q.agentCount}{' '}
                    respostas recebidas.
                  </p>
                </div>
                <span className={s.subtleTag}>
                  <Clock3 size={14} /> Retorno até {q.responseBy}
                </span>
              </div>
              <div className={s.agentTable}>
                <table>
                  <thead>
                    <tr>
                      <th>Agente de carga</th>
                      <th>Situação</th>
                      <th>Último movimento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {q.targetAgents.map((name) => (
                      <tr key={name}>
                        <td>
                          <strong>{name}</strong>
                        </td>
                        <td>
                          <span
                            className={
                              s.status +
                              ' ' +
                              (q.offers.find((o) => o.agent === name)
                                ? s.green
                                : s.neutral)
                            }
                          >
                            {q.offers.find((o) => o.agent === name)
                              ? 'Proposta recebida'
                              : 'Aguardando resposta'}
                          </span>
                        </td>
                        <td>
                          {q.offers.find((o) => o.agent === name)
                            ? '13/09, 10:30'
                            : 'Solicitação recebida · ' + q.sentAt}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className={s.waitFooter}>
                <p>
                  <strong>A Freitas acompanha os retornos.</strong> Você será
                  avisado quando as propostas estiverem liberadas para escolha.
                </p>
                <button
                  className={s.secondary}
                  disabled={q.followup}
                  onClick={() => {
                    update(
                      { followup: true },
                      'Solicitação de atualização registrada para a Freitas (simulação).',
                    );
                    setNotice(
                      'Pedido de atualização registrado localmente. Nenhuma mensagem foi enviada.',
                    );
                  }}
                >
                  {q.followup ? (
                    <>
                      <Check size={15} /> Atualização solicitada
                    </>
                  ) : (
                    'Solicitar atualização'
                  )}
                </button>
              </div>
            </section>
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

          {(canCompare || q.stage === 'partial') && (
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
                      <th>Chegada ao porto</th>
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
                              (!validOffer(o) ? s.expiredRow : '')
                            }
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
                                onChange={() => {
                                  setSelection(o.id);
                                  update({ selected: o.id });
                                  setError('');
                                }}
                              />
                            </td>
                            <td data-label="Agente / armador">
                              <strong className={s.agentName}>{o.agent}</strong>
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
                                className={!validOffer(o) ? s.warningText : ''}
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
                  Valores em BRL. Entrega na fábrica e seguro da carga não estão
                  incluídos. <strong>Chegada é uma previsão ao porto.</strong>
                </span>
              </div>
            </section>
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
              <section>
                <div className={s.insightHeader}>
                  <h2>Confiabilidade</h2>
                  <span>{focusOffer.agent}</span>
                </div>
                <p className={s.insightHeadline}>
                  <strong>
                    {focusOffer.onTime} de {focusOffer.completed}
                  </strong>{' '}
                  chegadas no prazo
                </p>
                <p className={s.muted}>
                  Embarques concluídos nesta rota nos últimos 6 meses.
                </p>
                <details>
                  <summary>
                    Ver histórico e evidências <ChevronDown size={13} />
                  </summary>
                  <div className={s.evidence}>
                    <p>
                      {focusOffer.audited} fretes conferidos;{' '}
                      {focusOffer.discrepancies === 0
                        ? 'nenhuma divergência confirmada'
                        : focusOffer.discrepancies +
                          ' divergência confirmada'}{' '}
                      na amostra.
                    </p>
                    <table>
                      <thead>
                        <tr>
                          <th>Fonte</th>
                          <th>Recorte</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>Eventos de chegada</td>
                          <td>Previsto × realizado no porto</td>
                        </tr>
                        <tr>
                          <td>Auditorias concluídas</td>
                          <td>Proposta × cobrança</td>
                        </tr>
                      </tbody>
                    </table>
                    <small>
                      Amostra fictícia · março a agosto/2026 · Busan → Santos ·
                      marítimo FCL. Sem ocorrências abertas não significa
                      entrega pontual.
                    </small>
                  </div>
                </details>
              </section>
              <section>
                <div className={s.insightHeader}>
                  <h2>Mercado desta rota</h2>
                  <span>Busan → Santos</span>
                </div>
                <p className={s.insightHeadline}>
                  {focusOffer.complete ? (
                    <>
                      <strong>
                        {Math.round((1 - focusOffer.total / 24100) * 100)}%
                        abaixo
                      </strong>{' '}
                      da referência recente
                    </>
                  ) : (
                    <strong>Faltam custos para comparar</strong>
                  )}
                </p>
                <p className={s.muted}>
                  Mediana de {money(24100)} · 18 ofertas equivalentes · últimos
                  30 dias.
                </p>
                <details>
                  <summary>
                    Ver contexto de mercado <ChevronDown size={13} />
                  </summary>
                  <div className={s.evidence}>
                    <p>
                      Referência para 1 × 40’ HC, FOB, frete e taxas de
                      origem/destino em BRL. Entrega final e seguro excluídos em
                      toda a amostra.
                    </p>
                    <p>
                      Mediana dos 30 dias anteriores: {money(23500)}. Variação
                      de +2,6%; não é previsão do próximo preço.
                    </p>
                    <small>
                      Base demonstrativa · atualizada em 12/09/2026. Escopos
                      incompletos não entram no comparativo.
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
            {modal === 'approve'
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
            {modal === 'approve'
              ? 'Ao confirmar, a oferta seguirá para análise da Freitas. A contratação ainda não estará concluída.'
              : modal === 'dispatch'
                ? 'Confira a carga e os agentes que receberão a solicitação.'
                : modal === 'shipment'
                  ? 'Continuidade demonstrativa da cotação até o acompanhamento.'
                  : modal === 'instruction'
                    ? 'Dados da condição liberada para preparação do embarque.'
                    : 'O histórico será preservado. Esta ação é apenas local à prévia.'}
          </DialogDescription>
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
                  <dd>Busan → Santos</dd>
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
                Enviar solicitação
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
