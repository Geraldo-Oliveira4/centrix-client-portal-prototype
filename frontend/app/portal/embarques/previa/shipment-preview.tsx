'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import * as Dialog from '@radix-ui/react-dialog';
import * as Tabs from '@radix-ui/react-tabs';
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Download,
  FileText,
  Info,
  Package,
  RotateCcw,
  Search,
  Settings2,
  Ship,
  Star,
  TriangleAlert,
  X,
} from 'lucide-react';
import { portalFont } from '../../portal-font';
import {
  approveBooking,
  arrivalState,
  cargoTotals,
  createShipment,
  journeySteps,
  journeyGuidance,
  markRead,
  money,
  scenarios,
  shortDate,
  submitDocument,
  type CargoItem,
  type Shipment,
} from './model';
import s from './shipment-preview.module.css';

type Panel =
  | { kind: 'item' | 'document' | 'alert' | 'milestone'; id: string }
  | { kind: 'alerts' | 'preferences' | 'update'; id?: string }
  | null;
const steps = journeySteps.map((step) => step.label);
const STORAGE = 'centrix-shipment-review-v2';

export default function ShipmentPreview({
  initialScenario,
}: {
  initialScenario: string;
}) {
  const validScenario = scenarios.some(([id]) => id === initialScenario)
    ? initialScenario
    : 'transito';
  const [scenario, setScenario] = useState(validScenario);
  const [q, setQ] = useState<Shipment>(() => createShipment(validScenario));
  const [ready, setReady] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const [tab, setTab] = useState('cargo');
  const [panel, setPanel] = useState<Panel>(null);
  const [query, setQuery] = useState('');
  const [supplier, setSupplier] = useState('all');
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [file, setFile] = useState('');
  const [approved, setApproved] = useState(false);
  const [notice, setNotice] = useState('');
  const [historyType, setHistoryType] = useState('Todos');
  const [alertFilter, setAlertFilter] = useState('Ativas');
  const [notifications, setNotifications] = useState({
    changes: true,
    documents: true,
  });
  const [draftNotifications, setDraftNotifications] = useState(notifications);
  const focusBack = useRef<HTMLElement | null>(null);
  const tabSection = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function openLinkedDocuments() {
      if (window.location.hash !== '#documentos') return;
      setTab('documents');
      requestAnimationFrame(() =>
        tabSection.current?.scrollIntoView({ block: 'start' }),
      );
    }
    openLinkedDocuments();
    window.addEventListener('hashchange', openLinkedDocuments);
    return () => window.removeEventListener('hashchange', openLinkedDocuments);
  }, []);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(`${STORAGE}:${scenario}`);
      if (saved) {
        const data = JSON.parse(saved);
        if (data.shipment?.id === `demo-shipment-${scenario}`)
          setQ(data.shipment);
        if (data.notifications) setNotifications(data.notifications);
      }
    } catch {
      /* A fresh fixture remains usable when storage is unavailable. */
    }
    setReady(true);
  }, [scenario]);
  useEffect(() => {
    if (ready)
      try {
        sessionStorage.setItem(
          `${STORAGE}:${scenario}`,
          JSON.stringify({ shipment: q, notifications }),
        );
      } catch {
        /* Session-only review remains usable. */
      }
  }, [q, ready, scenario, notifications]);

  function changeScenario(value: string) {
    setReady(false);
    setScenario(value);
    setQ(createShipment(value));
    setPanel(null);
    setTab('cargo');
    setQuery('');
    setSupplier('all');
    setCollapsed([]);
    setNotice('');
    window.history.replaceState(null, '', `?cenario=${value}`);
  }
  function reset() {
    sessionStorage.removeItem(`${STORAGE}:${scenario}`);
    setQ(createShipment(scenario));
    setNotifications({ changes: true, documents: true });
    setPanel(null);
    setNotice('Cenário restaurado.');
  }
  function open(next: Panel) {
    if (!panel) focusBack.current = document.activeElement as HTMLElement;
    setFile('');
    setApproved(false);
    setPanel(next);
    if (next?.kind === 'alert') setQ((current) => markRead(current, next.id));
    if (next?.kind === 'preferences') setDraftNotifications(notifications);
  }
  function goTab(value: string) {
    setPanel(null);
    setTab(value);
    requestAnimationFrame(() => {
      tabSection.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
      document.getElementById(`shipment-tab-${value}`)?.focus();
    });
  }
  const arrival = arrivalState(q);
  const guidance = journeyGuidance(q);
  const suppliers = Array.from(new Set(q.items.map((i) => i.supplier)));
  const pos = Array.from(new Set(q.items.map((i) => i.po)));
  const activeAlerts = q.alerts
    .filter((a) => a.state !== 'Resolvida')
    .sort((a, b) => Number(b.blocking) - Number(a.blocking));
  const pendingDocs = q.documents.filter((d) => d.state === 'Pendente').length;
  const totals = cargoTotals(q.items);
  const filtered = q.items.filter(
    (i) =>
      `${i.po} ${i.part ?? ''} ${i.description} ${i.supplier}`
        .toLocaleLowerCase('pt-BR')
        .includes(query.toLocaleLowerCase('pt-BR')) &&
      (supplier === 'all' || supplier === i.supplier),
  );
  const selectedItem =
    panel?.kind === 'item' ? q.items.find((i) => i.id === panel.id) : undefined;
  const selectedAlert =
    panel?.kind === 'alert'
      ? q.alerts.find((a) => a.id === panel.id)
      : undefined;
  const selectedDoc =
    panel?.kind === 'document'
      ? q.documents.find((d) => d.id === panel.id)
      : undefined;
  const documentId =
    selectedDoc?.id ??
    (selectedAlert?.kind === 'document' ? selectedAlert.target : null);
  const actionDoc = q.documents.find((d) => d.id === documentId);
  const header = selectedItem
    ? (selectedItem.part ?? 'Item sem part number')
    : (selectedDoc?.name ??
      selectedAlert?.title ??
      (panel?.kind === 'alerts'
        ? 'Ocorrências do embarque'
        : panel?.kind === 'preferences'
          ? 'Preferências deste embarque'
          : panel?.kind === 'update'
            ? 'Solicitar atualização'
            : panel?.kind === 'milestone'
              ? steps[Number(panel.id)]
              : 'Detalhe'));

  function downloadExample() {
    const text = `DOCUMENTO FICTÍCIO — PRÉVIA CENTRIX\n${selectedDoc?.name}\n${q.reference}\nVersão: ${selectedDoc?.version}\nEste arquivo de texto é apenas uma amostra de revisão. Não representa documento comercial.\n`;
    const url = URL.createObjectURL(
      new Blob([text], { type: 'text/plain;charset=utf-8' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedDoc?.file ?? 'documento-demo'}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }
  function itemRow(i: CargoItem) {
    return (
      <tr key={i.id}>
        <td>
          <button
            className={s.itemLink}
            onClick={() => open({ kind: 'item', id: i.id })}
          >
            {i.part ?? 'Não informado'}
            <ChevronRight size={14} />
          </button>
          <span className={s.small}>{i.description}</span>
        </td>
        <td>
          <span>{i.supplier}</span>
          <span className={s.small}>
            {i.invoice} · linha {i.line}
          </span>
        </td>
        <td className={s.number}>
          <strong>
            {i.quantity.toLocaleString('pt-BR')}{' '}
            <span className={s.unit}>{i.unit}</span>
          </strong>
          <span className={s.small}>
            {i.ordered !== null
              ? `de ${i.ordered.toLocaleString('pt-BR')} ${i.unit} na PO`
              : 'Total da PO não informado'}
          </span>
        </td>
        <td className={s.number}>
          {i.unitValue === null ? (
            <span className={s.muted}>Não informado</span>
          ) : (
            <strong>{money(i.quantity * i.unitValue, i.currency)}</strong>
          )}
          <span className={s.small}>{i.currency} · mercadoria</span>
        </td>
      </tr>
    );
  }

  return (
    <div className={s.workspace}>
      <div className={s.review}>
        <span>
          <Info size={14} /> Protótipo · cenários fictícios · referência:
          13/09/2026
        </span>
        <details>
          <summary>
            Explorar cenários <ChevronDown size={13} />
          </summary>
          <div className={s.reviewOptions}>
            <label>
              Cenário
              <select
                aria-label="Cenário de embarque"
                value={scenario}
                onChange={(e) => changeScenario(e.target.value)}
              >
                {scenarios.map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <button onClick={reset}>
              <RotateCcw size={14} /> Restaurar cenário
            </button>
            <p>
              Os cenários não reproduzem o embarque selecionado na lista. As
              ações ficam nesta aba. Nenhum arquivo ou mensagem é enviado.
            </p>
          </div>
        </details>
      </div>

      <div className={s.breadcrumb}>
        <Link href="/portal/embarques">
          <ArrowLeft size={15} /> Meus Embarques
        </Link>
        <ChevronRight size={13} />
        <span>{q.reference}</span>
      </div>
      <header className={s.identity}>
        <div>
          <div className={s.headingLine}>
            <h1>{pos[0] ?? q.reference}</h1>
            {pos.length > 1 && (
              <button className={s.poMore} onClick={() => goTab('cargo')}>
                +{pos.length - 1} PO
              </button>
            )}
            <span className={s.stage}>{steps[q.stage]}</span>
          </div>
          <p className={s.supplier}>
            {suppliers.join(' / ') || 'Fornecedor não informado'}
          </p>
          <p className={s.description}>
            {q.description}
            {pos.length === 0 && ' · Referência do cliente não informada'}
          </p>
        </div>
        <div className={s.identityActions}>
          <button
            className={`${s.button} ${q.priority ? s.priority : ''}`}
            aria-pressed={q.priority}
            onClick={() => setQ({ ...q, priority: !q.priority })}
          >
            <Star size={16} fill={q.priority ? 'currentColor' : 'none'} />{' '}
            {q.priority ? 'Embarque prioritário' : 'Priorizar embarque'}
          </button>
          <button
            className={s.iconButton}
            aria-label="Preferências de alertas"
            onClick={() => open({ kind: 'preferences' })}
          >
            <Settings2 size={17} />
          </button>
        </div>
      </header>

      <section className={s.journey} aria-label="Chegada e acompanhamento">
        <div className={s.journeyToolbar}>
          <span>Acompanhamento do embarque</span>
          <button
            className={s.sourceToggle}
            role="switch"
            aria-checked={showSources}
            onClick={() => setShowSources(!showSources)}
            aria-controls="shipment-journey-data"
          >
            <span className={s.switchTrack}>
              <span />
            </span>{' '}
            Origem dos dados
          </button>
        </div>
        {showSources && (
          <div className={s.sourceIntro} id="shipment-journey-data">
            <Info size={15} /> Modo de revisão: fontes necessárias para
            integrar. Todos os dados desta prévia são fictícios; cobertura real
            ainda não validada.
          </div>
        )}
        <div className={s.journeyTop}>
          <div className={s.arrival}>
            <span className={s.muted}>{arrival.label}</span>
            <div className={s.dateLine}>
              <strong>{shortDate(q.eta)}</strong>
              {q.actual ? (
                <span className={s.success}>
                  <CheckCircle2 size={14} /> Confirmada
                </span>
              ) : q.eta && q.eta < '2026-09-13' ? (
                <button
                  className={s.warning}
                  onClick={() => open({ kind: 'alert', id: 'eta-expired' })}
                >
                  <Clock3 size={14} /> Confirmação pendente
                </button>
              ) : q.firstEta && q.eta && q.eta > q.firstEta ? (
                <button
                  className={s.warning}
                  onClick={() =>
                    open({
                      kind: 'alert',
                      id:
                        scenario === 'booking'
                          ? 'booking-review'
                          : 'eta-change',
                    })
                  }
                >
                  Chegada revisada <ChevronRight size={13} />
                </button>
              ) : null}
            </div>
            <p>{arrival.note}</p>
            {showSources && (
              <div className={s.sourceNote}>
                <strong>ShipsGo · chegada do navio</strong>
                <span>
                  ARRV no destino ·{' '}
                  {q.actual ? 'ACT: realizado' : 'EST: previsto'}. Previsão
                  inicial: histórico de ARRV persistido pelo Centrix. Sem
                  evento, mostrar sem previsão.
                </span>
              </div>
            )}
          </div>
          <div className={s.route}>
            <div>
              <Ship size={17} />
              <strong>{q.origin}</strong>
              <ArrowRight size={16} />
              <strong>{q.destination}</strong>
            </div>
            <p>
              Marítimo{scenario !== 'sem-dados' && ' · FCL · 1 × 40’ HC · FOB'}
            </p>
            <span className={s.small}>
              {q.updated
                ? `Tracking demonstrativo · atualizado em ${q.updated}`
                : 'Acompanhamento ainda sem fonte de dados'}
            </span>
            {showSources && (
              <div className={s.sourceNote}>
                <strong>
                  Rota/equipamento: ShipsGo · contratado: Centrix/Inova
                </strong>
                <span>
                  Portos e contêiner quando disponíveis. Modal, FCL e FOB:
                  condição contratada. Atualização: checked_at do tracking; não
                  a edição do cadastro.
                </span>
              </div>
            )}
          </div>
        </div>
        <div className={s.guidance} aria-live="polite">
          <div className={s.currentPhase}>
            <span className={s.eyebrow}>Fase atual</span>
            <h2>{guidance.phase}</h2>
            <p>{guidance.summary}</p>
            {showSources && (
              <div className={s.sourceNote}>
                <strong>{journeySteps[q.stage].source}</strong>
                <span>
                  Estado demonstrativo. Confirmação física depende de evento;
                  aprovação não avança coleta ou partida.
                </span>
              </div>
            )}
          </div>
          <div className={s.nextPhase}>
            <span className={s.eyebrow}>Para avançar</span>
            <h2>{guidance.next}</h2>
            <p>{guidance.instruction}</p>
            <div className={s.guidanceAction}>
              <span>
                Responsável: <strong>{guidance.owner}</strong>
              </span>
              <button
                className={s.textButton}
                onClick={() =>
                  guidance.alertId
                    ? open({ kind: 'alert', id: guidance.alertId })
                    : guidance.action === 'Ver acompanhamento'
                      ? open({ kind: 'milestone', id: '4' })
                      : open({ kind: 'update' })
                }
              >
                {guidance.action} <ArrowRight size={14} />
              </button>
            </div>
            {showSources && (
              <div className={s.sourceNote}>
                <strong>Centrix · tarefas e responsáveis</strong>
                <span>
                  Orientação combina fase confirmada e pendências abertas. Não é
                  texto nem classificação de risco da ShipsGo.
                </span>
              </div>
            )}
          </div>
        </div>
        <ol className={s.timeline} aria-label="Etapas do embarque">
          {steps.map((step, index) => (
            <li
              key={step}
              className={`${index < q.stage ? s.completed : ''} ${index === q.stage ? s.current : ''}`}
            >
              <button
                onClick={() => open({ kind: 'milestone', id: String(index) })}
                aria-label={`${step}${index === q.stage ? ', etapa atual' : ''}`}
                aria-current={index === q.stage ? 'step' : undefined}
              >
                <span className={s.stepDot}>
                  {index < q.stage ? (
                    <Check size={12} />
                  ) : index === q.stage ? (
                    <span />
                  ) : null}
                </span>
                <strong>{step}</strong>
                <small>
                  {index === q.stage
                    ? 'Etapa atual'
                    : index === 0
                      ? scenario === 'sem-dados'
                        ? 'Data não informada'
                        : '28 ago.'
                      : index < q.stage
                        ? ['', '01 set.', '02 set.', '03 set.'][index]
                        : index === 4
                          ? `${q.actual ? '' : 'Prev. '}${shortDate(q.eta)}`
                          : 'Sem previsão informada'}
                </small>
              </button>
              {showSources && (
                <div className={s.stepSource}>
                  <strong>{journeySteps[index].source}</strong>
                  <span>
                    {
                      [
                        'Registro da solicitação',
                        'Análise / aprovação',
                        'Data prevista / realizada',
                        'DEPA · ACT',
                        'ARRV · EST / ACT',
                        'DISC · EST / ACT',
                        'GTOT · EST / ACT',
                      ][index]
                    }
                  </span>
                </div>
              )}
            </li>
          ))}
        </ol>
        <div className={s.journeyFoot}>
          <span>
            <span className={s.dot} />
            {q.stage === 3
              ? 'Em trânsito internacional. Próximo marco: chegada ao porto.'
              : q.stage === 4
                ? 'Chegada confirmada. Próximo marco físico: descarga.'
                : q.stage === 1
                  ? q.alerts.some(
                      (a) => a.kind === 'booking' && a.state === 'Resolvida',
                    )
                    ? 'Booking aprovado. Coleta e partida aguardam confirmação.'
                    : 'Aguardando definição do booking. Partida não confirmada.'
                  : 'Aguardando informações para acompanhar o embarque.'}
          </span>
          <button
            className={s.textButton}
            onClick={() => open({ kind: 'update' })}
          >
            Solicitar atualização <ArrowRight size={14} />
          </button>
        </div>
      </section>

      <section className={s.attention} aria-label="Atenção do embarque">
        <div className={s.attentionTitle}>
          <h2>
            <Bell size={17} />
            {activeAlerts.length
              ? 'Precisa de atenção'
              : scenario === 'sem-dados'
                ? 'Cobertura de alertas indisponível'
                : 'Nenhuma pendência ativa neste embarque'}
          </h2>
          {q.alerts.length > 0 && (
            <button
              className={s.textButton}
              onClick={() => open({ kind: 'alerts' })}
            >
              Ver ocorrências ({q.alerts.length}) <ChevronRight size={14} />
            </button>
          )}
        </div>
        {activeAlerts.slice(0, 2).map((a) => (
          <div
            className={`${s.alertRow} ${a.blocking ? s.blocked : ''}`}
            key={a.id}
          >
            <span className={s.alertIcon}>
              {a.blocking ? (
                <TriangleAlert size={19} />
              ) : a.kind === 'document' ? (
                <FileText size={19} />
              ) : (
                <Clock3 size={19} />
              )}
            </span>
            <div>
              <strong>{a.title}</strong>
              <p>
                {a.owner}
                {a.deadline
                  ? ` · até ${shortDate(a.deadline)}`
                  : ' · prazo não informado'}
                {a.blocking ? ' · aprovação pendente' : ''}
              </p>
            </div>
            <button
              className={
                a.kind === 'document' || a.kind === 'booking'
                  ? s.primary
                  : s.button
              }
              onClick={() => open({ kind: 'alert', id: a.id })}
            >
              {a.kind === 'document'
                ? 'Enviar documento'
                : a.kind === 'booking'
                  ? 'Revisar booking'
                  : 'Ver detalhe'}
              <ArrowRight size={14} />
            </button>
          </div>
        ))}
        {!activeAlerts.length && (
          <p className={s.small}>
            {scenario === 'sem-dados'
              ? 'Sem dados suficientes para verificar pendências e mudanças. Isso não confirma ausência de ocorrências.'
              : 'Consulte documentos em análise e atualizações no histórico quando precisar.'}
          </p>
        )}
      </section>

      <Tabs.Root
        value={tab}
        onValueChange={setTab}
        className={s.tabsRoot}
        ref={tabSection}
      >
        <Tabs.List className={s.tabs} aria-label="Detalhamento do embarque">
          {[
            ['cargo', 'Mercadorias e POs'],
            ['documents', 'Documentos'],
            ['terms', 'Condições contratadas'],
            ['history', 'Histórico'],
          ].map(([id, label]) => (
            <Tabs.Trigger id={`shipment-tab-${id}`} value={id} key={id}>
              {label}
              {id === 'documents' && pendingDocs > 0 && (
                <span
                  className={s.count}
                  aria-label={`${pendingDocs} documentos pendentes`}
                >
                  {pendingDocs}
                </span>
              )}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <Tabs.Content value="cargo" className={s.tabContent}>
          <div className={s.sectionHead}>
            <div>
              <h2>O que está neste embarque</h2>
              <p>
                {q.items.length
                  ? `${pos.length} ${pos.length === 1 ? 'PO' : 'POs'} · ${q.items.length} linhas de mercadoria · quantidades ${q.stage < 3 ? 'previstas' : 'embarcadas'}`
                  : 'O resumo será preenchido quando as mercadorias forem vinculadas.'}
              </p>
            </div>
            <div className={s.cargoValues}>
              {totals.map((t) => (
                <div key={t.currency}>
                  <span>
                    {t.known < t.lines
                      ? `Valor parcial · ${t.known}/${t.lines} linhas`
                      : 'Valor da mercadoria'}
                  </span>
                  <strong>{money(t.value, t.currency)}</strong>
                </div>
              ))}
            </div>
          </div>
          {q.items.length > 0 ? (
            <>
              <div className={s.tableTools}>
                <label className={s.search}>
                  <Search size={16} />
                  <input
                    aria-label="Buscar mercadoria ou PO"
                    placeholder="Buscar PO, part number ou descrição"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  {query && (
                    <button
                      aria-label="Limpar busca"
                      onClick={() => setQuery('')}
                    >
                      <X size={14} />
                    </button>
                  )}
                </label>
                {suppliers.length > 1 && (
                  <select
                    aria-label="Filtrar fornecedor"
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                  >
                    <option value="all">Todos os fornecedores</option>
                    {suppliers.map((name) => (
                      <option key={name}>{name}</option>
                    ))}
                  </select>
                )}
                <span className={s.small}>{filtered.length} linhas</span>
              </div>
              <div className={s.tableWrap}>
                <table>
                  <caption className={s.srOnly}>
                    Mercadorias agrupadas por PO. Quantidades e valores
                    referentes somente a este embarque.
                  </caption>
                  <thead>
                    <tr>
                      <th>Part number / mercadoria</th>
                      <th>Fornecedor / origem do dado</th>
                      <th className={s.number}>
                        Qtd. {q.stage < 3 ? 'prevista' : 'embarcada'}
                      </th>
                      <th className={s.number}>Valor neste embarque</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pos
                      .filter((po) => filtered.some((i) => i.po === po))
                      .map((po) => (
                        <PoGroup
                          key={po}
                          po={po}
                          items={filtered.filter((i) => i.po === po)}
                          collapsed={collapsed.includes(po)}
                          toggle={() =>
                            setCollapsed(
                              collapsed.includes(po)
                                ? collapsed.filter((p) => p !== po)
                                : [...collapsed, po],
                            )
                          }
                          row={itemRow}
                        />
                      ))}
                  </tbody>
                </table>
                {!filtered.length && (
                  <div className={s.empty}>
                    <Search size={22} />
                    <h3>Nenhuma mercadoria encontrada</h3>
                    <p>
                      Tente outra referência ou remova o filtro de fornecedor.
                    </p>
                    <button
                      className={s.button}
                      onClick={() => {
                        setQuery('');
                        setSupplier('all');
                      }}
                    >
                      Limpar busca e filtros
                    </button>
                  </div>
                )}
              </div>
              <div className={s.tableFoot}>
                <Info size={15} />
                <span>
                  Uma PO pode estar dividida entre embarques. Os valores acima
                  incluem apenas a mercadoria desta carga; frete separado.
                </span>
              </div>
            </>
          ) : (
            <div className={s.empty}>
              <Package size={28} />
              <h3>Mercadorias ainda não informadas</h3>
              <p>
                POs, part numbers e quantidades aparecerão aqui quando estiverem
                disponíveis. O acompanhamento continua acessível.
              </p>
              <button
                className={s.button}
                onClick={() => open({ kind: 'update' })}
              >
                Solicitar informações
              </button>
            </div>
          )}
        </Tabs.Content>
        <Tabs.Content value="documents" className={s.tabContent}>
          <div className={s.sectionHead}>
            <div>
              <h2>Documentos do embarque</h2>
              <p>
                {q.documents.length} documentos · {pendingDocs} aguardando envio
                · {q.documents.filter((d) => d.state === 'Em análise').length}{' '}
                em análise
              </p>
            </div>
          </div>
          {q.documents.map((d) => (
            <div className={s.documentRow} key={d.id}>
              <FileText size={21} />
              <div>
                <strong>{d.name}</strong>
                <span className={s.small}>
                  {d.file ?? 'Arquivo ainda não enviado'}
                  {d.file && ` · ${d.version}`} · {d.updated}
                </span>
              </div>
              <span
                className={
                  d.state === 'Pendente'
                    ? s.warning
                    : d.state === 'Aprovado'
                      ? s.success
                      : s.neutral
                }
              >
                {d.state}
              </span>
              <button
                className={d.state === 'Pendente' ? s.primary : s.button}
                onClick={() => open({ kind: 'document', id: d.id })}
              >
                {d.state === 'Pendente' ? 'Enviar arquivo' : 'Visualizar'}
                <ChevronRight size={14} />
              </button>
            </div>
          ))}
          {!q.documents.length && (
            <div className={s.empty}>
              <FileText size={26} />
              <h3>Documentos ainda não vinculados</h3>
              <p>
                Sem checklist confirmado para este embarque. A ausência de lista
                não significa que todos os documentos foram entregues.
              </p>
            </div>
          )}
        </Tabs.Content>
        <Tabs.Content value="terms" className={s.tabContent}>
          <div className={s.sectionHead}>
            <div>
              <h2>Condição aprovada na cotação</h2>
              <p>
                {scenario === 'sem-dados'
                  ? 'Cotação aprovada ainda não vinculada.'
                  : 'COT-DEMO-0173 · proposta v2 · aprovada em 28 ago. 2026'}
              </p>
            </div>
            {scenario !== 'sem-dados' && (
              <span className={s.neutral}>Condição original preservada</span>
            )}
          </div>
          {scenario !== 'sem-dados' ? (
            <>
              <div className={s.termsGrid}>
                <Field label="Agente de carga" value="Agente Demo" />
                <Field label="Rota contratada" value="Ningbo → Santos" />
                <Field
                  label="Modal / equipamento"
                  value="Marítimo · FCL · 1 × 40’ HC"
                />
                <Field label="Incoterm" value="FOB" />
                <Field label="Frete internacional" value="USD 2.850,00" />
                <Field
                  label="Despesas de destino informadas"
                  value="BRL 1.450,00"
                />
              </div>
              <div className={s.termsNote}>
                <Info size={17} />
                <p>
                  Frete e despesas em moedas distintas. Não inclui tributos,
                  armazenagem ou transporte até a empresa. Nenhum custo total de
                  importação calculado.
                </p>
              </div>
              <div className={s.contractChange}>
                <h3>Contratado e acompanhamento atual</h3>
                <div>
                  <span>Chegada ao porto</span>
                  <strong>
                    {shortDate(q.firstEta)} <ArrowRight size={14} />{' '}
                    {shortDate(q.eta)}
                  </strong>
                  <span className={s.small}>
                    {q.actual ? 'Chegada realizada' : 'Previsão atual'} ·{' '}
                    {q.eta === q.firstEta
                      ? 'sem mudança'
                      : 'atualização preserva a condição aprovada'}
                  </span>
                </div>
                <div>
                  <span>Contêiner</span>
                  <strong>DEMO0000183 · 40’ HC</strong>
                  <span className={s.small}>
                    Identificador fictício · alocação por item não informada
                  </span>
                </div>
                <div>
                  <span>Franquia / retirada</span>
                  <strong>Condição não informada</strong>
                  <span className={s.small}>Prazo e custos não calculados</span>
                </div>
              </div>
            </>
          ) : (
            <div className={s.empty}>
              <FileText size={25} />
              <h3>Condições ainda não disponíveis</h3>
              <p>
                Precisamos da proposta aceita e de seu vínculo com este embarque
                para mostrar o que foi contratado.
              </p>
            </div>
          )}
        </Tabs.Content>
        <Tabs.Content value="history" className={s.tabContent}>
          <div className={s.sectionHead}>
            <div>
              <h2>Histórico do embarque</h2>
              <p>Atualizações, documentos e decisões em um só lugar.</p>
            </div>
            <select
              aria-label="Filtrar histórico"
              value={historyType}
              onChange={(e) => setHistoryType(e.target.value)}
            >
              {['Todos', 'Documento', 'Acompanhamento', 'Contratação'].map(
                (t) => (
                  <option key={t}>{t}</option>
                ),
              )}
            </select>
          </div>
          <div className={s.history}>
            {q.events
              .filter((e) => historyType === 'Todos' || e.type === historyType)
              .map((e) => (
                <article key={e.id}>
                  <time>{e.date}</time>
                  <span className={s.historyDot} />
                  <div>
                    <strong>{e.title}</strong>
                    <p>{e.detail}</p>
                    <span className={s.small}>
                      {e.owner} · {e.type}
                    </span>
                  </div>
                </article>
              ))}
          </div>
          {!q.events.filter(
            (e) => historyType === 'Todos' || e.type === historyType,
          ).length && (
            <div className={s.empty}>
              <Clock3 size={24} />
              <h3>Nenhum evento neste recorte</h3>
              <p>
                Os eventos aparecem quando registrados pela fonte responsável.
              </p>
            </div>
          )}
        </Tabs.Content>
      </Tabs.Root>
      <div className={s.toast} role="status" aria-live="polite">
        {notice && (
          <>
            <CheckCircle2 size={16} />
            {notice}
            <button onClick={() => setNotice('')} aria-label="Fechar mensagem">
              <X size={14} />
            </button>
          </>
        )}
      </div>

      <Dialog.Root
        open={panel !== null}
        onOpenChange={(value) => {
          if (!value) setPanel(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className={s.overlay} />
          <Dialog.Content
            className={`${s.panel} fc-brand-scope ${portalFont.variable}`}
            onCloseAutoFocus={(e) => {
              e.preventDefault();
              focusBack.current?.focus();
            }}
          >
            <div className={s.panelHeader}>
              <span className={s.small}>{pos.join(' / ') || q.reference}</span>
              <Dialog.Title>{header}</Dialog.Title>
              <Dialog.Description>
                {q.description} · {q.destination}
              </Dialog.Description>
              <Dialog.Close
                className={s.panelClose}
                aria-label="Fechar detalhe"
              >
                <X size={21} />
              </Dialog.Close>
            </div>
            <div className={s.panelBody}>
              {selectedItem && (
                <>
                  <span className={s.neutral}>Mercadoria deste embarque</span>
                  <p className={s.panelLead}>{selectedItem.description}</p>
                  <div className={s.panelGrid}>
                    <Field label="PO" value={selectedItem.po} />
                    <Field label="Fornecedor" value={selectedItem.supplier} />
                    <Field
                      label={`Quantidade ${q.stage < 3 ? 'prevista' : 'embarcada'}`}
                      value={`${selectedItem.quantity} ${selectedItem.unit}`}
                    />
                    <Field
                      label="Quantidade comprada na PO"
                      value={
                        selectedItem.ordered === null
                          ? 'Não informada'
                          : `${selectedItem.ordered} ${selectedItem.unit}`
                      }
                    />
                    <Field
                      label="Valor unitário"
                      value={
                        selectedItem.unitValue === null
                          ? 'Não informado'
                          : money(selectedItem.unitValue, selectedItem.currency)
                      }
                    />
                    <Field
                      label="Valor neste embarque"
                      value={
                        selectedItem.unitValue === null
                          ? 'Não informado'
                          : money(
                              selectedItem.unitValue * selectedItem.quantity,
                              selectedItem.currency,
                            )
                      }
                    />
                  </div>
                  <div className={s.infoBox}>
                    <Info size={18} />
                    <p>
                      O restante da PO pode estar em outro embarque ou ainda não
                      ter sido alocado. Saldo disponível não calculado.
                    </p>
                  </div>
                  <h3>Origem da informação</h3>
                  <p>
                    {selectedItem.invoice} · linha {selectedItem.line} · versão
                    demonstrativa
                  </p>
                  <p className={s.small}>
                    O código identifica esta linha junto da PO e do fornecedor.
                    Part numbers iguais não unem mercadorias automaticamente.
                  </p>
                  <button
                    className={s.button}
                    onClick={() =>
                      open({
                        kind: 'document',
                        id:
                          selectedItem.invoice === 'INV-DEMO-091'
                            ? 'invoice91'
                            : 'invoice',
                      })
                    }
                  >
                    <FileText size={16} /> Ver documento de origem
                  </button>
                </>
              )}
              {selectedAlert && (
                <>
                  <span
                    className={
                      selectedAlert.state === 'Resolvida'
                        ? s.success
                        : selectedAlert.blocking
                          ? s.warning
                          : s.neutral
                    }
                  >
                    {selectedAlert.state}
                  </span>
                  <p className={s.panelLead}>{selectedAlert.detail}</p>
                  <div className={s.panelGrid}>
                    <Field
                      label={
                        selectedAlert.state === 'Resolvida'
                          ? 'Responsável pela ação concluída'
                          : 'Próxima ação de'
                      }
                      value={selectedAlert.owner}
                    />
                    <Field
                      label="Prazo"
                      value={
                        selectedAlert.deadline
                          ? shortDate(selectedAlert.deadline)
                          : 'Não informado'
                      }
                    />
                  </div>
                  <div className={s.evidence}>
                    <h3>Fonte da ocorrência</h3>
                    <p>{selectedAlert.source}</p>
                    <span className={s.small}>
                      Evidência fictícia para revisão de interface.
                    </span>
                  </div>
                  {selectedAlert.kind === 'eta' && (
                    <>
                      <div className={s.beforeAfter}>
                        <div>
                          <span>Previsão inicial</span>
                          <strong>{shortDate(q.firstEta)}</strong>
                        </div>
                        <ArrowRight size={20} />
                        <div>
                          <span>Última previsão</span>
                          <strong>{shortDate(q.eta)}</strong>
                        </div>
                      </div>
                      <p className={s.small}>
                        Marco: chegada ao porto de Santos. Impacto na entrega
                        final ainda desconhecido.
                      </p>
                    </>
                  )}
                  {selectedAlert.state !== 'Resolvida' && (
                    <p className={s.small}>
                      Você leu esta ocorrência. Ela continua ativa até a
                      conclusão da ação ou confirmação do fato.
                    </p>
                  )}
                  {selectedAlert.kind === 'booking' && (
                    <>
                      <h3>Booking proposto · v3</h3>
                      <div className={s.compare}>
                        <span>Saída solicitada</span>
                        <strong>11 set.</strong>
                        <span>Nova saída proposta</span>
                        <strong>14 set.</strong>
                        <span>Frete internacional</span>
                        <strong>USD 2.850,00 · sem alteração</strong>
                        <span>Chegada prevista</span>
                        <strong>24 set. · Santos</strong>
                      </div>
                      {selectedAlert.state !== 'Resolvida' && (
                        <>
                          <label className={s.checkbox}>
                            <input
                              type="checkbox"
                              checked={approved}
                              onChange={(e) => setApproved(e.target.checked)}
                            />{' '}
                            Revisei a versão v3 e a alteração de saída.
                          </label>
                          <button
                            className={s.primary}
                            disabled={!approved}
                            onClick={() => {
                              setQ(approveBooking(q));
                              setNotice(
                                'Booking v3 aprovado nesta prévia. Partida não confirmada.',
                              );
                            }}
                          >
                            Aprovar booking v3 <Check size={16} />
                          </button>
                        </>
                      )}
                    </>
                  )}
                  {['eta', 'pickup'].includes(selectedAlert.kind) && (
                    <button
                      className={s.primary}
                      onClick={() => open({ kind: 'update' })}
                    >
                      Solicitar atualização <ArrowRight size={16} />
                    </button>
                  )}
                </>
              )}
              {selectedDoc && (
                <>
                  <span
                    className={
                      selectedDoc.state === 'Pendente'
                        ? s.warning
                        : selectedDoc.state === 'Aprovado'
                          ? s.success
                          : s.neutral
                    }
                  >
                    {selectedDoc.state}
                  </span>
                  <div className={s.panelGrid}>
                    <Field label="Responsável" value={selectedDoc.owner} />
                    <Field label="Versão" value={selectedDoc.version} />
                    <Field
                      label="Arquivo"
                      value={selectedDoc.file ?? 'Ainda não enviado'}
                    />
                    <Field
                      label="Último registro"
                      value={selectedDoc.updated}
                    />
                  </div>
                  {selectedDoc.file && (
                    <>
                      <div className={s.documentPreview}>
                        <FileText size={30} />
                        <h3>{selectedDoc.name}</h3>
                        <p>Amostra de documento · dados fictícios</p>
                        <hr />
                        <Field label="Embarque" value={q.reference} />
                        <Field
                          label="POs vinculadas"
                          value={
                            selectedDoc.id.startsWith('invoice')
                              ? Array.from(
                                  new Set(
                                    q.items
                                      .filter(
                                        (i) => i.invoice === selectedDoc.file,
                                      )
                                      .map((i) => i.po),
                                  ),
                                ).join(' / ')
                              : pos.join(' / ')
                          }
                        />
                        <p>
                          Este espaço exibirá o documento original. Na prévia,
                          você pode conferir os dados e navegar até a
                          mercadoria.
                        </p>
                      </div>
                      <button className={s.button} onClick={downloadExample}>
                        <Download size={16} /> Baixar amostra (.txt)
                      </button>
                      <button
                        className={s.textButton}
                        onClick={() => goTab('cargo')}
                      >
                        Ver mercadorias vinculadas <ArrowRight size={14} />
                      </button>
                    </>
                  )}
                </>
              )}
              {actionDoc?.state === 'Pendente' && (
                <div className={s.upload}>
                  <h3>Enviar documento para análise</h3>
                  <label className={s.fileLabel}>
                    Selecionar arquivo
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.xlsx,.docx"
                      onChange={(e) => setFile(e.target.files?.[0]?.name ?? '')}
                    />
                  </label>
                  <button
                    className={s.textButton}
                    onClick={() => setFile('certificado-origem-exemplo.pdf')}
                  >
                    Usar arquivo de exemplo
                  </button>
                  {file && (
                    <p>
                      <FileText size={15} /> {file}
                    </p>
                  )}
                  <button
                    className={s.primary}
                    disabled={!file}
                    onClick={() => {
                      setQ(submitDocument(q, actionDoc.id, file));
                      setNotice(
                        'Envio simulado. Documento em análise; pendência de envio concluída.',
                      );
                    }}
                  >
                    Enviar para análise <ArrowRight size={16} />
                  </button>
                  <span className={s.small}>
                    Simulação local: o conteúdo do arquivo não é lido nem
                    enviado. A análise não é aprovada automaticamente.
                  </span>
                </div>
              )}
              {panel?.kind === 'alerts' && (
                <>
                  <div className={s.filterRow}>
                    <label>
                      Situação
                      <select
                        aria-label="Filtrar ocorrências"
                        value={alertFilter}
                        onChange={(e) => setAlertFilter(e.target.value)}
                      >
                        {['Ativas', 'Todas', 'Resolvidas'].map((v) => (
                          <option key={v}>{v}</option>
                        ))}
                      </select>
                    </label>
                    <span className={s.small}>
                      Ler não resolve uma ocorrência.
                    </span>
                  </div>
                  {q.alerts
                    .filter(
                      (a) =>
                        alertFilter === 'Todas' ||
                        (alertFilter === 'Ativas'
                          ? a.state !== 'Resolvida'
                          : a.state === 'Resolvida'),
                    )
                    .map((a) => (
                      <button
                        className={s.occurrenceCard}
                        key={a.id}
                        onClick={() => open({ kind: 'alert', id: a.id })}
                      >
                        <span>
                          <strong>{a.title}</strong>
                          <ChevronRight size={17} />
                        </span>
                        <span className={s.small}>
                          {a.owner} · {a.state}
                          {a.read ? ' · Lida' : ' · Nova'}
                        </span>
                      </button>
                    ))}
                </>
              )}
              {panel?.kind === 'milestone' && (
                <>
                  <span className={s.neutral}>
                    {Number(panel.id) < q.stage
                      ? 'Marco registrado'
                      : Number(panel.id) === q.stage
                        ? 'Etapa atual'
                        : 'Próximo marco'}
                  </span>
                  <p className={s.panelLead}>
                    {Number(panel.id) === 4
                      ? arrival.note
                      : Number(panel.id) > q.stage
                        ? 'Ainda não há confirmação deste marco. A previsão não equivale a um evento realizado.'
                        : 'Evento demonstrativo vinculado a este embarque.'}
                  </p>
                  <Field
                    label="Fonte necessária"
                    value={journeySteps[Number(panel.id)].source}
                  />
                  <p className={s.panelLead}>
                    {journeySteps[Number(panel.id)].detail}
                  </p>
                  <Field
                    label="Disponibilidade nesta prévia"
                    value="Dado fictício · integração e cobertura ainda não validadas"
                  />
                  <Field
                    label="Última atualização conhecida"
                    value={
                      Number(panel.id) === q.stage && Number(panel.id) >= 3
                        ? (q.updated ?? 'Não informada')
                        : 'Não informada para este marco'
                    }
                  />
                  <button className={s.button} onClick={() => goTab('history')}>
                    Ver histórico do embarque <ArrowRight size={15} />
                  </button>
                  {activeAlerts.length > 0 && (
                    <button
                      className={s.textButton}
                      onClick={() => open({ kind: 'alerts' })}
                    >
                      Consultar ocorrências
                    </button>
                  )}
                </>
              )}
              {panel?.kind === 'preferences' && (
                <>
                  <div className={s.infoBox}>
                    <Info size={18} />
                    <p>
                      Estas preferências controlam avisos deste embarque.
                      Pendências continuam visíveis no detalhe, mesmo com avisos
                      desativados.
                    </p>
                  </div>
                  <h3>Quero receber avisos sobre</h3>
                  <label className={s.checkbox}>
                    <input
                      type="checkbox"
                      checked={draftNotifications.changes}
                      onChange={(e) =>
                        setDraftNotifications({
                          ...draftNotifications,
                          changes: e.target.checked,
                        })
                      }
                    />{' '}
                    Mudanças de chegada e acompanhamento
                  </label>
                  <label className={s.checkbox}>
                    <input
                      type="checkbox"
                      checked={draftNotifications.documents}
                      onChange={(e) =>
                        setDraftNotifications({
                          ...draftNotifications,
                          documents: e.target.checked,
                        })
                      }
                    />{' '}
                    Documentos e aprovações
                  </label>
                  <p className={s.small}>
                    Preferências demonstrativas desta tela. Canais externos e
                    sincronização com Minhas Preferências ainda não estão
                    conectados.
                  </p>
                  <button
                    className={s.primary}
                    onClick={() => {
                      setNotifications(draftNotifications);
                      setPanel(null);
                      setNotice(
                        'Preferências salvas nesta aba. As ocorrências foram preservadas.',
                      );
                    }}
                  >
                    Salvar preferências
                  </button>
                </>
              )}
              {panel?.kind === 'update' && (
                <>
                  <p className={s.panelLead}>
                    Confira a mensagem antes de encaminhar ao responsável.
                  </p>
                  <Field
                    label="Destinatário"
                    value="Agente Demo · contato de exemplo"
                  />
                  <div className={s.messageDraft}>
                    Olá, preciso de uma atualização do embarque {q.reference}
                    {pos.length ? `, referente a ${pos.join(' e ')}` : ''}.
                    <br />
                    <br />
                    {arrival.tone === 'warning'
                      ? 'Podem confirmar a previsão de chegada e o andamento atual?'
                      : 'Podem confirmar o próximo marco e informar as pendências para a carga seguir?'}
                    <br />
                    <br />
                    {q.destination} · última previsão: {shortDate(q.eta)}.
                  </div>
                  <p className={s.small}>
                    Nenhuma mensagem será enviada. O registro abaixo permite
                    experimentar o acompanhamento da solicitação.
                  </p>
                  <button
                    className={s.primary}
                    onClick={() => {
                      setQ({
                        ...q,
                        events: [
                          {
                            id: `followup-${q.events.length}`,
                            date: 'Agora',
                            title: 'Solicitação de atualização simulada',
                            detail:
                              'Mensagem preparada para Agente Demo; nenhum envio externo.',
                            type: 'Acompanhamento',
                            owner: 'Você',
                          },
                          ...q.events,
                        ],
                      });
                      setPanel(null);
                      setNotice(
                        'Solicitação simulada no histórico. Ocorrências continuam ativas.',
                      );
                    }}
                  >
                    Simular solicitação <ArrowRight size={16} />
                  </button>
                </>
              )}
            </div>
            <div className={s.panelFooter}>
              <span>Protótipo · nenhuma ação externa</span>
              {panel?.kind !== 'preferences' && (
                <button
                  className={s.textButton}
                  onClick={() =>
                    goTab(
                      selectedItem
                        ? 'cargo'
                        : selectedDoc || selectedAlert?.kind === 'document'
                          ? 'documents'
                          : 'history',
                    )
                  }
                >
                  Ver no embarque <ArrowRight size={14} />
                </button>
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className={s.field}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
function PoGroup({
  po,
  items,
  collapsed,
  toggle,
  row,
}: {
  po: string;
  items: CargoItem[];
  collapsed: boolean;
  toggle: () => void;
  row: (i: CargoItem) => React.ReactNode;
}) {
  return (
    <>
      <tr className={s.poGroup}>
        <td colSpan={4}>
          <button aria-expanded={!collapsed} onClick={toggle}>
            {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
            <strong>{po}</strong>
            <span>{items.length} linhas</span>
            {items.some(
              (i) => i.ordered !== null && i.ordered > i.quantity,
            ) && <span className={s.partial}>Alocação parcial</span>}
          </button>
        </td>
      </tr>
      {!collapsed && items.map(row)}
    </>
  );
}
