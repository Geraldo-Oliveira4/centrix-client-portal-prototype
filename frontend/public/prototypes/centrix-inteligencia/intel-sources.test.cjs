const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('./data.js');
const E = require('./intel-engine.js');
const S = require('./intel-sources.js');

// D1 a D5 (17/11/2026): textos de "Como é calculado" validados com o time e a
// fonte de cada métrica num mapa único.
const D1 = 'Entrega final no prazo = entregas ao cliente realizadas até a data prevista de entrega ÷ entregas realizadas que tinham data prevista. A entrega é a recebida pelo cliente (fábrica ou armazém final), não a chegada ao porto.';
const D2 = 'Chegada ao destino no prazo = chegadas realizadas até a data prevista de chegada ÷ chegadas realizadas com data prevista. Considera o porto ou aeroporto de descarga.';

test('D1 e D2: as fórmulas validadas, palavra por palavra', () => {
  assert.equal(S.FORMULAS.final, D1);
  assert.equal(S.FORMULAS.port, D2);
  assert.equal(E.kpiDefinition(D, 'final', {})[1].text, D1);
  assert.equal(E.kpiDefinition(D, 'port', {})[1].text, D2);
});
test('D3: a definição da fixture diz o mesmo que o mapa, e a fórmula antiga sumiu', () => {
  assert.equal(D.metrics.final.definition, D1);
  assert.equal(D.metrics.port.definition, D2);
  for (const k of ['final', 'port']) {
    const all = E.kpiDefinition(D, k, {}).map((l) => l.text).join(' ');
    assert.doesNotMatch(all, /pronta para embarque|primeiro ETA|comprovante|Joinville/i, k);
  }
});
test('D4: fonte só pelo mapa; Entrega final afirmada, as outras a confirmar', () => {
  assert.equal(E.kpiDefinition(D, 'final', {})[0].text, 'Sistema de gestão de processos de importação');
  for (const k of ['ready', 'port', 'freight', 'count']) assert.equal(E.kpiDefinition(D, k, {})[0].text, 'Fonte a confirmar', k);
  assert.equal(S.sourceOf('desconhecida'), 'Fonte a confirmar');
});
test('D4: aviso de integração só na métrica que depende do sistema de gestão', () => {
  const fin = E.kpiDefinition(D, 'final', {});
  assert.deepEqual(fin.at(-1), { label: 'Disponibilidade', text: 'Disponível para clientes integrados ao sistema de gestão. Não faz parte da versão sem integração.', notice: true });
  for (const k of ['ready', 'port', 'freight', 'count']) assert.ok(!E.kpiDefinition(D, k, {}).some((l) => l.notice), k);
});
test('repositório público: fonte e fórmula em linguagem de negócio, sem nome de sistema, tabela ou coluna', () => {
  const texts = [...Object.values(S.SOURCES), ...Object.values(S.FORMULAS), S.INTEGRATED_NOTICE];
  for (const t of texts) assert.doesNotMatch(t, /inova|shipsgo|centrix|tabela|coluna|[a-z]+_[a-z]+|https?:/i, t);
});
