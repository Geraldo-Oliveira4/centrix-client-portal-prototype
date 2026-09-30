// Unit test das notificacoes da Cotacao V2. Mesmo runner dos outros libs:
//
//     npm run test:unit
//
// O QUE ERRA EM SILENCIO AQUI:
//
//   1. O "lido" pulando de linha. Com id por indice, uma notificacao nova no
//      topo faz a de baixo herdar o estado lido da de cima.
//   2. O sino virando log. Uma cotacao devolvida duas vezes tem dois eventos no
//      historico (que a timeline quer) e UMA linha no sino, que e uma lista de
//      pendencias.
//   3. Notificacao de cotacao que a tela nao sabe nomear, aparecendo como
//      "undefined".

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  collectNotices,
  markNoticesRead,
  noticeAge,
  parseNoticeReadStore,
  unreadCount,
} from './quotation-review-notices.ts';
import {
  approveEntry,
  createReview,
  quotesArrived,
  releaseProposals,
  resetToDraft,
  resubmit,
  returnToClient,
  submitToFreitas,
  type QuotationReviewStore,
} from './quotation-review.ts';

const T0 = '2026-09-24T10:00:00.000Z';
const T1 = '2026-09-24T11:00:00.000Z';
const T2 = '2026-09-24T12:00:00.000Z';
const T3 = '2026-09-24T13:00:00.000Z';
const T4 = '2026-09-24T14:00:00.000Z';

const REFS = { q1: 'COT-2026-0001', q2: 'COT-2026-0002' };

const released = () =>
  releaseProposals(
    quotesArrived(approveEntry(submitToFreitas(createReview(T0), T1), T2), T3),
    ['p1', 'p2'],
    T4,
  );

const returned = () =>
  returnToClient(submitToFreitas(createReview(T0), T1), 'Falta packing list', T2);

test('so os dois tipos do RQ-16 viram notificacao', () => {
  const store: QuotationReviewStore = { q1: released() };
  const notices = collectNotices(store, REFS, []);
  assert.equal(notices.length, 1);
  assert.equal(notices[0].kind, 'proposals_released');
  assert.equal(notices[0].title, 'Propostas liberadas');
  assert.match(notices[0].body, /COT-2026-0001 · 2 propostas prontas/);
});

test('a devolucao notifica com o motivo escrito pela Freitas', () => {
  const notices = collectNotices({ q1: returned() }, REFS, []);
  assert.equal(notices.length, 1);
  assert.equal(notices[0].kind, 'quotation_returned');
  assert.equal(notices[0].title, 'Solicitação devolvida');
  assert.match(notices[0].body, /Falta packing list/);
});

test('uma proposta liberada usa o singular', () => {
  const store: QuotationReviewStore = {
    q1: releaseProposals(createReview(T0), ['p1'], T1),
  };
  assert.match(collectNotices(store, REFS, [])[0].body, /1 proposta pronta/);
});

test('duas devolucoes viram UMA linha, a mais recente', () => {
  let r = returned();
  r = resubmit(r, T3);
  r = returnToClient(r, 'Peso divergente da invoice', T4);
  const notices = collectNotices({ q1: r }, REFS, []);
  assert.equal(notices.length, 1);
  assert.match(notices[0].body, /Peso divergente/);
});

test('a ordem e do mais novo para o mais antigo', () => {
  const store: QuotationReviewStore = { q1: returned(), q2: released() };
  const notices = collectNotices(store, REFS, []);
  assert.deepEqual(
    notices.map((n) => n.reference),
    ['COT-2026-0002', 'COT-2026-0001'],
  );
});

test('cotacao que a tela nao sabe nomear nao vira linha', () => {
  assert.deepEqual(collectNotices({ q9: released() }, REFS, []), []);
});

test('etapas sem notificacao nao produzem nada', () => {
  const store: QuotationReviewStore = {
    q1: createReview(T0),
    q2: approveEntry(submitToFreitas(createReview(T0), T1), T2),
  };
  assert.deepEqual(collectNotices(store, REFS, []), []);
});

test('o id e estavel e nao muda de posicao quando chega uma nova', () => {
  const first = collectNotices({ q1: released() }, REFS, []);
  const both = collectNotices({ q1: released(), q2: returned() }, REFS, []);
  const again = both.find((n) => n.quotationId === 'q1');
  assert.equal(again?.id, first[0].id);
  assert.match(first[0].id, /^q1:proposals_released:/);
});

test('marcar lida vale so para o id marcado', () => {
  const store: QuotationReviewStore = { q1: released(), q2: returned() };
  const notices = collectNotices(store, REFS, []);
  assert.equal(unreadCount(notices), 2);

  const read = markNoticesRead([], [notices[0].id]);
  const after = collectNotices(store, REFS, read);
  assert.equal(unreadCount(after), 1);
  assert.equal(after.find((n) => n.id === notices[0].id)?.read, true);
});

test('marcar lida duas vezes nao duplica o id', () => {
  const read = markNoticesRead(markNoticesRead([], ['a']), ['a', 'b']);
  assert.deepEqual(read.sort(), ['a', 'b']);
});

test('rodar a jornada de novo devolve a notificacao como NAO lida', () => {
  // O reset guarda o historico, mas a nova liberacao acontece noutro instante,
  // entao o id muda e a linha volta nao lida — sem precisar podar nada.
  const first = collectNotices({ q1: released() }, REFS, []);
  const read = markNoticesRead([], [first[0].id]);

  let r = resetToDraft(released(), '2026-09-25T09:00:00.000Z');
  r = releaseProposals(r, ['p1'], '2026-09-25T10:00:00.000Z');
  const after = collectNotices({ q1: r }, REFS, read);
  assert.equal(after.length, 1);
  assert.equal(after[0].read, false);
});

test('a lista de lidas tolera lixo no disco', () => {
  assert.deepEqual(parseNoticeReadStore(null), []);
  assert.deepEqual(parseNoticeReadStore('{nao e json'), []);
  assert.deepEqual(parseNoticeReadStore('{"a":1}'), []);
  assert.deepEqual(parseNoticeReadStore('["a",1,null,"b"]'), ['a', 'b']);
});

test('a idade da notificacao em pt-BR', () => {
  const now = Date.parse('2026-09-24T12:00:00.000Z');
  assert.equal(noticeAge('2026-09-24T11:59:30.000Z', now), 'agora');
  assert.equal(noticeAge('2026-09-24T11:48:00.000Z', now), 'há 12 min');
  assert.equal(noticeAge('2026-09-24T09:00:00.000Z', now), 'há 3 h');
  assert.equal(noticeAge('2026-09-22T12:00:00.000Z', now), 'há 2 d');
  assert.equal(noticeAge('nao e data', now), '');
});
