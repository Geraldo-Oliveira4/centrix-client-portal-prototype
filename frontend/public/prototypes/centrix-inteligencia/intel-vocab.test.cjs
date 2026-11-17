// A4 (17/11/2026): "Agentes de carga" (plural de agente) e "Agente de carga"
// em todo o módulo: menu, títulos, colunas, fichas, filtros, dicas e ajuda.
// Nunca "cargas", nunca "Carga" com maiúscula no meio do nome. Este teste
// varre os arquivos da Inteligência e falha se a variante errada voltar.
//
// Fora da varredura, de propósito: o Simulador (intel-sim.js e o teste dele),
// que tem prompt próprio e não é alterado nesta rodada.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const HERE = __dirname;
const PORTAL = path.join(HERE, '..', '..', '..', 'app', 'portal', 'inteligencia');
const SKIP = new Set(['intel-sim.js', 'intel-sim.test.cjs', 'intel-vocab.test.cjs']);
const WRONG = [/agentes? de cargas/i, /agentes? de Carga/, /Agentes? De Carga/];

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
