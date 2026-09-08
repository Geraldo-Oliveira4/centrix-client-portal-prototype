import test from 'node:test';
import assert from 'node:assert/strict';
import { arrivalDay, formatShipmentEta } from './shipment-date.ts';

test('date-only and midnight ISO display the same arrival day in Brazil', () => {
  const previous = process.env.TZ;
  process.env.TZ = 'America/Sao_Paulo';
  try {
    for (const input of ['2026-09-14', '2026-09-14T00:00:00.000Z']) {
      assert.equal(arrivalDay(input), Date.UTC(2026, 8, 14));
      assert.match(formatShipmentEta(input), /^14 de set\./);
      assert.match(formatShipmentEta(input, true), /^14 de setembro/);
    }
  } finally {
    if (previous == null) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});
test('invalid or absent ETAs have no displayed date', () => {
  for (const input of [null, undefined, '', 'not-a-date']) {
    assert.equal(arrivalDay(input), null);
    assert.equal(formatShipmentEta(input), '—');
  }
});
