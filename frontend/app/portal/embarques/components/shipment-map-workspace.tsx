'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUpRight,
  Info,
  Search,
  X,
} from 'lucide-react';
import type { PortalShipment } from '@/types/portal-shipment';
import { ESTADO_DESCRIPTIONS, ESTADO_LABELS } from '@/types/portal-shipment';
import { useMyQuotations } from '@/hooks/use-portal-quotations';
import { collectHomeActions } from '../../home/lib/home-actions';
import { flattenQuotations } from '../../inteligencia/lib/intel-helpers';
import {
  indexQuotations,
  routePartsOf,
} from '../../inteligencia/lib/shipment-dimensions';
import { ProvenanceBadge } from '../../_shared/provenance-badge';
import {
  buildShipmentOverview,
  compareShipmentOverview,
  hasArrived,
  SHIPMENT_OVERVIEW_LABELS,
  type ShipmentOverviewKey,
} from '../lib/shipment-overview';
import { arrivalDay, formatShipmentEta } from '../lib/shipment-date';
import { delayRiskFromTracking } from '../lib/delay-risk';
import {
  filterShipments,
  SHIPMENT_FILTERS,
  type ShipmentFilterKey,
} from '../lib/shipment-filters';
import { originPortOf, portFromQuotationOrigin } from '../lib/port-coordinates';
import { REAL_STEPS } from '../lib/real-steps';
import { ShipmentMapCanvas } from './shipment-map-canvas';
import styles from './shipment-map-workspace.module.css';

const METRICS: ShipmentOverviewKey[] = ['action', 'delayed', 'upcoming'];
const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
const detailHref = (id: string) =>
  `/portal/embarques/${encodeURIComponent(id)}`;

export function ShipmentMapWorkspace({
  shipments,
  initialFilter,
}: {
  shipments: PortalShipment[];
  initialFilter?: ShipmentFilterKey | null;
}) {
  const { data } = useMyQuotations();
  const quotations = useMemo(
    () => indexQuotations(flattenQuotations(data)),
    [data],
  );
  const [now] = useState(() => new Date());
  const [metric, setMetric] = useState<ShipmentOverviewKey | null>(null);
  const [legacyFilter, setLegacyFilter] = useState(initialFilter ?? null);
  const [query, setQuery] = useState('');
  const [selection, setSelection] = useState<string[]>([]);
  const [originSelection, setOriginSelection] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const mapSection = useRef<HTMLElement>(null);
  const lastTrigger = useRef<HTMLElement | null>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const { groups, actionsByShipment } = useMemo(
    () =>
      buildShipmentOverview(
        shipments,
        collectHomeActions({
          shipments,
          buckets: {},
          realSteps: REAL_STEPS,
          now,
        }),
        now,
      ),
    [shipments, now],
  );
  const rows = useMemo(
    () =>
      shipments.map((shipment) => {
        const quotation = quotations.get(shipment.quotation_id ?? '');
        return {
          shipment,
          title:
            quotation?.product?.trim() ||
            shipment.client_reference ||
            shipment.referencia,
          route: routePartsOf(shipment, quotations),
          port: originPortOf(shipment.referencia, quotation?.origin),
          illustrativeOrigin: !portFromQuotationOrigin(quotation?.origin),
        };
      }),
    [shipments, quotations],
  );
  const visible = useMemo(() => {
    const legacyIds = new Set(
      filterShipments(shipments, legacyFilter).map((s) => s.id),
    );
    return rows
      .filter(
        (row) =>
          legacyIds.has(row.shipment.id) &&
          (!metric || groups[metric].has(row.shipment.id)) &&
          normalize(
            `${row.title} ${row.shipment.referencia} ${row.shipment.client_reference ?? ''} ${row.route.origin} ${row.route.destination}`,
          ).includes(normalize(query.trim())),
      )
      .sort((a, b) =>
        compareShipmentOverview(a.shipment, b.shipment, groups, now, metric),
      );
  }, [shipments, rows, legacyFilter, metric, groups, now, query]);
  const selected = visible.find((row) => row.shipment.id === selectedId);
  const selectedRows = visible.filter((row) =>
    selection.includes(row.shipment.id),
  );
  const plotted = useMemo(
    () =>
      visible.map((row) => ({
        id: row.shipment.id,
        port: row.port,
        attention:
          groups.action.has(row.shipment.id) ||
          groups.delayed.has(row.shipment.id) ||
          row.shipment.carga_urgente ||
          ['postergado', 'booking_divergente'].includes(row.shipment.estado),
      })),
    [visible, groups],
  );
  const focused = selected ? [selected] : selectedRows;
  const focus = focused.length
    ? {
        lat: focused.reduce((n, row) => n + row.port.lat, 0) / focused.length,
        lon: focused.reduce((n, row) => n + row.port.lon, 0) / focused.length,
      }
    : null;

  function clearSelection(restoreFocus = false) {
    setSelection([]);
    setOriginSelection([]);
    setSelectedId(null);
    if (restoreFocus) lastTrigger.current?.focus({ preventScroll: true });
  }
  function chooseGroup(ids: string[]) {
    lastTrigger.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setSelection(ids);
    setOriginSelection(ids);
    setSelectedId(ids.length === 1 ? ids[0] : null);
  }
  function chooseShipment(id: string, scroll = false) {
    const row = visible.find((row) => row.shipment.id === id);
    if (!row) return;
    if (scroll) lastTrigger.current = document.getElementById(`map-open-${id}`);
    setOriginSelection(
      visible
        .filter((r) => r.port.key === row.port.key)
        .map((r) => r.shipment.id),
    );
    setSelection([id]);
    setSelectedId(id);
    if (scroll)
      mapSection.current?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'instant'
          : 'smooth',
        block: 'start',
      });
  }
  useEffect(() => {
    if (!selection.length) return;
    closeButton.current?.focus({ preventScroll: true });
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') clearSelection(true);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // Selection alone changes focus; background data refreshes do not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection.join('|'), selectedId]);
  function changeFilter(next: ShipmentOverviewKey | null) {
    setMetric(next);
    setLegacyFilter(null);
    clearSelection();
  }
  const badge = (s: PortalShipment) =>
    s.carga_urgente
      ? 'Urgente'
      : groups.action.has(s.id)
        ? 'Precisa de você'
        : groups.delayed.has(s.id)
          ? 'Chegada alterada'
          : hasArrived(s, now)
            ? 'Chegada confirmada'
            : ESTADO_LABELS[s.estado];
  const tone = (s: PortalShipment) =>
    s.carga_urgente
      ? styles.urgent
      : groups.action.has(s.id) || groups.delayed.has(s.id)
        ? styles.attention
        : styles.normal;
  const etaOf = (s: PortalShipment) =>
    s.tracking?.data_status === 'INCOMPLETE' ||
    arrivalDay(s.tracking?.current_eta) == null
      ? 'Sem previsão'
      : formatShipmentEta(s.tracking?.current_eta);
  const panelOpen = selectedRows.length > 0;
  const current = selected?.shipment;
  const actions = current ? (actionsByShipment.get(current.id) ?? []) : [];
  const risk = current ? delayRiskFromTracking(current.tracking) : null;
  const groupNames = Array.from(
    new Set(selectedRows.map((row) => row.port.name)),
  ).join(' · ');

  return (
    <div className={styles.workspace}>
      <div className={styles.filters} aria-label="Recortes da carteira">
        <button
          className={`${styles.chip} ${!metric && !legacyFilter ? styles.active : ''}`}
          aria-pressed={!metric && !legacyFilter}
          onClick={() => changeFilter(null)}
        >
          Todos <b>{shipments.length}</b>
        </button>
        {METRICS.map((key) => (
          <button
            key={key}
            className={`${styles.chip} ${metric === key ? styles.active : ''}`}
            aria-pressed={metric === key}
            onClick={() => changeFilter(metric === key ? null : key)}
          >
            {SHIPMENT_OVERVIEW_LABELS[key]} <b>{groups[key].size}</b>
          </button>
        ))}
        {legacyFilter && (
          <button
            className={`${styles.chip} ${styles.active}`}
            onClick={() => changeFilter(null)}
          >
            {SHIPMENT_FILTERS.find((f) => f.key === legacyFilter)?.label}{' '}
            <X size={12} />
          </button>
        )}
        <span className={styles.overlap}>Recortes podem se sobrepor</span>
      </div>
      <section
        ref={mapSection}
        className={styles.mapSection}
        aria-label="Mapa e resumo de embarques"
      >
        <div className={styles.mapArea}>
          <div className={styles.mapTitle}>
            <span className={styles.eyebrow}>ORIGENS DA SUA CARTEIRA</span>
            <h2>
              {selected
                ? `${selected.route.origin} → ${selected.route.destination}`
                : panelOpen
                  ? groupNames
                  : 'De onde vêm suas cargas'}
            </h2>
            <p>
              {selected
                ? `${selected.title} · ${selected.shipment.referencia}`
                : `${new Set(plotted.map((p) => p.port.key)).size} origens · ${visible.length} embarques neste recorte`}
            </p>
          </div>
          <ShipmentMapCanvas
            plotted={plotted}
            focus={focus}
            selectedIds={selection}
            onSelect={chooseGroup}
            onReset={() => clearSelection()}
          />
          {!visible.length && (
            <div className={styles.mapEmpty}>
              Nenhum embarque neste recorte.
            </div>
          )}
        </div>
        {panelOpen && (
          <aside className={styles.detail} aria-label="Resumo da seleção">
            <div className={styles.detailScroll}>
              <div className={styles.detailTop}>
                {selected && originSelection.length > 1 ? (
                  <button
                    onClick={() => {
                      setSelectedId(null);
                      setSelection(originSelection);
                    }}
                    className={styles.back}
                  >
                    <ArrowLeft size={13} /> Embarques desta origem
                  </button>
                ) : (
                  <span className={styles.eyebrow}>
                    {selected ? 'RESUMO DO EMBARQUE' : 'ORIGEM SELECIONADA'}
                  </span>
                )}
                <button
                  ref={closeButton}
                  className={styles.close}
                  onClick={() => clearSelection(true)}
                  aria-label="Fechar resumo"
                >
                  <X size={18} />
                </button>
              </div>
              {selected && current ? (
                <>
                  <span className={`${styles.badge} ${tone(current)}`}>
                    {badge(current)}
                  </span>
                  <h3>{selected.title}</h3>
                  <p className={styles.sub}>
                    {current.client_reference
                      ? `PO ${current.client_reference} · `
                      : ''}
                    {current.referencia}
                  </p>
                  <div className={styles.route}>
                    <span>
                      {selected.route.origin}
                      <small>Origem</small>
                    </span>
                    <span>→</span>
                    <span>
                      {selected.route.destination}
                      <small>Destino</small>
                    </span>
                  </div>
                  <div className={styles.arrival}>
                    <label>
                      {hasArrived(current, now)
                        ? 'CHEGADA CONFIRMADA'
                        : 'CHEGADA PREVISTA'}{' '}
                      AO PORTO / AEROPORTO
                    </label>
                    <strong>{etaOf(current)}</strong>
                    {groups.delayed.has(current.id) && (
                      <span className={styles.delta}>
                        +{risk?.deltaDays} dias
                      </span>
                    )}
                    {current.tracking?.first_eta && (
                      <small>
                        Primeira previsão:{' '}
                        {formatShipmentEta(current.tracking.first_eta)}
                      </small>
                    )}
                  </div>
                  {current.tracking?.is_mock && (
                    <ProvenanceBadge provenance="preview" />
                  )}
                  <div className={styles.nextAction}>
                    <strong>
                      {actions[0]?.title ??
                        (current.estado === 'postergado' ||
                        current.estado === 'booking_divergente'
                          ? 'Acompanhar a tratativa'
                          : 'Acompanhar o próximo marco')}
                    </strong>
                    <p>
                      {actions[0]?.description ??
                        ESTADO_DESCRIPTIONS[current.estado]}
                    </p>
                    <small>
                      {actions.length
                        ? 'Ação do cliente · prazo não informado'
                        : 'Acompanhamento da operação · sem ação sua registrada'}
                    </small>
                    {actions.length > 1 && (
                      <small>
                        Mais {actions.length - 1}{' '}
                        {actions.length === 2
                          ? 'pendência no detalhe'
                          : 'pendências no detalhe'}
                        .
                      </small>
                    )}
                  </div>
                  <details className={styles.context}>
                    <summary>Mais contexto</summary>
                    <p>Etapa: {ESTADO_LABELS[current.estado]}.</p>
                    <p>Agente: {current.agente_nome || 'Não informado'}.</p>
                    <p>Disponibilidade na fábrica: sem previsão registrada.</p>
                    <p>
                      Última atualização do cadastro:{' '}
                      {current.updated_at
                        ? new Date(current.updated_at).toLocaleString('pt-BR')
                        : 'não informada'}
                      . Este horário não comprova atualização do rastreamento.
                    </p>
                    <p>
                      {selected.illustrativeOrigin
                        ? 'Origem ilustrativa neste mapa; não resolvida a partir da cotação.'
                        : 'Origem resolvida a partir da cotação vinculada.'}{' '}
                      A ligação a Santos é uma referência visual, não
                      comprovação do destino contratado.
                    </p>
                  </details>
                </>
              ) : (
                <>
                  <h3>{groupNames}</h3>
                  <p className={styles.sub}>
                    {selectedRows.length} embarques · selecione uma carga
                  </p>
                  {selectedRows.map((row) => (
                    <button
                      key={row.shipment.id}
                      className={styles.groupCard}
                      onClick={() => chooseShipment(row.shipment.id)}
                    >
                      <span className={`${styles.badge} ${tone(row.shipment)}`}>
                        {badge(row.shipment)}
                      </span>
                      <strong>{row.title}</strong>
                      <p>
                        {row.shipment.client_reference
                          ? `PO ${row.shipment.client_reference} · `
                          : ''}
                        {row.shipment.referencia}
                      </p>
                      <small>
                        {row.route.origin} · {etaOf(row.shipment)}{' '}
                        <ArrowUpRight size={12} />
                      </small>
                    </button>
                  ))}
                </>
              )}
            </div>
            {current && (
              <div className={styles.detailFooter}>
                <Link className={styles.primary} href={detailHref(current.id)}>
                  Ver detalhe do embarque <ArrowUpRight size={16} />
                </Link>
                <button
                  className={styles.locate}
                  onClick={() => {
                    const row = document.getElementById(
                      `map-open-${current.id}`,
                    );
                    row?.scrollIntoView({
                      behavior: window.matchMedia(
                        '(prefers-reduced-motion: reduce)',
                      ).matches
                        ? 'instant'
                        : 'smooth',
                      block: 'center',
                    });
                    row?.focus({ preventScroll: true });
                  }}
                >
                  Localizar na lista <ArrowDown size={13} />
                </button>
              </div>
            )}
          </aside>
        )}
      </section>
      <div className={styles.mapNote}>
        <span>
          <Info size={13} /> Pontos indicam portos de origem, não a posição do
          navio. Origens sem cotação usam referências ilustrativas; Santos é o
          destino visual das linhas.
        </span>
        <span>A seleção preserva a carteira abaixo.</span>
      </div>
      <section aria-label="Embarques correntes" className={styles.listSection}>
        <div className={styles.listHeading}>
          <div>
            <span className={styles.eyebrow}>SUA CARTEIRA</span>
            <h2>
              Embarques em acompanhamento <span>{visible.length}</span>
            </h2>
            <p>
              {metric === 'upcoming'
                ? 'Da chegada mais próxima à mais distante.'
                : 'Ações pendentes primeiro. Urgência e chegada ordenam os embarques de cada grupo.'}
            </p>
          </div>
          <label className={styles.search}>
            <Search size={15} />
            <input
              type="search"
              value={query}
              aria-label="Buscar carga, PO ou embarque"
              placeholder="Buscar carga, PO ou embarque"
              onChange={(e) => {
                setQuery(e.target.value);
                clearSelection();
              }}
            />
          </label>
        </div>
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>PRIORIDADE</th>
                <th>CARGA / REFERÊNCIA</th>
                <th>ROTA</th>
                <th>CHEGADA AO DESTINO</th>
                <th>PRÓXIMO PASSO</th>
                <th>
                  <span className="sr-only">Detalhe</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const s = row.shipment,
                  action = actionsByShipment.get(s.id)?.[0];
                return (
                  <tr
                    key={s.id}
                    className={`${styles.shipRow} ${selectedId === s.id ? styles.selected : selection.includes(s.id) ? styles.originMatch : ''}`}
                    aria-current={selectedId === s.id || undefined}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('a,button')) return;
                      chooseShipment(s.id, true);
                    }}
                  >
                    <td>
                      <span className={`${styles.badge} ${tone(s)}`}>
                        {badge(s)}
                      </span>
                      {s.carga_urgente && (
                        <small>Criticidade indicada na carga</small>
                      )}
                    </td>
                    <td>
                      <button
                        id={`map-open-${s.id}`}
                        className={styles.cellButton}
                        onClick={() => chooseShipment(s.id, true)}
                        aria-label={`Ver resumo de ${s.referencia}`}
                      >
                        {row.title}
                      </button>
                      <small>
                        {s.client_reference
                          ? `PO ${s.client_reference} · `
                          : ''}
                        {s.referencia}
                      </small>
                    </td>
                    <td>
                      {row.route.origin} → {row.route.destination}
                      <small>{ESTADO_LABELS[s.estado]}</small>
                    </td>
                    <td>
                      <strong>{etaOf(s)}</strong>
                      <small>
                        {hasArrived(s, now)
                          ? 'Chegada confirmada'
                          : groups.delayed.has(s.id)
                            ? `Antes: ${formatShipmentEta(s.tracking?.first_eta)}`
                            : 'Previsão de chegada'}
                      </small>
                      {s.tracking?.is_mock && (
                        <ProvenanceBadge provenance="preview" />
                      )}
                    </td>
                    <td>
                      {action?.title ?? 'Acompanhar próximo marco'}
                      <small>
                        {action
                          ? 'Ação do cliente · sem prazo informado'
                          : 'Sem ação sua registrada'}
                      </small>
                    </td>
                    <td>
                      <Link
                        href={detailHref(s.id)}
                        className={styles.rowLink}
                        aria-label={`Ver detalhe de ${s.referencia}`}
                      >
                        <ArrowUpRight size={17} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!visible.length && (
            <div className={styles.empty}>
              Nenhum embarque encontrado.{' '}
              <button
                onClick={() => {
                  setQuery('');
                  changeFilter(null);
                }}
              >
                Limpar filtros e busca
              </button>
            </div>
          )}
        </div>
        <p className={styles.listFoot}>
          Contagem por embarque · chegada ao porto ou aeroporto não equivale à
          disponibilidade na fábrica.
        </p>
      </section>
    </div>
  );
}
