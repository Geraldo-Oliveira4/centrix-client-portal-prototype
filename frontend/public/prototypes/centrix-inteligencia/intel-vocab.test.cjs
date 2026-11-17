// A4 (17/11/2026): "Agentes de carga" (plural de agente) e "Agente de carga"
// em todo o módulo: menu, títulos, colunas, fichas, filtros, dicas e ajuda.
// Nunca "cargas", nunca "Carga" com maiúscula no meio do nome. Este teste
// varre os arquivos da Inteligência e falha se a variante errada voltar.
//
// S9 (17/11/2026, Simulador v2): o Simulador entrou na varredura, e "folga"
// saiu do módulo. O termo queria dizer duas coisas (dias até a data pedida e
// P90 − mediana); agora são "Margem até a data-alvo" e "Variação do trânsito".
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const HERE = __dirname;
const PORTAL = path.join(HERE, '..', '..', '..', 'app', 'portal', 'inteligencia');
const SKIP = new Set(['intel-vocab.test.cjs']);
const WRONG = [/agentes? de cargas/i, /agentes? de Carga/, /Agentes? De Carga/, /folga/i];

function files(dir, exts) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'assets' ? [] : files(p, exts);
    return exts.some((x) => e.name.endsWith(x)) && !SKIP.has(e.name) ? [p] : [];
  });
}

test('"Agente(s) de carga": nenhuma variante errada no módulo da Inteligência', () => {
  const all = [...files(HERE, ['.js', '.css', '.html', '.cjs']), ...files(PORTAL, ['.ts', '.tsx'])];
  assert.ok(all.length > 10, 'a varredura achou os arquivos do módulo');
  const hits = [];
  for (const f of all) {
    fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      for (const re of WRONG) if (re.test(line)) hits.push(`${path.relative(HERE, f)}:${i + 1}: ${line.trim().slice(0, 100)}`);
    });
  }
  assert.deepEqual(hits, []);
});

test('o submódulo e a coluna usam o nome padronizado', () => {
  const T = require('./intel-tabs.js');
  const E = require('./intel-engine.js');
  assert.equal(T.TABS.find(([id]) => id === 'agentes')[1], 'Agentes de carga');
  assert.equal(T.COLUMNS.ag[0][1], 'Agente de carga');
  assert.equal(E.FILTERS.find((f) => f.key === 'ag').label, 'Agente de carga');
});

test('Simulador: "Margem até a data-alvo" e "Variação do trânsito" no lugar de "folga"; sem veredito Cabe/Não cabe', () => {
  const page = fs.readFileSync(path.join(HERE, 'intel-page.js'), 'utf8'), sim = fs.readFileSync(path.join(HERE, 'intel-sim.js'), 'utf8');
  // F2: a frase do resultado mora no motor (IntelSim.resultText).
  assert.match(page + sim, /Margem até a data-alvo/);
  assert.match(page, /Variação do trânsito/);
  for (const src of [page, sim]) assert.doesNotMatch(src, /Cabe na data|N[ãa]o cabe|Apertado/);
  assert.equal(require('./intel-sim.js').STATUS, undefined, 'o selo antigo saiu do motor');
});
