'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('./intel-personalize.js');

function memory(initial = {}) {
  const m = new Map(Object.entries(initial));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), size: () => m.size };
}
const broken = { getItem() { throw new Error('bloqueado'); }, setItem() { throw new Error('bloqueado'); }, removeItem() { throw new Error('bloqueado'); } };

test('temas e cards do combinado, nada chamado Preço', () => {
  assert.deepEqual(P.THEMES.map(([, l]) => l), ['Prazo', 'Custo', 'Volume']);
  const by = (t) => P.CARDS.filter((c) => c.theme === t).map((c) => c.label);
  assert.deepEqual(by('prazo'), ['Entrega final no prazo', 'Onde o prazo se perde', 'Evolução do prazo por etapa', 'Onde os tempos excedem o previsto']);
  assert.deepEqual(by('custo'), ['Frete contratado', 'Evolução do frete']);
  assert.deepEqual(by('volume'), ['Embarques no recorte']);
  assert.ok(![...P.THEMES.map(([, l]) => l), ...P.CARDS.map((c) => c.label + c.desc)].some((t) => /pre[çc]o/i.test(t)));
});

test('padrão: tudo ligado, na ordem da hierarquia', () => {
  assert.deepEqual(P.visibleCards(P.defaults()), ['entrega_final', 'funil', 'frete', 'embarques', 'evolucao_prazo', 'evolucao_frete', 'trechos']);
  assert.ok(P.isDefault(P.defaults()));
});

test('a ordem é fixa: o que foi guardado fora de ordem volta à ordem canônica', () => {
  const s = P.normalize({ themes: ['volume', 'prazo'], enabled_cards: ['trechos', 'embarques', 'entrega_final'] });
  assert.deepEqual(s.themes, ['prazo', 'volume']);
  assert.deepEqual(s.enabled_cards, ['entrega_final', 'embarques', 'trechos']);
});

test('desligar um tema desliga os cards dele e só eles', () => {
  const s = P.toggleTheme(P.setCard(P.defaults(), 'frete', false), 'prazo');
  assert.deepEqual(s.themes, ['custo', 'volume']);
  assert.deepEqual(s.enabled_cards, ['embarques', 'evolucao_frete']);
});

test('religar um tema traz os cards dele ligados e preserva os outros', () => {
  let s = P.setCard(P.defaults(), 'evolucao_frete', false);
  s = P.toggleTheme(P.toggleTheme(s, 'prazo'), 'prazo');
  assert.deepEqual(s.enabled_cards, ['entrega_final', 'funil', 'frete', 'embarques', 'evolucao_prazo', 'trechos']);
});

test('card de tema não escolhido não liga', () => {
  const s = P.setCard(P.toggleTheme(P.defaults(), 'custo'), 'frete', true);
  assert.ok(!s.enabled_cards.includes('frete'));
});

test('tudo desligado é um estado válido (a tela mostra o vazio)', () => {
  let s = P.defaults();
  for (const [t] of P.THEMES) s = P.toggleTheme(s, t);
  assert.deepEqual(P.visibleCards(s), []);
  assert.deepEqual(P.cardsByTheme(s).map((g) => g.on), [false, false, false], 'os temas continuam na lista, desligados');
});

// B1 (17/11/2026): tema ou card desligado fica esmaecido e clicável, não some.
test('tema desligado continua listado, com os cards, marcado como desligado', () => {
  const g = P.cardsByTheme(P.toggleTheme(P.defaults(), 'custo'));
  assert.deepEqual(g.map((x) => [x.id, x.on]), [['prazo', true], ['custo', false], ['volume', true]]);
  assert.deepEqual(g[1].cards.map((c) => c.id), ['frete', 'evolucao_frete']);
});
test('cardStates diz por que cada card está desligado', () => {
  let s = P.toggleTheme(P.defaults(), 'custo');
  s = P.setCard(s, 'funil', false);
  const by = Object.fromEntries(P.cardStates(s).map((c) => [c.id, c.off]));
  assert.deepEqual(by, { entrega_final: null, funil: 'card', frete: 'theme', embarques: null, evolucao_prazo: null, evolucao_frete: 'theme', trechos: null });
});
test('ativar pelo esmaecido: tema volta inteiro; card volta sozinho', () => {
  const off = P.toggleTheme(P.defaults(), 'custo');
  assert.deepEqual(P.activate(off, 'frete'), P.defaults());
  const oneOff = P.setCard(P.defaults(), 'funil', false);
  assert.deepEqual(P.activate(oneOff, 'funil'), P.defaults());
  assert.deepEqual(P.activate(oneOff, 'desconhecido'), oneOff);
});

test('ids desconhecidos são descartados; lixo volta ao padrão', () => {
  assert.deepEqual(P.normalize({ themes: ['prazo', 'preco'], enabled_cards: ['funil', 'ranking'] }), { themes: ['prazo'], enabled_cards: ['funil'] });
  for (const junk of [null, 'x', 3, [], { themes: 'prazo' }, { themes: [] }]) assert.ok(P.isDefault(P.normalize(junk)));
});

test('grava e lê no formato da Home ({ themes, enabled_cards })', () => {
  const st = memory();
  const s = P.setCard(P.defaults(), 'trechos', false);
  assert.ok(P.save(st, s));
  assert.deepEqual(Object.keys(JSON.parse(st.getItem(P.STORE_KEY))), ['themes', 'enabled_cards']);
  assert.deepEqual(P.load(st), s);
});

test('refazer do zero apaga a chave e volta ao padrão', () => {
  const st = memory();
  P.save(st, P.toggleTheme(P.defaults(), 'prazo'));
  assert.ok(P.clear(st));
  assert.equal(st.size(), 0);
  assert.ok(P.isDefault(P.load(st)));
});

test('storage quebrado ou JSON inválido não derruba a tela', () => {
  assert.ok(P.isDefault(P.load(broken)));
  assert.equal(P.save(broken, P.defaults()), false);
  assert.equal(P.clear(broken), false);
  assert.ok(P.isDefault(P.load(memory({ [P.STORE_KEY]: '{nao-e-json' }))));
});

test('introdução: vista só depois de marcada; sem storage conta como vista', () => {
  const st = memory();
  assert.equal(P.onboardingSeen(st), false);
  P.markOnboardingSeen(st);
  assert.equal(P.onboardingSeen(st), true);
  assert.equal(P.onboardingSeen(broken), true);
  assert.equal(P.markOnboardingSeen(broken), false);
});

test('"Ver detalhe": um por bloco, e todo bloco aponta para cards que existem (A3)', () => {
  const ids = P.CARDS.map((c) => c.id);
  const owners = new Map();
  for (const [block, cards] of Object.entries(P.BLOCKS)) for (const c of cards) { assert.ok(ids.includes(c), c); assert.ok(!owners.has(c), `${c} em dois blocos`); owners.set(c, block); }
  assert.deepEqual([...owners.keys()].sort(), [...ids].sort(), 'todo card mora em exatamente um bloco');
  for (const [block, d] of Object.entries(P.DETAIL_LINKS)) {
    assert.ok(P.BLOCKS[block], block);
    assert.ok(d.kind === 'portal' ? d.href.startsWith('/portal/') : ['exportadores', 'agentes', 'rotas', 'simulador'].includes(d.aba));
  }
});
test('"Ver detalhe": cada destino faz sentido pelo nome do bloco', () => {
  assert.equal(P.DETAIL_LINKS.embarques.href, '/portal/embarques');
  assert.equal(P.DETAIL_LINKS.frete.aba, 'rotas');
  assert.equal(P.DETAIL_LINKS.trechos.aba, 'rotas');
  assert.equal(P.DETAIL_LINKS.resultado.href, '/portal/embarques');
  assert.equal(P.DETAIL_LINKS.evolucao, undefined);
});

// B5 (17/11/2026): o último passo da introdução diz o que foi escolhido.
test('resumo da escolha na introdução', () => {
  const pv = P.toggleTheme(P.defaults(), 'custo');
  assert.equal(P.choiceSummary(pv, false), 'Você escolheu: Prazo e Volume (5 cartões)');
  assert.equal(P.choiceSummary(P.defaults(), false), 'Você escolheu: Prazo, Custo e Volume (7 cartões)');
  assert.equal(P.choiceSummary(P.setCard(P.toggleTheme(P.toggleTheme(P.defaults(), 'prazo'), 'custo'), 'embarques', true), false), 'Você escolheu: Volume (1 cartão)');
  assert.equal(P.choiceSummary(P.defaults(), true), 'Você manteve a visão padrão');
  assert.equal(P.choiceSummary(pv, true), 'Você manteve a sua visão atual');
});
