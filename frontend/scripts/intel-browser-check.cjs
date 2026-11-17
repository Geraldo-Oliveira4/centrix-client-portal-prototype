#!/usr/bin/env node
// Roteiro de navegador da Inteligência (E2 e Simulador v2/S10, 17/11/2026). Roda o mesmo roteiro
// em Chromium, Firefox e WebKit (Playwright) contra o protótipo estático, sem
// backend e sem Next: um servidor HTTP mínimo serve `public/`.
//
//   node scripts/intel-browser-check.cjs            # os três motores
//   node scripts/intel-browser-check.cjs webkit     # só um
//
// Motor que não abre (binário ou biblioteca de sistema ausente) sai como
// INDISPONÍVEL, nunca como aprovado. Código de saída 1 se algum passo falhar.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const pw = require('playwright');

const ROOT = path.join(__dirname, '..', 'public');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

async function roteiro(page, base) {
  const steps = [];
  const check = (name, ok, got) => steps.push({ name, ok: !!ok, got });
  await page.addInitScript(() => { try { localStorage.setItem('centrix:inteligencia:onboarding-visto', '1'); } catch { /* about:blank */ } });
  await page.goto(`${base}?embed=1&hoje=2026-11-13#executivo?period=previous`);
  await page.waitForSelector('.intel-head');
  const comp = await page.locator('.chip-edit').nth(1).innerText();
  check('A1 mês passado compara com o mês anterior inteiro', /01\/09 a 30\/09\/2026/.test(comp), comp);
  check('C1 minigráficos de barras', (await page.locator('.mini-bars').count()) >= 4);
  await page.click('#bloco-performance > summary');
  await page.waitForTimeout(200);   // o evento toggle é assíncrono
  const acc = await page.evaluate(() => [document.querySelector('#bloco-graficos').open, document.querySelector('#bloco-performance').open]);
  check('B3 abrir Performance recolhe Evolução', !acc[0] && acc[1], acc.join('/'));
  await page.click('#bloco-performance > summary');
  await page.waitForTimeout(200);   // o evento toggle é assíncrono
  const both = await page.evaluate(() => [document.querySelector('#bloco-graficos').open, document.querySelector('#bloco-performance').open]);
  check('A2 recolher Performance não mexe em Evolução', !both[0] && !both[1], both.join('/'));
  await page.locator('.chip-edit').first().click();
  await page.waitForTimeout(200);
  check('B2 chip abre o painel no Período', (await page.evaluate(() => document.activeElement.id)) === 'fa-period');
  for (let i = 0; i < 2 && (await page.evaluate(() => document.querySelector('#drawer').open)); i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(200); }
  check('B2 Esc devolve o foco ao chip', /chip-edit/.test(await page.evaluate(() => document.activeElement.className)));
  await page.goto(`${base}?embed=1&hoje=2026-11-13#executivo?aba=exportadores&sel=east`);
  await page.waitForSelector('#drawer a.sheet-link');
  await page.click('#drawer a.sheet-link');
  await page.waitForSelector('.sheet-back');
  check('B4 ficha aberta por link tem "← Voltar"', true);
  await page.click('.sheet-back');
  await page.waitForTimeout(400);
  check('B4 Voltar volta à ficha de origem', (await page.evaluate(() => document.querySelector('#drawer-title')?.textContent)) === 'Eastbridge Components');
  return steps;
}

// Simulador v2 (S10, 17/11/2026): fluxo completo nos dois modos, deep link,
// "Limpar", troca de fonte, modal sem base, ficha com Voltar e acessibilidade
// (rótulos, foco, contraste AA no claro e no escuro).
async function roteiroSimulador(page, base) {
  const steps = [];
  const check = (name, ok, got) => steps.push({ name, ok: !!ok, got });
  const go = async (hash, theme) => {
    await page.addInitScript((t) => { try { localStorage.setItem('centrix:inteligencia:onboarding-visto', '1'); if (t) localStorage.setItem('portal:theme', t); else localStorage.removeItem('portal:theme'); } catch { /* about:blank */ } }, theme || '');
    // about:blank antes: trocar só o hash não recarrega a página (e o tema não seria relido).
    await page.goto('about:blank');
    await page.goto(`${base}?embed=1&hoje=2026-11-13${hash}`);
    await page.waitForSelector('#aba-simulador');
  };
  const text = (sel) => page.evaluate((s) => document.querySelector(s)?.innerText || '', sel);
  await go('#executivo?aba=simulador');
  const phrase = await text('.sim-result .fact-text');
  check('S1/S3 exemplo preenchido com resultado à vista', /cobre \d+ de \d+/.test(phrase), phrase.slice(0, 90));
  check('S4 tabela por agente de carga', (await page.locator('.sim-agents-table tbody tr').count()) >= 2);
  check('S3 sem veredito Cabe/Não cabe', !/Cabe na data|Não cabe|Apertado/.test(await text('#aba-simulador')));
  const above = await page.evaluate(() => document.querySelector('.sim-result .fact-text').getBoundingClientRect().bottom <= innerHeight);
  check('S7 resultado acima da dobra', above);
  await page.click('[data-action="sim-mode"][data-mode="embarcar"]'); await page.waitForTimeout(250);
  check('S1 modo "Vou embarcar em"', /^Embarcando em/.test(await text('.sim-result .fact-text')));
  await go('#executivo?aba=simulador&srota=genova&smodal=maritimo&chegada=2027-01-20');
  check('deep link antigo + aditivo', (await page.inputValue('#sim-route')) === 'genova' && (await page.inputValue('#sim-date')) === '2027-01-20');
  await page.click('[data-action="sim-clear"]'); await page.waitForTimeout(250);
  check('S1 Limpar esvazia (modal incluído)', (await page.inputValue('#sim-modal')) === '' && /Escolha a origem/.test(await text('.sim-result')));
  await go('#executivo?aba=simulador');
  await page.click('.sim-adjust > summary'); await page.selectOption('#sim-source', 'meus'); await page.waitForTimeout(250);
  check('S5 troca de fonte rotulada', /Meus embarques/.test(await text('.sim-source')));
  await go('#executivo?aba=simulador&smodal=aereo&sfonte=meus');
  const nb = await text('.sim-result');
  check('S5 modal sem base: sem histórico suficiente', /Sem histórico suficiente para esta rota e modal/.test(nb), nb.slice(0, 60));
  await page.click('.sim-result [data-action="sim-source"]'); await page.waitForTimeout(250);
  check('S5 atalho para a fonte com base', /Referência agregada/.test(await text('.sim-source')));
  await go('#executivo?aba=simulador');
  await page.click('.sim-agents-table a.sheet-link'); await page.waitForSelector('.sheet-back');
  await page.click('.sheet-back'); await page.waitForTimeout(400);
  check('S4 agente abre a ficha e Voltar volta ao Simulador', (await page.evaluate(() => location.hash)).includes('aba=simulador'));
  // Acessibilidade
  const unlabeled = await page.evaluate(() => [...document.querySelectorAll('#aba-simulador select, #aba-simulador input')].filter((el) => !el.closest('label') && !(el.id && document.querySelector(`label[for="${el.id}"]`)) && !el.getAttribute('aria-label')).length);
  check('acessibilidade: todo campo tem rótulo', unlabeled === 0, unlabeled);
  check('acessibilidade: modo é radiogroup com aria-checked', (await page.locator('.sim-mode [role="radio"][aria-checked="true"]').count()) === 1);
  await page.focus('#sim-route'); await page.keyboard.press('Tab');
  check('acessibilidade: Tab leva ao modal', (await page.evaluate(() => document.activeElement.id)) === 'sim-modal');
  for (const theme of ['', 'dark']) {
    await go('#executivo?aba=simulador', theme);
    const worst = await page.evaluate(() => {
      const lum = (c) => { const v = c.match(/[\d.]+/g).slice(0, 3).map((x) => +x / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
      const bg = (el) => { for (let e = el; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor; if (!/rgba\(0, 0, 0, 0\)|transparent/.test(c)) return c; } return 'rgb(255,255,255)'; };
      const sels = ['.sim-result .fact-text', '.sim-cover', '.sim-reserve-note', '.sim-source', '.sim-measures li', '.sim-agents-table th .sort-label', '.sim-agents-table td small', '.sim-notes li', '.sim-task-foot', '.st-field', '.integrated-notice'];
      return sels.map((s) => { const el = document.querySelector(s); if (!el) return [s, null]; const a = lum(getComputedStyle(el).color), b = lum(bg(el)); return [s, Math.round(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 100) / 100]; }).filter(([, r]) => r != null).sort((x, y) => x[1] - y[1])[0];
    });
    const dark = await page.evaluate(() => document.documentElement.classList.contains('theme-dark'));
    check(`contraste AA no tema ${theme ? 'escuro' : 'claro'} (pior: ${worst[0]})`, worst[1] >= 4.5 && dark === !!theme, `${worst[1]}:1, tema escuro aplicado: ${dark}`);
  }
  return steps;
}

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = `http://localhost:${server.address().port}/prototypes/centrix-inteligencia/index.html`;
  const wanted = process.argv.slice(2).length ? process.argv.slice(2) : ['chromium', 'firefox', 'webkit'];
  let failed = false;
  for (const name of wanted) {
    let browser;
    try { browser = await pw[name].launch(); } catch (e) { console.log(`${name}: INDISPONÍVEL (${e.message.split('\n').find((l) => /missing|Executable|dependencies/i.test(l))?.replace(/[║\s]+/g, ' ').trim() || 'não abriu'})`); continue; }
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    try {
      const steps = [...await roteiro(page, base), ...await roteiroSimulador(page, base)];
      for (const s of steps) { console.log(`${name} ${browser.version()}: ${s.ok ? 'ok   ' : 'FALHA'} ${s.name}${s.got != null ? ` (${s.got})` : ''}`); if (!s.ok) failed = true; }
      if (errors.length) { failed = true; console.log(`${name}: erros de página: ${errors.join(' | ')}`); }
    } catch (e) { failed = true; console.log(`${name}: FALHA ${e.message.split('\n')[0]}`); }
    await browser.close();
  }
  server.close();
  process.exit(failed ? 1 : 0);
})();
