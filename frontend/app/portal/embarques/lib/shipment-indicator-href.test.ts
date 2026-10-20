import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  isShipmentListRecorte,
  SHIPMENT_INDICATOR_KEYS,
  shipmentIndicatorHref,
} from './shipment-indicators.ts';

const PORTAL = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

test('every Home chip opens the shipment list with its own recorte', () => {
  for (const key of SHIPMENT_INDICATOR_KEYS) {
    const href = shipmentIndicatorHref(key);
    const url = new URL(href, 'http://portal.local');
    assert.equal(url.pathname, '/portal/embarques');
    assert.equal(url.searchParams.get('tab'), 'lista');
    assert.equal(url.searchParams.get('indicador'), key);
  }
});

test('the list accepts every indicator key as a recorte (no chip lands unfiltered)', () => {
  for (const key of SHIPMENT_INDICATOR_KEYS) {
    const param = new URL(shipmentIndicatorHref(key), 'http://portal.local')
      .searchParams.get('indicador');
    assert.ok(isShipmentListRecorte(param), `${key} not accepted`);
  }
});

test('the five destinations are distinct', () => {
  const hrefs = new Set(SHIPMENT_INDICATOR_KEYS.map(shipmentIndicatorHref));
  assert.equal(hrefs.size, SHIPMENT_INDICATOR_KEYS.length);
});

test('Home banner and Central use the same href rule, not an inline template', () => {
  const strip = readFileSync(
    resolve(PORTAL, 'embarques/components/shipment-indicator-strip.tsx'),
    'utf8',
  );
  const central = readFileSync(resolve(PORTAL, 'visao-geral/page.tsx'), 'utf8');
  assert.match(strip, /shipmentIndicatorHref\(key\)/);
  assert.match(central, /shipmentIndicatorHref\(key\)/);
  assert.doesNotMatch(central, /indicador=\$\{key\}/);
});
