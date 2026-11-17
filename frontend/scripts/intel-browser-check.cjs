#!/usr/bin/env node
// Roteiro de navegador da Inteligência (E2, 17/11/2026). Roda o mesmo roteiro
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
  await page.addInitScript(() => localStorage.setItem('centrix:inteligencia:onboarding-visto', '1'));
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
      const steps = await roteiro(page, base);
      for (const s of steps) { console.log(`${name} ${browser.version()}: ${s.ok ? 'ok   ' : 'FALHA'} ${s.name}${s.got != null ? ` (${s.got})` : ''}`); if (!s.ok) failed = true; }
      if (errors.length) { failed = true; console.log(`${name}: erros de página: ${errors.join(' | ')}`); }
    } catch (e) { failed = true; console.log(`${name}: FALHA ${e.message.split('\n')[0]}`); }
    await browser.close();
  }
  server.close();
  process.exit(failed ? 1 : 0);
})();
