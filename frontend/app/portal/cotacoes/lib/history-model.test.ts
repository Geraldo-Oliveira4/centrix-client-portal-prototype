import test from 'node:test';
import assert from 'node:assert/strict';
import {
  closingDate,
  finalProposal,
  filterHistory,
  historyFilter,
  historyReturn,
} from './history-model.ts';
import {
  repeatQuotation,
  upsertRequest,
  requestIssue,
} from './repeat-model.ts';

const q = (patch = {}) => ({
  id: 'source',
  reference: 'COT-1',
  state: 'FECHADA',
  exporter_name: 'Fábrica A',
  product: 'Motores',
  client_reference: 'PO-OLD',
  porto_embarque: 'Busan',
  porto_destino: ['Santos'],
  modal: 'MARITIMO',
  incoterm: 'FOB',
  tipo_embarque: 'FCL',
  created_at: '2026-08-01',
  closed_at: '2026-09-10',
  updated_at: '2026-09-11',
  ...patch,
});
const winner = {
  id: 'winner',
  quotation_id: 'source',
  agent_id: 'beta',
  is_winner: true,
  total_brl: 1200,
};
test('legacy focused links map into history without mixing result filters', () => {
  assert.equal(historyFilter(new URLSearchParams('tab=fechadas')), 'FECHADA');
  assert.equal(historyFilter(new URLSearchParams('tab=negadas')), 'negadas');
  assert.equal(
    historyFilter(new URLSearchParams('tab=negadas&resultado=CANCELADO')),
    'CANCELADO',
  );
});
test('in-flight approval never supplies a final condition', () =>
  assert.equal(
    finalProposal(q({ state: 'APROVADA_PELO_CLIENTE', best_proposal: winner })),
    null,
  ));
test('cheapest is not the winner and conflicting winners are not guessed', () => {
  assert.equal(
    finalProposal(q({ best_proposal: { ...winner, is_winner: false } })),
    null,
  );
  assert.equal(
    finalProposal(q({ proposals: [{ ...winner, is_winner: false }, winner] }))
      ?.id,
    'winner',
  );
  assert.equal(
    finalProposal(q({ proposals: [winner, { ...winner, id: 'other' }] })),
    null,
  );
});
test('cancelled update is explicitly not an invented closing event', () =>
  assert.equal(
    closingDate(q({ state: 'CANCELADO' })).label,
    'Última atualização',
  ));
test('history excludes in-flight records and supports supplier/route search with accents', () => {
  const rows = [
    q(),
    q({ id: 'other', state: 'APROVADA_PELO_CLIENTE' }),
    q({ id: 'cancel', state: 'CANCELADO' }),
  ];
  assert.equal(filterHistory(rows, 'fabrica', 'all', 'all').length, 2);
  assert.equal(
    filterHistory(rows, 'santos', 'CANCELADO', 'all')[0].id,
    'cancel',
  );
});
test('legacy declined scope includes cancellation but closed filter does not', () => {
  const rows = [q(), q({ state: 'CANCELADO' }), q({ state: 'DECLINADA' })];
  assert.equal(filterHistory(rows, '', 'negadas', 'all').length, 2);
  assert.equal(filterHistory(rows, '', 'FECHADA', 'all').length, 1);
});
test('new remittance clears transaction data and retains arbitrary routes without mutating source', () => {
  const source = q({
    porto_embarque: 'Valencia',
    porto_destino: ['Itajai'],
    data_prontidao: '2026-08-10',
    declared_value: 1234,
    desired_deadline: '2026-08-03',
    winning_agent_id: 'beta',
    proposals: [winner],
  });
  const copy = repeatQuotation(source);
  assert.equal(copy.manualDraft.values.porto_embarque, 'Valencia');
  assert.equal(copy.manualDraft.values.client_reference, '');
  assert.equal(copy.manualDraft.values.declared_value, '');
  assert.equal(copy.manualDraft.values.data_prontidao, '');
  assert.deepEqual(copy.offers, []);
  assert.deepEqual(copy.targetAgents, []);
  copy.manualDraft.values.porto_destino.push('Outro');
  assert.deepEqual(source.porto_destino, ['Itajai']);
});
test('saving another draft never replaces a sibling occurrence or its original source', () => {
  const first = { id: 'one', sourceId: 'source' };
  assert.equal(
    upsertRequest([first], { id: 'two', sourceId: 'source' }).length,
    2,
  );
  assert.equal(
    upsertRequest([first], { ...first, updatedAt: 'now' }).length,
    1,
  );
});
test('return navigation cannot escape the quotation list', () => {
  assert.equal(
    historyReturn('https://example.com'),
    '/portal/cotacoes?tab=historico',
  );
  assert.equal(
    historyReturn('/portal/cotacoes?tab=historico&busca=PO'),
    '/portal/cotacoes?tab=historico&busca=PO',
  );
});
test('review checks cargo and dates again before confirming', () => {
  const draft = repeatQuotation(q());
  assert.ok(requestIssue(draft));
  const full = {
    ...draft,
    weight: '100',
    volume: '2',
    manualDraft: {
      ...draft.manualDraft,
      values: {
        ...draft.manualDraft.values,
        data_prontidao: '2026-09-15',
        data_limite_necessidade: '2026-10-20',
        desired_deadline: '2026-09-14T17:00',
      },
    },
  };
  assert.equal(requestIssue(full, Date.parse('2026-09-13')), null);
  assert.ok(requestIssue(full, Date.parse('2026-09-15')));
});
