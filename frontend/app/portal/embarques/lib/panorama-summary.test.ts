import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPanoramaSummary } from './panorama-summary.ts';
import type { PortalShipment } from '../../../../types/portal-shipment.ts';

const now = new Date('2026-09-13T15:00:00Z');
const ship = (id: string, eta: string | null, extra = {}) => ({ id, estado: 'coletado', tracking: { current_eta: eta, data_status: 'COMPLETE', eta_is_actual: false, is_mock: true }, ...extra } as PortalShipment);
test('Counts shipments once and retains pre-shipment records without ETA', () => {
  const a = ship('a', null, { estado: 'solicitado' });
  const result = buildPanoramaSummary([a, a, ship('b', '2026-09-13')], now);
  assert.equal(result.active.size, 2);
  assert.equal(result.missingEta.size, 1);
  assert.equal(result.arrivals.size, 1);
});
test('Arrival window includes today through day six; excludes actual/missing and day seven', () => {
  const result = buildPanoramaSummary([ship('today','2026-09-13'),ship('six','2026-09-19'),ship('seven','2026-09-20'),ship('yesterday','2026-09-12'),ship('missing',null),ship('actual','2026-09-13',{tracking:{current_eta:'2026-09-13',eta_is_actual:true,data_status:'COMPLETE'}})], now);
  assert.deepEqual([...result.arrivals], ['today','six']);
  assert.deepEqual([...result.missingEta], ['missing']);
});
test('Structured exceptions count attention; routine booking, urgency and ETA revision do not', () => {
  const result = buildPanoramaSummary([ship('exception',null,{estado:'booking_divergente'}),ship('postponed',null,{estado:'postergado'}),ship('booking',null,{estado:'analise_booking'}),ship('urgent','2026-09-15',{carga_urgente:true})], now);
  assert.deepEqual([...result.attention], ['exception','postponed']);
});
test('Tracking discharge/gate-out never closes the business record or counts as future arrival', () => {
  const result = buildPanoramaSummary([ship('gate','2026-09-15',{tracking:{current_eta:'2026-09-15',data_status:'COMPLETE',eta_is_actual:false,last_milestone:'AVAILABLE'}})], now);
  assert.equal(result.active.size, 1);
  assert.equal(result.arrivals.size, 0);
});
test('Unknown terminal states are excluded and missing tracking is explicit coverage', () => {
  const result = buildPanoramaSummary([ship('closed',null,{estado:'encerrado'}),ship('missing',null,{tracking:null})], now);
  assert.equal(result.active.size, 1);
  assert.equal(result.missingEta.size, 1);
});
