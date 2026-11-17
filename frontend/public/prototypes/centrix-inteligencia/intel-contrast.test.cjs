// E1 (17/11/2026): o acento laranja como SINAL GRÁFICO (fio da coluna líder,
// aba ativa, trecho com desvio, faixa de insight) precisa de 3:1 ou mais contra
// as superfícies onde aparece, nos temas claro e escuro (WCAG 1.4.11). Lê os
// tokens direto de style.css: mudou um token, o teste mede de novo.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const css = fs.readFileSync(path.join(__dirname, 'style.css'), 'utf8');
function block(selector) {
  const at = css.indexOf(selector + '{');
  assert.ok(at >= 0, selector);
  const body = css.slice(at, css.indexOf('}', at));
  return Object.fromEntries([...body.matchAll(/--([\w-]+):(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]));
}
const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const SURFACES = ['surface', 'surface-2', 'bg', 'tint'];

for (const [name, sel] of [['claro', ':root'], ['escuro', 'html.theme-dark:root']]) {
  test(`acento como sinal gráfico: 3:1 ou mais no tema ${name}`, () => {
    const t = block(sel);
    assert.ok(t['accent-mark'], 'token --accent-mark definido');
    for (const s of SURFACES) assert.ok(ratio(t['accent-mark'], t[s]) >= 3, `${name}: --accent-mark sobre --${s} = ${ratio(t['accent-mark'], t[s]).toFixed(2)}`);
  });
}
test('o fio da coluna líder e os outros sinais usam o tom de 3:1, não o laranja da marca', () => {
  for (const sel of ['table.compare th.lead-col .sort-button', '.intel-tab.active', '.stage-cell.has-dev', '.insight-line.accent']) {
    const rules = [...css.matchAll(new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\{[^}]*\\}', 'g'))].map((m) => m[0]);
    assert.ok(rules.length, sel);
    for (const r of rules) assert.doesNotMatch(r, /var\(--accent\)/, `${sel}: ${r}`);
  }
});
