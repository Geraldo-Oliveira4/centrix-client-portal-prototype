import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  PO_EXAMPLE_PREFIX,
  buildPoOverviewExample,
  dayFrom,
} from './po-overview-examples.ts';
import {
  groupShipmentsByPo,
  poGroupStatus,
} from './po-overview.ts';

function run(now: Date) {
  const ex = buildPoOverviewExample(now);
  const groups = groupShipmentsByPo(ex.shipments, {
    stateLabel: (s) => s.estado,
    readyDate: (s) => ex.readyDates[s.id] ?? null,
    items: (s) => ex.items[s.id] ?? [],
  });
  return { ex, groups, statuses: groups.map((g) => poGroupStatus(g, now)) };
}

test('datas relativas a hoje: chegadas em 3, 12 e 40 dias, em qualquer dia', () => {
  for (const iso of ['2026-10-01T12:00:00Z', '2027-03-15T08:00:00Z']) {
    const now = new Date(iso);
    const { ex } = run(now);
    const etas = ex.shipments
      .map((s) => s.tracking?.current_eta)
      .filter(Boolean);
    for (const days of [3, 12, 40])
      assert.ok(
        etas.includes(dayFrom(now, days)),
        `falta chegada em ${days} dias`,
      );
  }
});

test('um de cada: PO dividido, em risco, sem previsão, já chegou, e as três faixas', () => {
  const { groups, statuses } = run(new Date('2026-10-01T12:00:00Z'));
  assert.ok(
    groups.some((g) => g.shipments.length === 2),
    'PO dividido em 2',
  );
  const buckets = statuses.map((s) => s.bucket);
  for (const b of ['atrasado', 'semana', 'mes', 'depois', 'sem_previsao', 'chegou'])
    assert.ok(buckets.includes(b as never), `falta faixa ${b}`);
  assert.equal(statuses.filter((s) => s.atRisk).length, 2);
  assert.equal(statuses.filter((s) => s.withoutForecast > 0).length, 1);
  assert.ok(
    statuses.some(
      (s) => s.daysToNext != null && s.daysToNext >= 0 && s.daysToNext <= 7,
    ),
  );
});

test('tudo fictício e marcado: prefixo de exemplo e rastreamento is_mock', () => {
  const { ex } = run(new Date('2026-10-01T12:00:00Z'));
  for (const s of ex.shipments) {
    assert.ok(s.client_reference?.startsWith(PO_EXAMPLE_PREFIX));
    if (s.tracking) assert.equal(s.tracking.is_mock, true);
  }
});
