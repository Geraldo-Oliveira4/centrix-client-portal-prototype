// Unit test do agrupamento da "Visão por PO" (RQ-12). Mesmo runner.
//
// O QUE ERRA EM SILENCIO AQUI:
//
//   1. O agrupamento NAO normalizar. "PO-2026-1955" e "po 2026/1955" viram dois
//      pedidos na tela, e a aba que existe para mostrar o PO dividido mostra o
//      contrario do que deveria.
//   2. A regua posicionar uma carga SEM data. Ela ganharia uma posicao
//      arbitraria que o cliente leria como uma previsao.
//   3. Uma data so espalhando as cargas por indice, desenhando uma diferenca de
//      prazo que nao existe.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  axisPercent,
  etaPositions,
  groupShipmentsByPo,
  matchesPoFilter,
  poGroupStatus,
  poTimelineAxis,
  shipmentBarPoints,
  shipmentProgress,
  splitPoCount,
  summarizePoGroups,
} from './po-overview.ts';
import type { PortalShipmentWithReview } from './shipment-po-merge.ts';

const RESOLVERS = { stateLabel: () => 'Em trânsito' };

const ship = (
  id: string,
  referencia: string,
  po: string | null,
  eta: string | null = null,
  extra: Partial<PortalShipmentWithReview> = {},
): PortalShipmentWithReview => ({
  id,
  referencia,
  client_reference: po,
  estado: 'embarcado',
  incoterm: 'FOB',
  modal: 'MARITIMO',
  tipo_embarque: 'FCL',
  tipo_despacho: 'DIRETO',
  carga_urgente: false,
  agente_nome: null,
  quotation_id: null,
  created_at: '2026-09-01T10:00:00.000Z',
  updated_at: null,
  tracking: eta
    ? {
        first_eta: eta,
        current_eta: eta,
        eta_is_actual: false,
        data_status: 'COMPLETE',
        last_milestone: null,
        last_milestone_at: null,
        is_mock: false,
      }
    : null,
  ...extra,
});

test('agrupa pelo numero do PO, e o rotulo e a grafia do cliente', () => {
  const groups = groupShipmentsByPo(
    [
      ship('a', 'EMB-1', 'PO-2026-1955'),
      ship('b', 'EMB-2', 'po 2026/1955'),
      ship('c', 'EMB-3', 'PO-2026-1960'),
    ],
    RESOLVERS,
  );
  assert.equal(groups.length, 2);
  assert.equal(groups[0].po, 'PO-2026-1955', 'a primeira grafia encontrada');
  assert.equal(groups[0].shipments.length, 2);
  assert.equal(groups[1].shipments.length, 1);
});

test('embarque SEM PO fica de fora — a aba e sobre POs', () => {
  const groups = groupShipmentsByPo(
    [ship('a', 'EMB-1', null), ship('b', 'EMB-2', '   '), ship('c', 'EMB-3', 'PO-1')],
    RESOLVERS,
  );
  assert.equal(groups.length, 1);
  assert.equal(groups[0].po, 'PO-1');
});

test('os POs DIVIDIDOS vem primeiro — sao o caso que a aba existe para mostrar', () => {
  const groups = groupShipmentsByPo(
    [
      ship('a', 'EMB-1', 'PO-A'),
      ship('b', 'EMB-2', 'PO-B'),
      ship('c', 'EMB-3', 'PO-B'),
      ship('d', 'EMB-4', 'PO-B'),
    ],
    RESOLVERS,
  );
  assert.equal(groups[0].po, 'PO-B');
  assert.equal(groups[0].shipments.length, 3);
  assert.equal(splitPoCount(groups), 1);
});

test('dentro do grupo, quem tem data vem antes, da mais cedo a mais tarde', () => {
  const [group] = groupShipmentsByPo(
    [
      ship('a', 'EMB-3', 'PO-A', null),
      ship('b', 'EMB-1', 'PO-A', '2026-11-20'),
      ship('c', 'EMB-2', 'PO-A', '2026-10-05'),
    ],
    RESOLVERS,
  );
  assert.deepEqual(
    group.shipments.map((s) => s.reference),
    ['EMB-2', 'EMB-1', 'EMB-3'],
  );
  assert.equal(group.firstEta?.slice(0, 10), '2026-10-05');
  assert.equal(group.lastEta?.slice(0, 10), '2026-11-20');
});

test('grupo sem data nenhuma nao inventa uma regua', () => {
  const [group] = groupShipmentsByPo(
    [ship('a', 'EMB-1', 'PO-A'), ship('b', 'EMB-2', 'PO-A')],
    RESOLVERS,
  );
  assert.equal(group.firstEta, null);
  assert.equal(group.lastEta, null);
  assert.equal(etaPositions(group).size, 0);
});

test('a regua posiciona SO o que tem data', () => {
  const [group] = groupShipmentsByPo(
    [
      ship('a', 'EMB-1', 'PO-A', '2026-10-01'),
      ship('b', 'EMB-2', 'PO-A', '2026-11-01'),
      ship('c', 'EMB-3', 'PO-A', null),
    ],
    RESOLVERS,
  );
  const pos = etaPositions(group);
  assert.equal(pos.size, 2);
  assert.equal(pos.get('a'), 0);
  assert.equal(pos.get('b'), 100);
  assert.equal(pos.has('c'), false);
});

test('uma data so (ou todas iguais) fica no MEIO, nao espalhada por indice', () => {
  const [um] = groupShipmentsByPo([ship('a', 'EMB-1', 'PO-A', '2026-10-01')], RESOLVERS);
  assert.equal(etaPositions(um).get('a'), 50);

  const [iguais] = groupShipmentsByPo(
    [
      ship('a', 'EMB-1', 'PO-A', '2026-10-01'),
      ship('b', 'EMB-2', 'PO-A', '2026-10-01'),
    ],
    RESOLVERS,
  );
  const pos = etaPositions(iguais);
  assert.equal(pos.get('a'), 50);
  assert.equal(pos.get('b'), 50);
});

test('a posicao do meio e proporcional a DATA, nao a ordem', () => {
  const [group] = groupShipmentsByPo(
    [
      ship('a', 'EMB-1', 'PO-A', '2026-10-01'),
      ship('b', 'EMB-2', 'PO-A', '2026-10-11'),
      ship('c', 'EMB-3', 'PO-A', '2026-10-41'.replace('41', '31')),
    ],
    RESOLVERS,
  );
  const pos = etaPositions(group);
  assert.equal(pos.get('a'), 0);
  assert.ok(Math.abs((pos.get('b') as number) - 100 / 3) < 0.5);
  assert.equal(pos.get('c'), 100);
});

test('tracking INCOMPLETE conta como AUSENCIA de data, nao como data', () => {
  const [group] = groupShipmentsByPo(
    [
      ship('a', 'EMB-1', 'PO-A', '2026-10-01', {
        tracking: {
          first_eta: null,
          current_eta: null,
          eta_is_actual: null,
          data_status: 'INCOMPLETE',
          last_milestone: null,
          last_milestone_at: null,
          is_mock: false,
        },
      }),
    ],
    RESOLVERS,
  );
  assert.equal(group.shipments[0].eta, null);
  assert.equal(group.firstEta, null);
});

test('chegada confirmada e marcada como tal', () => {
  const [group] = groupShipmentsByPo(
    [
      ship('a', 'EMB-1', 'PO-A', '2026-10-01', {
        tracking: {
          first_eta: '2026-10-01',
          current_eta: '2026-10-01',
          eta_is_actual: true,
          data_status: 'COMPLETE',
          last_milestone: null,
          last_milestone_at: null,
          is_mock: false,
        },
      }),
    ],
    RESOLVERS,
  );
  assert.equal(group.shipments[0].etaIsActual, true);
});

test('o rotulo de estado vem de quem chamou, nao daqui', () => {
  const [group] = groupShipmentsByPo([ship('a', 'EMB-1', 'PO-A')], {
    stateLabel: (s) => `estado de ${s.referencia}`,
  });
  assert.equal(group.shipments[0].stateLabel, 'estado de EMB-1');
});

test('carteira vazia devolve zero grupos', () => {
  assert.deepEqual(groupShipmentsByPo([], RESOLVERS), []);
  assert.equal(splitPoCount([]), 0);
});

// ---- segunda versão (Prompt 4) ----

const NOW = new Date('2026-10-01T12:00:00.000Z');
const tracked = (eta: string, first: string, extra: Record<string, unknown> = {}) => ({
  first_eta: first,
  current_eta: eta,
  eta_is_actual: false,
  data_status: 'COMPLETE' as const,
  last_milestone: null,
  last_milestone_at: null,
  is_mock: false,
  ...extra,
});

test('faixa: até 7 dias, até 30, depois, sem previsão e já chegou', () => {
  const groups = groupShipmentsByPo(
    [
      ship('a', 'EMB-A', 'PO-A', '2026-10-05'),
      ship('b', 'EMB-B', 'PO-B', '2026-10-20'),
      ship('c', 'EMB-C', 'PO-C', '2026-12-01'),
      ship('d', 'EMB-D', 'PO-D', null),
      ship('e', 'EMB-E', 'PO-E', null, { tracking: { ...tracked('2026-09-20', '2026-09-20'), eta_is_actual: true } }),
    ],
    RESOLVERS,
  );
  const byPo = Object.fromEntries(groups.map((g) => [g.po, poGroupStatus(g, NOW).bucket]));
  assert.deepEqual(byPo, { 'PO-A': 'semana', 'PO-B': 'mes', 'PO-C': 'depois', 'PO-D': 'sem_previsao', 'PO-E': 'chegou' });
});

test('risco: atraso da companhia (>3 dias), exceção e previsão vencida; atenção de 1-3 dias não', () => {
  const groups = groupShipmentsByPo(
    [
      ship('a', 'EMB-A', 'PO-A', null, { tracking: tracked('2026-10-20', '2026-10-10') }),
      ship('b', 'EMB-B', 'PO-B', null, { tracking: tracked('2026-10-12', '2026-10-10') }),
      ship('c', 'EMB-C', 'PO-C', null, { estado: 'postergado' }),
      ship('d', 'EMB-D', 'PO-D', '2026-09-25'),
    ],
    RESOLVERS,
  );
  const risk = Object.fromEntries(groups.map((g) => [g.po, poGroupStatus(g, NOW).atRisk]));
  assert.deepEqual(risk, { 'PO-A': true, 'PO-B': false, 'PO-C': true, 'PO-D': true });
  const d = poGroupStatus(groups.find((g) => g.po === 'PO-D')!, NOW);
  assert.ok(d.riskReasons.includes('Previsão de chegada vencida'));
});

test('chips: contagem e filtro usam a MESMA regra', () => {
  const groups = groupShipmentsByPo(
    [
      ship('a', 'EMB-A', 'PO-A', '2026-10-05'),
      ship('a2', 'EMB-A2', 'PO-A', null),
      ship('b', 'EMB-B', 'PO-B', '2026-11-20'),
    ],
    RESOLVERS,
  );
  const statuses = groups.map((g) => poGroupStatus(g, NOW));
  const summary = summarizePoGroups(statuses);
  assert.deepEqual(summary, { ativos: 2, sete_dias: 1, risco: 0, sem_previsao: 1 });
  for (const key of ['ativos', 'sete_dias', 'risco', 'sem_previsao'] as const)
    assert.equal(statuses.filter((st) => matchesPoFilter(st, key)).length, summary[key]);
});

test('barra: só os pontos com data, na ordem prontidão -> embarque -> chegada', () => {
  const [group] = groupShipmentsByPo(
    [ship('a', 'EMB-A', 'PO-A', null, { tracking: tracked('2026-10-20', '2026-10-20', { last_milestone: 'OCEAN_TRANSIT', last_milestone_at: '2026-09-28' }) })],
    { ...RESOLVERS, readyDate: () => '2026-09-15' },
  );
  assert.deepEqual(shipmentBarPoints(group.shipments[0]).map((p) => p.kind), ['prontidao', 'embarque', 'chegada']);
  const [bare] = groupShipmentsByPo([ship('b', 'EMB-B', 'PO-B', '2026-10-20')], RESOLVERS);
  assert.deepEqual(shipmentBarPoints(bare.shipments[0]).map((p) => p.kind), ['chegada']);
  const [none] = groupShipmentsByPo([ship('c', 'EMB-C', 'PO-C', null)], RESOLVERS);
  assert.deepEqual(shipmentBarPoints(none.shipments[0]), []);
});

test('partida só vem do marco OCEAN_TRANSIT datado; marco posterior não data a partida', () => {
  const [group] = groupShipmentsByPo(
    [ship('a', 'EMB-A', 'PO-A', null, { tracking: tracked('2026-10-20', '2026-10-20', { last_milestone: 'ARRIVAL', last_milestone_at: '2026-10-19' }) })],
    RESOLVERS,
  );
  assert.equal(group.shipments[0].departureDate, null);
  assert.equal(group.shipments[0].arrived, true);
});

test('eixo compartilhado contém hoje e todas as datas, e posiciona dentro de 0..100', () => {
  const groups = groupShipmentsByPo(
    [ship('a', 'EMB-A', 'PO-A', '2026-10-05'), ship('b', 'EMB-B', 'PO-B', '2026-12-20')],
    { ...RESOLVERS, readyDate: () => '2026-09-10' },
  );
  const axis = poTimelineAxis(groups, NOW);
  assert.ok(axisPercent(axis, '2026-09-10') > 0 && axisPercent(axis, '2026-12-20') < 100);
  const todayPct = axisPercent(axis, axis.todayDay);
  assert.ok(todayPct > axisPercent(axis, '2026-09-10') && todayPct < axisPercent(axis, '2026-10-05'));
  assert.ok(axis.ticks.some((t) => t.label === 'nov'));
});

test('progresso pela etapa real; exceção não tem lugar na régua', () => {
  const [g] = groupShipmentsByPo(
    [
      ship('a', 'EMB-A', 'PO-A', null, { estado: 'solicitado' }),
      ship('b', 'EMB-B', 'PO-A', null, { estado: 'postergado' }),
    ],
    RESOLVERS,
  );
  const byRef = Object.fromEntries(g.shipments.map((s) => [s.reference, shipmentProgress(s)]));
  assert.ok((byRef['EMB-A'] as number) > 0 && (byRef['EMB-A'] as number) < 0.5);
  assert.equal(byRef['EMB-B'], null);
});
