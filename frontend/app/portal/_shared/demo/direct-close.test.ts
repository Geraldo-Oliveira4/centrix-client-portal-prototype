import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DIRECT_CLOSE_ROUTES,
  EMPTY_DIRECT_CLOSE_FORM,
  approveDirectClose,
  directCloseIssues,
  nextDirectCloseReference,
  parseDirectCloseStore,
  quoteNormallyHref,
  resubmitDirectClose,
  returnDirectClose,
  submitDirectClose,
} from './direct-close.ts';
import { QUOTATION_PORT_OPTION } from '../../inteligencia/lib/price-radar.ts';

const T0 = '2026-09-30T10:00:00.000Z';
const T1 = '2026-09-30T10:30:00.000Z';
const T2 = '2026-09-30T11:00:00.000Z';

const FILLED = {
  ...EMPTY_DIRECT_CLOSE_FORM,
  routeId: 'shanghai-santos',
  product: 'Peças de reposição',
  clientReference: 'PO-DEMO-0042',
  incoterm: 'FOB',
  readyDate: '2026-10-15',
  cargo: '1 × 40’ HC, 12.000 kg',
};

test('há ao menos uma rota com e uma sem agente preferido', () => {
  assert.ok(DIRECT_CLOSE_ROUTES.some((route) => route.preferredAgent));
  assert.ok(DIRECT_CLOSE_ROUTES.some((route) => !route.preferredAgent));
});

test('os portos da tabela são valores reais do formulário de cotação', () => {
  const options = new Set(Object.values(QUOTATION_PORT_OPTION));
  for (const route of DIRECT_CLOSE_ROUTES) {
    assert.ok(options.has(route.originOption ?? ''), route.id);
  }
});

test('formulário vazio: rota e os cinco dados mínimos bloqueiam', () => {
  assert.deepEqual(
    directCloseIssues(EMPTY_DIRECT_CLOSE_FORM).map((issue) => issue.field),
    ['routeId', 'product', 'clientReference', 'incoterm', 'readyDate', 'cargo'],
  );
  assert.deepEqual(directCloseIssues(FILLED), []);
});

test('rota sem agente preferido bloqueia e manda cotar normalmente', () => {
  const [issue] = directCloseIssues({ ...FILLED, routeId: 'izmir-santos' });
  assert.equal(issue.field, 'routeId');
  assert.match(issue.reason, /Cotar normalmente/);
});

test('"Cotar normalmente" leva a rota para a Nova cotação', () => {
  const route = DIRECT_CLOSE_ROUTES.find((r) => r.id === 'izmir-santos')!;
  const href = quoteNormallyHref(route);
  const params = new URLSearchParams(href.split('?')[1]);
  assert.equal(params.get('modal'), 'MARITIMO');
  assert.equal(params.get('porto_embarque'), 'Izmir, Turkey (TRIZM)');
  assert.equal(quoteNormallyHref(null), '/portal/nova-cotacao');
});

test('o envio entra na revisão de entrada com o agente da rota', () => {
  assert.equal(submitDirectClose({}, EMPTY_DIRECT_CLOSE_FORM, T0), null);
  const request = submitDirectClose({}, FILLED, T0)!;
  assert.equal(request.reference, 'FD-2026-0001');
  assert.equal(request.agent, 'AGENTE ALPHA');
  assert.equal(request.stage, 'entry_review');
  assert.equal(
    nextDirectCloseReference({ [request.id]: request }),
    'FD-2026-0002',
  );
});

test('devolver exige motivo; corrigir volta ao Inbox com o histórico', () => {
  const request = submitDirectClose({}, FILLED, T0)!;
  assert.equal(returnDirectClose(request, '  ', T1), request);
  const returned = returnDirectClose(request, 'Incoterm diverge do acordo', T1);
  assert.equal(returned.stage, 'returned');
  const again = resubmitDirectClose(
    returned,
    { ...FILLED, incoterm: 'FCA' },
    T2,
  );
  assert.equal(again.stage, 'entry_review');
  assert.equal(again.returnReason, undefined);
  assert.deepEqual(
    again.history.map((event) => event.kind),
    ['submitted', 'returned', 'resubmitted'],
  );
});

test('aprovar só sai da revisão de entrada', () => {
  const request = submitDirectClose({}, FILLED, T0)!;
  const approved = approveDirectClose(request, T1);
  assert.equal(approved.stage, 'approved');
  assert.equal(approveDirectClose(approved, T2), approved);
});

test('dado gravado por outra versão é descartado, não consertado', () => {
  const request = submitDirectClose({}, FILLED, T0)!;
  const raw = JSON.stringify({
    [request.id]: request,
    lixo: { reference: 'FD-2026-0009', stage: 'inventado' },
  });
  assert.deepEqual(Object.keys(parseDirectCloseStore(raw)), [request.id]);
  assert.deepEqual(parseDirectCloseStore('{quebrado'), {});
});
