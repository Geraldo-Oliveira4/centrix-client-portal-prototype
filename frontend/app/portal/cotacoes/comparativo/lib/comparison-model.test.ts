import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MISSING,
  businessDaysUntil,
  decodeText,
  estimatedArrival,
  factualBadges,
  formatArrival,
  formatMultiCurrency,
  orMissing,
  parseSortKey,
  parseTab,
  proposalLabels,
  proposalTotals,
  sortProposals,
} from './comparison-model.ts';
import { comparisonFixtures } from './fixtures.ts';

const TODAY = '2026-10-06';
const [A, B] = comparisonFixtures(TODAY);
const find = (q: typeof A, id: string) => q.proposals.find((p) => p.id === id)!;

test('totais saem dos componentes: por moeda e em BRL à PTAX comum', () => {
  const p = find(A, 'a-alpha-1');
  const t = proposalTotals(p, A.request.ptax);
  assert.deepEqual(t.origin, { USD: 85 });
  assert.deepEqual(t.freight, { USD: 240 });
  assert.deepEqual(t.destination, { BRL: 1150 });
  assert.deepEqual(t.allIn, { USD: 325, BRL: 1150 });
  assert.equal(t.brl, Math.round((325 * 5.42 + 1150) * 100) / 100);
  assert.equal(formatMultiCurrency(t.allIn), 'USD 325,00 + R$ 1.150,00');
});

test('seguro contabilizado entra no total; frete é TOTAL, nunca multiplicado por peso', () => {
  const beta = find(A, 'a-beta');
  const t = proposalTotals(beta, A.request.ptax);
  assert.equal(t.allIn.BRL, 700 + 600 + 85);
  assert.equal(t.brl, Math.round(((70 + 25 + 260) * 5.42 + 1385) * 100) / 100);
  // Mudar um componente muda o total: não há total digitado.
  const changed = structuredClone(beta);
  changed.freightCharges[0].amount = 300;
  assert.equal(
    proposalTotals(changed, A.request.ptax).brl,
    Math.round(((70 + 25 + 300) * 5.42 + 1385) * 100) / 100,
  );
});

test('moedas misturadas (USD/EUR/BRL) convertidas pela mesma taxa', () => {
  const gamma = find(A, 'a-gamma');
  const t = proposalTotals(gamma, A.request.ptax);
  assert.equal(formatMultiCurrency(t.allIn), 'EUR 300,00 + R$ 1.050,00');
  assert.equal(t.brl, 300 * 5.89 + 1050);
});

test('selos factuais: menor preço (TOTAL EM BRL) e menor prazo, vencida não concorre', () => {
  const badges = factualBadges(A.proposals, A.request.ptax, TODAY);
  // A Delta vencida é a mais barata e a de menor prazo entre as vencidas; não leva selo.
  assert.deepEqual([...badges.cheapest], ['a-alpha-2']);
  assert.deepEqual([...badges.fastest], ['a-beta']);
  const b = factualBadges(B.proposals, B.request.ptax, TODAY);
  assert.deepEqual([...b.cheapest], ['b-gamma']);
  assert.deepEqual([...b.fastest], ['b-delta']);
});

test('empate dá o selo a todos os empatados', () => {
  const twin = structuredClone(find(A, 'a-alpha-2'));
  twin.id = 'twin';
  const badges = factualBadges([...A.proposals, twin], A.request.ptax, TODAY);
  assert.deepEqual([...badges.cheapest].sort(), ['a-alpha-2', 'twin']);
});

test('ordenação por menor preço e por menor prazo; vencida e sem valor vão para o fim', () => {
  const byPrice = sortProposals(A.proposals, A.request.ptax, 'preco', TODAY).map((p) => p.id);
  assert.deepEqual(byPrice, ['a-alpha-2', 'a-gamma', 'a-alpha-1', 'a-beta', 'a-delta']);
  const byTime = sortProposals(A.proposals, A.request.ptax, 'prazo', TODAY).map((p) => p.id);
  assert.deepEqual(byTime, ['a-beta', 'a-gamma', 'a-alpha-1', 'a-alpha-2', 'a-delta']);
  const noTransit = structuredClone(find(A, 'a-beta'));
  noTransit.transitDays = null;
  assert.equal(sortProposals([noTransit, find(A, 'a-alpha-2')], A.request.ptax, 'prazo', TODAY)[1].id, 'a-beta');
});

test('mesmo agente duas vezes: Opção 1 / Opção 2, estável com a reordenação', () => {
  const labels = proposalLabels(A.proposals);
  assert.equal(labels['a-alpha-1'], 'Alpha Logistics · Opção 1');
  assert.equal(labels['a-alpha-2'], 'Alpha Logistics · Opção 2');
  assert.equal(labels['a-beta'], 'Beta Cargo');
  const reordered = proposalLabels([...A.proposals].reverse());
  assert.equal(reordered['a-alpha-1'], 'Alpha Logistics · Opção 2');
  // A tela calcula os rótulos na ordem de chegada, nunca na ordem exibida.
});

test('acentos: entidades HTML decodificadas como TEXTO', () => {
  assert.equal(decodeText('CONFIRMA&#199;&#195;O'), 'CONFIRMAÇÃO');
  assert.equal(decodeText('confirma&#231;&#227;o &amp; espa&ccedil;o'), 'confirmação & espaço');
  assert.equal(decodeText('&#xE9;'), 'é');
  assert.equal(decodeText('&lt;script&gt;alert(1)&lt;/script&gt;'), '<script>alert(1)</script>');
  assert.equal(decodeText('&desconhecida; fica'), '&desconhecida; fica');
  assert.equal(decodeText('&#0; e &#99999999;'), '&#0; e &#99999999;');
  assert.equal(decodeText('   '), null);
  // As observações da fixture renderizam com acento.
  assert.equal(
    orMissing(find(A, 'a-gamma').observations),
    'SUJEITO A CONFIRMAÇÃO DE ESPAÇO. Free time e frequência a confirmar com o armador após o booking.',
  );
  for (const q of [A, B])
    for (const p of q.proposals)
      assert.doesNotMatch(orMissing(p.observations), /&#?\w+;/);
});

test('valor ausente vira "—", nunca vazio ou undefined', () => {
  assert.equal(orMissing(null), MISSING);
  assert.equal(orMissing(undefined), MISSING);
  assert.equal(orMissing(''), MISSING);
  assert.equal(orMissing(Number.NaN), MISSING);
  assert.equal(orMissing(0), '0');
  assert.equal(formatMultiCurrency({}), MISSING);
  assert.equal(formatArrival(estimatedArrival({ transitDays: null, departureInDays: 3 }, TODAY)), MISSING);
});

test('chegada estimada: próxima saída + transit time a partir de hoje', () => {
  const arrival = estimatedArrival({ transitDays: 78, departureInDays: 5 }, TODAY);
  assert.deepEqual(arrival, { days: 83, date: '2026-12-28' });
  assert.equal(formatArrival(arrival), 'Chega em 83d (28 de dezembro)');
  // Sem data de saída, conta só o trânsito.
  assert.equal(estimatedArrival({ transitDays: 10, departureInDays: null }, TODAY)?.days, 10);
});

test('dias úteis restantes de validade (seg-sex), vencida = 0', () => {
  assert.equal(businessDaysUntil('2026-10-09', TODAY), 3); // qua, qui, sex
  assert.equal(businessDaysUntil('2026-10-12', TODAY), 4); // + seg
  assert.equal(businessDaysUntil(TODAY, TODAY), 0);
  assert.equal(businessDaysUntil('2026-10-01', TODAY), 0);
});

test('estado da URL: aba e ordenação com padrão seguro', () => {
  assert.equal(parseTab('historico'), 'historico');
  assert.equal(parseTab('x'), 'mapa');
  assert.equal(parseTab(null), 'mapa');
  assert.equal(parseSortKey('prazo'), 'prazo');
  assert.equal(parseSortKey('qualquer'), 'preco');
});
