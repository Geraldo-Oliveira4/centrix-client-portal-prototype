// Simulador v2 (S10, 17/11/2026): cobertura, datas, perna nacional,
// consistência com as fichas, reconciliação e fontes do histórico. O motor é
// puro (intel-sim.js); aqui ele roda com uma fixture sintética, onde cada
// número é conferível de cabeça, e com a fixture e a referência da tela.
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const D = require('./data.js');
const S = require('./intel-sim.js');
const T = require('./intel-tabs.js');
const R = require('./sim-reference.js');

const TODAY = '2026-11-13';
// Fixture sintética: uma rota marítima, quatro agentes de carga.
const FD = {
  routes: [{ id: 'r', from: 'a', to: 'b', mode: 'Marítimo', equipment: 'FCL · 40 HC' }, { id: 'v', from: 'a', to: 'b', mode: 'Aéreo', equipment: 'Carga geral' }],
  locations: { a: { name: 'Ningbo' }, b: { name: 'Itajaí' } },
  agents: [{ id: 'x', name: 'Agente X' }, { id: 'y', name: 'Agente Y' }, { id: 'z', name: 'Agente Z' }, { id: 'w', name: 'Agente W' }],
  companies: [],
  days: D.days,
};
/** Um embarque com saída, trânsito e (opcional) perna nacional. */
const op = (agent, transit, leg = null, route = 'r', depart = '2026-06-01') => ({ route, agent, depart, arrive: S.addDays(depart, transit), final: leg == null ? null : S.addDays(S.addDays(depart, transit), leg), readyPlan: depart });
const task = (over = {}) => ({ mode: 'chegar', route: 'r', modal: 'maritimo', target: S.addDays(TODAY, 40), departure: TODAY, window: 'tudo', blank: false, promised: {}, source: 'meus', cargo: '', ...over });
const plan = (ops, over = {}, opts = {}) => S.plan(FD, ops, task(over), TODAY, opts);

// --------------------------------------------------------------- cobertura ---
test('cobertura com base de 3, 10 e 50 embarques: a de b contado, percentual secundário', () => {
  assert.deepEqual(S.coverage([30, 35, 40], 35), { good: 2, base: 3, pct: 67 });
  const ten = [30, 31, 32, 33, 34, 35, 36, 37, 38, 45];
  assert.deepEqual(S.coverage(ten, 38), { good: 9, base: 10, pct: 90 });
  const fifty = Array.from({ length: 50 }, (_, i) => 20 + (i % 25));
  assert.deepEqual(S.coverage(fifty, 32), { good: 26, base: 50, pct: 52 });
});
test('empates e trânsito igual à margem: a margem é inclusiva', () => {
  assert.deepEqual(S.coverage([32, 32, 32, 33], 32), { good: 3, base: 4, pct: 75 });
  assert.deepEqual(S.coverage([32, 32, 32], 31), { good: 0, base: 3, pct: 0 });
  const st = S.stats([32, 32, 32, 32, 40]);
  assert.equal(st.median, 32);
  assert.equal(st.p90, 40);
  assert.equal(st.spread, 8, 'Variação do trânsito = P90 − mediana');
});
test('limites do resultado: P90 e mediana descontados da data-alvo, cobertura de cada limite contada', () => {
  const ops = [30, 31, 32, 33, 34, 35, 36, 37, 38, 45].map((t) => op('x', t));
  const r = plan(ops);
  assert.equal(r.state, 'ok');
  assert.equal(r.basis, 'port');
  assert.equal(r.margin, 40);
  assert.equal(r.limitP90, S.addDays(S.addDays(TODAY, 40), -38));
  assert.equal(r.limitMedian, S.addDays(S.addDays(TODAY, 40), -35)); // mediana 34,5 → 35
  assert.deepEqual(r.coverP90, { good: 9, base: 10, pct: 90 });
  assert.deepEqual(r.coverMedian, { good: 6, base: 10, pct: 60 });
  assert.deepEqual(r.coverToday, { good: 9, base: 10, pct: 90 }); // margem 40: só o de 45 fica fora
});
test('margem negativa, data passada, data-alvo antes do menor trânsito: o fato, e para', () => {
  const ops = [30, 31, 32].map((t) => op('x', t));
  assert.equal(plan(ops, { target: TODAY }).state, 'past');
  assert.equal(plan(ops, { target: '2026-10-01' }).state, 'past');
  const early = plan(ops, { target: S.addDays(TODAY, 29) });
  assert.equal(early.state, 'before_min');
  assert.equal(early.limitP90, undefined, 'não calcula limite nenhum');
  assert.equal(plan(ops, { mode: 'embarcar', departure: '2026-11-01' }).state, 'past');
});
test('sem rota, sem modal, sem data: pede o que falta, não simula', () => {
  assert.equal(plan([], { route: '' }).state, 'no_route');
  assert.equal(plan([], { modal: '' }).state, 'no_modal');
  assert.equal(plan([], { target: '' }).state, 'no_date');
  assert.equal(plan([], { mode: 'embarcar', departure: '2026-13-40' }).state, 'no_date');
});
test('rota sem histórico e modal sem base: "Sem histórico suficiente", nada simulado', () => {
  assert.equal(plan([]).state, 'no_history');
  assert.equal(plan([op('x', 30), op('x', 31)]).state, 'no_history', 'dois trânsitos não bastam');
  const sea = [30, 31, 32].map((t) => op('x', t));
  assert.equal(plan(sea).state, 'ok');
  const air = plan(sea, { modal: 'aereo' });
  assert.equal(air.state, 'no_history', 'marítimo e aéreo nunca se misturam');
  assert.equal(air.route.n, 0);
});
test('agente com menos de 3 embarques: Amostra pequena, sem cobertura nem limite', () => {
  const ops = [...[30, 31, 32, 33].map((t) => op('x', t)), op('y', 29), op('y', 50)];
  const r = plan(ops);
  const y = r.agents.find((a) => a.agent === 'y'), x = r.agents.find((a) => a.agent === 'x');
  assert.equal(y.small, true);
  assert.equal(y.cover, undefined);
  assert.equal(y.limitP90, undefined);
  assert.equal(x.small, false);
  assert.deepEqual(x.cover, S.coverage([30, 31, 32, 33], 40));
});
test('fallback: agente em foco com menos de 3 cai para a rota e diz isso', () => {
  const ops = [...[30, 31, 32, 33].map((t) => op('x', t)), op('y', 29), op('y', 50)];
  const fb = plan(ops, {}, { focus: 'y' });
  assert.equal(fb.level, 'route');
  assert.equal(fb.fallback, 'Poucos embarques deste agente; mostrando a rota.');
  assert.deepEqual(fb.coverP90, plan(ops).coverP90);
  const ok = plan(ops, {}, { focus: 'x' });
  assert.equal(ok.level, 'agent');
  assert.equal(ok.fallback, undefined);
  assert.deepEqual(ok.coverToday, S.coverage([30, 31, 32, 33], 40));
});
test('prometido × histórico: o histórico cumpriu o prometido em a de b', () => {
  const ops = [38, 40, 40, 42, 45, 50, 61, 39, 41, 44, 70].map((t) => op('x', t));
  const r = plan(ops, { promised: { x: 40 } });
  const x = r.agents[0];
  assert.deepEqual(x.promised, { days: 40, good: 4, base: 11, pct: 36 });
  assert.equal(x.median, 42);
  assert.equal(x.p90, 61);
  assert.deepEqual(S.readPromised('x:40,y:abc,z:0,w:400,:3'), { x: 40 });
  assert.equal(S.writePromised({ x: 40, y: 35 }), 'x:40,y:35');
  assert.equal(S.writePromised({}), null);
});
test('ordem padrão por volume; sem valor no fim; nenhuma linha é "a melhor"', () => {
  const ops = [...[30, 31, 32].map((t) => op('x', t)), ...[28, 29, 30, 31, 32].map((t) => op('z', t)), op('y', 20)];
  const rows = S.sortAgents(plan(ops).agents);
  assert.deepEqual(rows.map((a) => a.agent), ['z', 'x', 'y']);
  assert.equal(S.sortAgents(plan(ops).agents, { key: 'cover', dir: 'desc' }).at(-1).agent, 'y');
  assert.ok(!plan(ops).agents.some((a) => 'best' in a || 'rank' in a || 'score' in a));
});

// ------------------------------------------------------------------ datas ---
test('datas em dias corridos: meses de 30 e 31 dias e virada de ano', () => {
  assert.equal(S.addDays('2026-11-30', 1), '2026-12-01');
  assert.equal(S.addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(S.addDays('2027-03-01', -1), '2027-02-28');
  assert.equal(S.diffDays('2026-12-20', '2027-01-10'), 21);
  const ops = [30, 31, 32].map((t) => op('x', t));
  const r = S.plan(FD, ops, task({ target: '2027-01-15' }), '2026-12-10');
  assert.equal(r.margin, 36);
  assert.equal(r.limitP90, '2026-12-14');
  const e = S.plan(FD, ops, task({ mode: 'embarcar', departure: '2026-12-20' }), '2026-12-10');
  assert.equal(e.arrivalMedian, '2027-01-20');
  assert.equal(e.arrivalP90, '2027-01-21');
});
test('fuso horário neutro: o mesmo resultado em São Paulo, UTC e Tóquio', () => {
  const code = "const S=require('./intel-sim.js');const D=require('./data.js');const t=S.readTask(D,new URLSearchParams('chegada=2027-01-15'),'2026-12-10');process.stdout.write(JSON.stringify([S.addDays('2026-12-31',1),S.diffDays('2026-02-27','2026-03-02'),S.plan(D,S.inWindow(D.operations,'tudo','2026-12-10'),{...t,source:'meus'},'2026-12-10').limitP90]))";
  const out = ['America/Sao_Paulo', 'UTC', 'Asia/Tokyo'].map((TZ) => execFileSync(process.execPath, ['-e', code], { cwd: __dirname, env: { ...process.env, TZ } }).toString());
  assert.equal(new Set(out).size, 1, out.join(' | '));
});

// --------------------------------------------------------- perna nacional ---
test('perna nacional: com base, a data-alvo desconta o P90 dela; no embarque, soma à chegada', () => {
  const ops = [[30, 4], [31, 5], [32, 6], [33, 9]].map(([t, l]) => op('x', t, l));
  const r = plan(ops, { target: S.addDays(TODAY, 50) });
  assert.equal(r.basis, 'final');
  assert.equal(r.leg.n, 4);
  assert.equal(r.leg.p90, 9);
  assert.equal(r.portTarget, S.addDays(TODAY, 41));
  assert.equal(r.margin, 41);
  assert.equal(r.limitP90, S.addDays(TODAY, 41 - 33));
  const e = plan(ops, { mode: 'embarcar', departure: S.addDays(TODAY, 1) });
  assert.equal(e.finalP90, S.addDays(e.arrivalP90, 9));
  assert.equal(e.finalMedian, S.addDays(e.arrivalMedian, Math.ceil(r.leg.median)));
});
test('perna nacional sem base: não entra, e o resultado é sobre a chegada ao destino', () => {
  const ops = [op('x', 30, 4), op('x', 31, 5), op('x', 32)];
  const r = plan(ops);
  assert.equal(r.basis, 'port');
  assert.equal(r.leg.n, 2);
  assert.equal(r.portTarget, r.task.target);
});

// ------------------------------------------------ consistência e totais ---
test('consistência: mediana e N do Simulador ("Meus embarques") = os das fichas, sobre os mesmos embarques', () => {
  const ops = S.inWindow(D.operations, 'tudo', D.cutoff);
  for (const rt of D.routes) {
    const r = S.plan(D, ops, { ...S.readTask(D, new URLSearchParams(`srota=${rt.id}&sfonte=meus`), D.cutoff), window: 'tudo' }, D.cutoff);
    const fichas = T.routeAgents(D, ops, rt.id);
    for (const p of fichas) {
      const a = r.agents.find((x) => x.agent === p.agent);
      assert.equal(a.n, p.transitN, `${rt.id}/${p.agent} N`);
      assert.equal(a.shipments, p.n, `${rt.id}/${p.agent} embarques`);
      if (!p.small) assert.equal(a.median, p.transitMedian, `${rt.id}/${p.agent} mediana`);
    }
  }
});
test('reconciliação: a base de cada agente soma a base da rota, nas duas fontes', () => {
  const ops = S.inWindow(D.operations, '12m', D.cutoff);
  for (const source of ['meus', 'referencia']) for (const rt of D.routes) for (const modal of ['maritimo', 'aereo']) {
    const r = S.plan(D, ops, { ...S.readTask(D, new URLSearchParams(`srota=${rt.id}&smodal=${modal}`), D.cutoff), source }, D.cutoff, { ref: R });
    if (!r.agents) continue;
    assert.equal(r.agents.reduce((n, a) => n + a.n, 0), r.route.n, `${source} ${rt.id} ${modal}`);
  }
});
test('a referência agregada não toca a fixture das outras subabas', () => {
  assert.equal(D.operations.length, 79);
  assert.ok(R.samples.length > 200);
  assert.ok(R.samples.every((x) => !('supplier' in x) && !('po' in x)), 'anônima: sem exportador nem PO');
  const ids = new Set(D.operations.map((o) => o.id));
  assert.ok(R.samples.every((x) => !ids.has(x.id)));
});

// ------------------------------------------------------ fonte do histórico ---
test('fonte: referência agregada por padrão, "Meus embarques" pela URL; rótulo e cobertura de registro', () => {
  const ops = S.inWindow(D.operations, '12m', D.cutoff);
  const def = S.plan(D, ops, S.readTask(D, new URLSearchParams(''), D.cutoff), D.cutoff, { ref: R });
  assert.equal(def.source, 'referencia');
  assert.equal(S.sourceLabel(def.source), 'Referência agregada da Freitas');
  assert.ok(def.registered.with <= def.registered.total);
  assert.ok(def.registered.total > def.registered.with, 'há embarques sem chegada registrada fora do trânsito');
  const mine = S.plan(D, ops, S.readTask(D, new URLSearchParams('sfonte=meus'), D.cutoff), D.cutoff, { ref: R });
  assert.equal(mine.source, 'meus');
  // Sem a referência carregada, a fonte cai para os embarques do cliente.
  assert.equal(S.plan(D, ops, S.readTask(D, new URLSearchParams(''), D.cutoff), D.cutoff).source, 'meus');
});
test('fonte: modal sem base numa fonte pode ter base na outra; hasBase diz qual', () => {
  const ops = S.inWindow(D.operations, '12m', D.cutoff);
  const t = S.readTask(D, new URLSearchParams('smodal=aereo&sfonte=meus'), D.cutoff);
  assert.equal(S.plan(D, ops, t, D.cutoff, { ref: R }).state, 'no_history');
  assert.equal(S.hasBase(D, ops, R, t, 'referencia', D.cutoff), true);
  const none = S.readTask(D, new URLSearchParams('srota=hamburgo&smodal=aereo'), D.cutoff);
  assert.equal(S.plan(D, ops, none, D.cutoff, { ref: R }).state, 'no_history');
  assert.equal(S.hasBase(D, ops, R, none, 'meus', D.cutoff), false);
});
test('entrada: exemplo preenchido sem parâmetro; "Limpar" esvazia tudo, inclusive o modal; deep link antigo vale', () => {
  const ex = S.readTask(D, new URLSearchParams(''), TODAY);
  assert.deepEqual([ex.mode, ex.route, ex.modal, ex.target], ['chegar', 'ningbo', 'maritimo', S.addDays(TODAY, S.EXAMPLE.targetDays)]);
  const blank = S.readTask(D, new URLSearchParams('sinicio=vazio'), TODAY);
  assert.deepEqual([blank.route, blank.modal, blank.target, blank.departure], ['', '', '', '']);
  const old = S.readTask(D, new URLSearchParams('aba=simulador&srota=genova&chegada=2026-12-20&janela=6m'), TODAY);
  assert.deepEqual([old.route, old.target, old.window, old.mode], ['genova', '2026-12-20', '6m', 'chegar']);
  assert.equal(S.readTask(D, new URLSearchParams('smodo=embarcar&sembarque=2026-11-20'), TODAY).departure, '2026-11-20');
});

// ------------------------------------- F1/E5: exemplo com embarque no futuro ---
// A data-alvo do exemplo é "hoje + N", com N escolhido pelo motor, e acompanha
// ?hoje=. E5: o embarque limite pelo P90 fica depois de hoje e a cobertura de
// hoje é parcial (menor que 100%). Testado no "hoje" das capturas, na data
// real desta entrega, na data base e numa data adiante.
for (const today of ['2026-11-13', '2026-11-17', D.cutoff, '2027-03-02']) {
  test(`E5: exemplo de abertura com embarque limite pelo P90 depois de hoje e cobertura parcial (hoje = ${today})`, () => {
    const DD = D.shift(today);
    const ops = S.inWindow(DD.operations, '12m', today);
    const raw = S.readTask(DD, new URLSearchParams(''), today);
    assert.equal(raw.exampleTarget, true);
    const t = S.withExampleTarget(DD, ops, raw, today, { ref: R });
    assert.ok(t.target > today, 'data-alvo no futuro');
    assert.equal(t.target, S.addDays(today, S.exampleTargetDays(DD, ops, raw, today, { ref: R })), 'relativa ao hoje');
    const r = S.plan(DD, ops, t, today, { ref: R });
    assert.equal(r.state, 'ok');
    assert.ok(r.limitP90 > today, `embarque limite pelo P90 (${r.limitP90}) depois de hoje`);
    assert.ok(r.limitMedian > today, 'o limite pela mediana também');
    assert.doesNotMatch(S.resultText(r).head, /já passou/, 'a frase não abre com "já passou"');
    assert.ok(r.coverToday.pct < 100, `cobertura de hoje parcial: ${r.coverToday.good} de ${r.coverToday.base}`);
    // O menor N: um dia a menos de data-alvo já devolve o limite para hoje ou antes.
    const prev = S.plan(DD, ops, { ...t, target: S.addDays(t.target, -1) }, today, { ref: R });
    assert.ok(prev.state !== 'ok' || prev.limitP90 <= today);
  });
}
test('E5: limite P90 depois de hoje implica cobertura de hoje de 90% ou mais (por isso a faixa de 40% a 80% não cabe junto)', () => {
  const ops = S.inWindow(D.operations, '12m', D.cutoff);
  const t = S.readTask(D, new URLSearchParams(''), D.cutoff);
  let seen = 0;
  for (let n = 30; n <= 90; n++) {
    const r = S.plan(D, ops, { ...t, target: S.addDays(D.cutoff, n) }, D.cutoff, { ref: R });
    if (r.state === 'ok' && r.limitP90 > D.cutoff) { seen++; assert.ok(r.coverToday.pct >= 90, `n=${n}`); }
  }
  assert.ok(seen > 0);
});
test('E5: com "Meus embarques" o exemplo também abre com o limite P90 no futuro (ou cai na reserva)', () => {
  const ops = S.inWindow(D.operations, '12m', D.cutoff);
  const raw = S.readTask(D, new URLSearchParams('sfonte=meus'), D.cutoff);
  const t = S.withExampleTarget(D, ops, raw, D.cutoff, { ref: R });
  const r = S.plan(D, ops, t, D.cutoff, { ref: R });
  if (t.target !== S.addDays(D.cutoff, S.EXAMPLE.targetDays)) assert.ok(r.state === 'ok' && r.limitP90 > D.cutoff);
});
test('F1: data-alvo na URL vale como está; "Limpar" continua esvaziando tudo', () => {
  const ops = S.inWindow(D.operations, '12m', TODAY);
  const fixed = S.readTask(D, new URLSearchParams('chegada=2027-01-12'), TODAY);
  assert.equal(fixed.exampleTarget, false);
  assert.equal(S.withExampleTarget(D, ops, fixed, TODAY, { ref: R }).target, '2027-01-12');
  const blank = S.readTask(D, new URLSearchParams('sinicio=vazio'), TODAY);
  const b = S.withExampleTarget(D, ops, blank, TODAY, { ref: R });
  assert.deepEqual([b.route, b.modal, b.target, b.departure], ['', '', '', '']);
});

// ------------------------------- F2: porto e entrega final, separados ---
const plain = (s) => s.replace(/\*\*/g, '');
test('F2: com perna nacional, a frase cita porto e entrega final e não diz "cobre" para a entrega final', () => {
  const ops = [[30, 4], [31, 5], [32, 6], [33, 9]].map(([t, l]) => op('x', t, l));
  const r = plan(ops, { target: S.addDays(TODAY, 50) });
  assert.equal(r.basis, 'final');
  assert.equal(r.portTarget, S.addDays(r.task.target, -r.leg.p90), 'porto = data-alvo − P90 da perna');
  const txt = S.resultText(r), head = plain(txt.head);
  const dd = (iso) => iso.slice(8, 10) + '/' + iso.slice(5, 7);
  assert.match(head, new RegExp(`entrega final até ${dd(r.task.target)}`));
  assert.match(head, new RegExp(`chegar ao porto até ${dd(r.portTarget)} \\(reserva de 9 dias`));
  assert.match(head, new RegExp(`faz ${r.coverP90.good} de ${r.coverP90.base} embarques parecidos chegarem ao porto até ${dd(r.portTarget)} \\(P90 do trânsito\\)`));
  assert.doesNotMatch(head + txt.today, /cobre/i);
  assert.doesNotMatch(head, /entrega final[^.;]*\d+ de \d+/, 'nenhuma contagem atribuída à entrega final');
  assert.match(txt.note, /P90 dela somado ao P90 do trânsito; por isso é conservadora/);
  assert.match(txt.note, /vale só para a chegada ao porto/);
});
test('F2: sem perna nacional, a frase fala só de porto (aeroporto no aéreo), sem nota de reserva', () => {
  const r = plan([30, 31, 32, 33].map((t) => op('x', t)));
  assert.equal(r.basis, 'port');
  const txt = S.resultText(r);
  assert.match(plain(txt.head), /^Para a chegada ao porto até/);
  assert.doesNotMatch(txt.head + txt.today, /entrega final|cobre/i);
  assert.equal(txt.note, null);
  assert.match(txt.today, /Margem até a data-alvo/);
  const air = S.plan(FD, [30, 31, 32].map((t) => op('x', t, null, 'v')), task({ route: 'v', modal: 'aereo' }), TODAY);
  assert.match(S.resultText(air).head, /chegada ao aeroporto/);
});
test('F2: "Como é calculado" não afirma cobertura da entrega final', () => {
  const f = S.howCalculated(D, {}, S.readTask(D, new URLSearchParams(''), TODAY), TODAY).find((l) => l.label === 'Fórmula').text;
  assert.match(f, /vale sempre para a chegada ao porto ou aeroporto/);
  assert.match(f, /nenhuma cobertura é contada para a entrega final/);
});

// ------------------------------------- F3: uma escala só, a de b real ---
test('F3: no modo "Vou embarcar em", a frase conta a de b (nada de "metade" nem "9 de 10")', () => {
  const ops = [30, 31, 32, 33, 34, 35, 36, 37, 38, 45].map((t) => op('x', t));
  const r = plan(ops, { mode: 'embarcar', departure: S.addDays(TODAY, 1) });
  assert.deepEqual(r.coverArrivalMedian, { good: 6, base: 10, pct: 60 });
  assert.deepEqual(r.coverArrivalP90, { good: 9, base: 10, pct: 90 });
  const head = S.resultText(r).head;
  assert.match(head, /6 de 10 embarques parecidos chegaram ao porto até \*\*\d\d\/\d\d\*\* \(mediana\) e 9 de 10 até/);
  assert.doesNotMatch(head, /metade/);
});
test('F3: a cobertura de hoje traz a de b com o percentual entre parênteses, separado do texto', () => {
  const r = plan([30, 31, 32, 33].map((t) => op('x', t)), { target: S.addDays(TODAY, 31) });
  assert.match(S.resultText(r).today, /\*\*2 de 4\*\* \(50%\) embarques parecidos/);
});

// ---------------------- L1: o acordeão mostra só o que o cartão não diz ---
test('L1: resultText().extra traz a cobertura pelo P90 e pela mediana e a margem, sem a cobertura de hoje', () => {
  const ops = [[30, 4], [31, 5], [32, 6], [33, 9]].map(([t, l]) => op('x', t, l));
  const r = plan(ops, { target: S.addDays(TODAY, 50) });
  const [cover, margin] = S.resultText(r).extra;
  assert.match(plain(cover), new RegExp(`^Embarcar até \\d\\d/\\d\\d faz ${r.coverP90.good} de ${r.coverP90.base} embarques parecidos chegarem ao porto até \\d\\d/\\d\\d \\(P90 do trânsito\\); até \\d\\d/\\d\\d, ${r.coverMedian.good} de ${r.coverMedian.base} \\(mediana\\)\\.$`));
  assert.equal(margin, `Margem até a chegada ao porto: ${r.margin} dias.`);
  assert.doesNotMatch(cover + margin, /Embarcando hoje|Para a entrega final/);
  const emb = plan(ops, { mode: 'embarcar', departure: S.addDays(TODAY, 1) });
  assert.match(S.resultText(emb).extra[0], /^Somando a perna nacional \(P90 de \d+ dias\), a entrega final seria por volta de \d\d\/\d\d \(mediana\) e \d\d\/\d\d \(P90\)\.$/);
  assert.deepEqual(S.resultText(plan([30, 31, 32].map((t) => op('x', t)), { mode: 'embarcar' })).extra, []);
});
