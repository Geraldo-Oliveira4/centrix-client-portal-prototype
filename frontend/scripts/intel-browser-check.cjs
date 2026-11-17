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

// Simulador v2 (S10) e Simulador enxuto (E6, 17/11/2026): fluxo completo nos
// dois modos, deep links, "Limpar", troca de fonte, modal sem base, ficha com
// Voltar, estrutura da tela (cartão de resposta, blocos antes da tabela, selo
// único, tabela de 5/7 colunas, acordeão) e acessibilidade (rótulos, foco,
// teclado, contraste AA no claro e no escuro).
//
// SIM_BASELINE: o texto explicativo que o Simulador mostrava antes do
// enxugamento (PR #32, mesma URL de data fixa, chegada=2026-12-27), quebrado em
// fragmentos de informação. L1 (17/11/2026) tirou do acordeão o que aparecia
// duas vezes; por isso a conferência tem duas partes:
//   - SIM_BASELINE: fragmentos únicos, que precisam estar na página tal qual;
//   - SIM_MOVED: cada repetição removida e os fragmentos que continuam dizendo
//     a mesma coisa (no cartão, em Limites ou na Fórmula). Todos precisam estar.
// Nenhuma informação única pode sumir: frase nova de explicação entra aqui.
const SIM_BASELINE = [
  'Referência agregada da Freitas: Fonte a confirmar. Perna nacional: Fonte a confirmar.',
  'Disponível para clientes integrados ao sistema de gestão. Não faz parte da versão sem integração.',
  'Chegada ao destino (porto ou aeroporto de descarga): trânsito mediano 34 dias, P90 37 dias · 52 embarques com saída e chegada',
  'Entrega final = chegada ao destino + perna nacional (desembaraço e transporte até o cliente): mediana 6 dias, P90 9 dias · 36 embarques com chegada e entrega. Entra como reserva de dias (o P90), sem cobertura contada.',
  'Embarcar até 11/11 (já passou) faz 48 de 52 embarques parecidos chegarem ao porto até 18/12 (P90 do trânsito); até 14/11, 30 de 52 (mediana).',
  'Margem até a chegada ao porto: 35 dias.',
  'Trânsito = chegada ao destino − saída, em dias corridos. Mediana e P90 (o menor trânsito que cobre 90% dos casos, sempre um trânsito que aconteceu). Margem até a data-alvo = dias entre o embarque e a data-alvo. Cobertura = embarques do histórico cujo trânsito coube na margem ÷ embarques com saída e chegada; ela vale sempre para a chegada ao porto ou aeroporto. Variação do trânsito = P90 − mediana. Embarque limite = data da chegada ao porto − P90 do trânsito (ou − mediana). Com Entrega final, a chegada ao porto precisa acontecer até a data-alvo menos uma reserva de dias para desembaraço e transporte: o P90 da perna nacional (chegada → entrega ao cliente). Essa reserva somada ao P90 do trânsito é conservadora, e nenhuma cobertura é contada para a entrega final. Menos de 3 trânsitos: sem cálculo.',
  'pela data de saída, de 13/11/2025 até hoje',
  'O período do painel não se aplica ao Simulador.',
  'A referência agregada é recortada só por rota, modal, tipo de carga e período; os filtros globais valem para "Meus embarques".',
  'Histórico, não garantia. O resultado descreve o que aconteceu, não o que vai acontecer. A Freitas não se compromete com a data.',
  'Só embarques com chegada registrada. Os que estão em trânsito ou sem registro ficam fora, o que pode fazer o histórico parecer melhor do que é. Nesta simulação: 52 de 59 embarques com chegada registrada.',
  'Período: últimos 12 meses. O P90 mostra a cauda; épocas de pico podem variar.',
  'Modal separado: marítimo e aéreo nunca se misturam; modal sem base não simula.',
  'Dado, não veredito: as colunas são fatos do histórico, sem nota nem ranking. Com menos de 3 embarques, “Amostra pequena” e nenhuma cobertura calculada. O prometido é o que a proposta diz; o histórico mostra quantas vezes ele foi cumprido.',
  'Sem nota, ranking nem recomendação. Custos ficam fora desta prévia.',
];
const SIM_MOVED = [
  ['Referência agregada da Freitas · 52 de 59 embarques com chegada registrada', ['Referência agregada da Freitas', 'Nesta simulação: 52 de 59 embarques com chegada registrada.']],
  ['Para a entrega final até 27/12, a carga precisa chegar ao porto até 18/12 (reserva de 9 dias para desembaraço e transporte, o P90 dessa etapa).', ['Entrega final até 27/12 = chegada ao porto até 18/12 + reserva de 9 dias (P90 da etapa final).', 'perna nacional (desembaraço e transporte até o cliente)']],
  ['Embarcando hoje (13/11), 36 de 52 (69%) embarques parecidos chegaram ao porto até 18/12.', ['36 de 52 (69%)', 'embarcando hoje (13/11): chegaram ao porto até 18/12']],
  ['A reserva de dias da etapa final é o P90 dela somado ao P90 do trânsito; por isso é conservadora. A cobertura contada vale só para a chegada ao porto.', ['Essa reserva somada ao P90 do trânsito é conservadora, e nenhuma cobertura é contada para a entrega final.', 'ela vale sempre para a chegada ao porto ou aeroporto']],
  ['Últimos 12 meses, pela data de saída, de 13/11/2025 até hoje. O P90 existe para mostrar a cauda; épocas de pico podem variar. O período do painel não se aplica ao Simulador.', ['Período: últimos 12 meses. O P90 mostra a cauda; épocas de pico podem variar.', 'pela data de saída, de 13/11/2025 até hoje', 'O período do painel não se aplica ao Simulador.']],
  ['Só entram embarques com chegada registrada. Os que ainda estão em trânsito ou sem registro ficam fora, o que pode fazer o histórico parecer melhor do que é.', ['Só embarques com chegada registrada. Os que estão em trânsito ou sem registro ficam fora, o que pode fazer o histórico parecer melhor do que é.']],
  ['Marítimo e aéreo nunca se misturam. Modal sem base não simula.', ['Modal separado: marítimo e aéreo nunca se misturam; modal sem base não simula.']],
];

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
  const raw = (sel) => page.evaluate((s) => (document.querySelector(s)?.textContent || '').replace(/\s+/g, ' ').trim(), sel);
  await go('#executivo?aba=simulador');
  // E1/E5: cartão de resposta, uma frase e três números; exemplo com embarque no futuro.
  const answer = await text('.sim-answer');
  check('E1 frase de resposta curta', /^Para chegar ao porto até \d\d\/\d\d, embarque até \d\d\/\d\d\.$/.test(answer), answer);
  check('E5 exemplo não abre com "já passou"', !/já passou/.test(answer) && (await page.locator('.sim-figures .passed-tag').count()) === 0, answer);
  const figs = await page.$$eval('.sim-fig dt', (els) => els.map((e) => e.textContent));
  check('E1 três números: Embarcar até, Chegar ao porto até, Cobertura', figs.join('|') === 'Embarcar até|Chegar ao porto até|Cobertura', figs.join('|'));
  const cover = await text('.sim-fig:nth-child(3) .sim-fig-v'), pct = Number((cover.match(/\((\d+)%\)/) || [])[1]);
  check('E1/E5 cobertura a de b com percentual, parcial', /^\d+ de \d+ \(\d+%\)$/.test(cover.replace(/\s+/g, ' ')) && pct < 100, cover);
  check('E1 âncora da entrega final numa linha', /^Entrega final até \d\d\/\d\d = chegada ao porto até \d\d\/\d\d \+ reserva de \d+ dias \(P90 da etapa final\)\.$/.test(await text('.sim-anchor')), await text('.sim-anchor'));
  check('E1 botão de cotação dentro do cartão', (await page.locator('.sim-answer-card .sim-action a.button').count()) === 1 && /Leva origem, destino, modal e data-alvo\. Nenhum agente é pré-selecionado\./.test(await text('.sim-answer-card .sim-action')));
  check('E1 "Histórico, não garantia · Como é calculado"', /^Histórico, não garantia\s*·\s*Como é calculado$/.test(await text('.sim-honesty')), await text('.sim-honesty'));
  // E6: no máximo 4 blocos de texto visíveis antes da tabela (fora a entrada, os números e o botão).
  const blocks = await page.evaluate(() => {
    const table = document.querySelector('.sim-agents');
    return [...document.querySelectorAll('#aba-simulador p, #aba-simulador li')].filter((el) => el.offsetParent && !el.closest('.sim-task, .sim-figures, .sim-action') && (el.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING)).map((el) => el.className || el.tagName);
  });
  check('E6 no máximo 4 blocos de texto antes da tabela', blocks.length <= 4, blocks.join(', '));
  const visible = await page.evaluate(() => document.querySelector('#page').innerText);
  check('E2 um selo só, "Exemplo fictício"', (visible.match(/Exemplo fictício/g) || []).length === 1 && !/Exemplo ilustrativo|Dado de exemplo|Exemplo fictício preenchido|Hoje na demonstração/.test(visible));
  check('E2 "Referência agregada da Freitas" uma vez à vista', (visible.match(/Referência agregada da Freitas/g) || []).length === 1);
  check('E2 aviso de integração uma vez à vista', (visible.match(/Disponível para clientes integrados/g) || []).length === 1);
  // E4: tabela de 5 colunas; "Comparar com a proposta" traz as duas de promessa.
  const cols = () => page.locator('.sim-agents-table thead th').count();
  check('E4 tabela com 5 colunas por padrão', (await cols()) === 5, await cols());
  await page.click('[data-action="sim-compare"]'); await page.waitForTimeout(250);
  check('E4 "Comparar com a proposta" liga 7 colunas e grava comparar=1', (await cols()) === 7 && (await page.evaluate(() => location.hash)).includes('comparar=1') && (await page.getAttribute('[data-action="sim-compare"]', 'aria-pressed')) === 'true', await cols());
  await page.click('[data-action="sim-compare"]'); await page.waitForTimeout(250);
  check('E4 desligar volta a 5', (await cols()) === 5);
  // L2: o selo "Amostra pequena" fica em linha própria, abaixo do número de embarques.
  const tagGap = async () => page.evaluate(() => {
    const tag = document.querySelector('.sim-agents-table td .sample-tag'); if (!tag) return null;
    const range = document.createRange(); range.selectNodeContents(tag.parentElement.firstChild);
    const num = range.getBoundingClientRect(), t = tag.getBoundingClientRect();
    return Math.round(t.top - num.bottom);
  });
  check('L2 "Amostra pequena" abaixo do número, sem colar', (await tagGap()) >= 2, await tagGap());
  await page.click('[data-action="sim-compare"]'); await page.waitForTimeout(250);
  check('L2 idem com "Comparar com a proposta" ligado', (await tagGap()) >= 2, await tagGap());
  await page.click('[data-action="sim-compare"]'); await page.waitForTimeout(250);
  // E3: acordeão fechado por padrão; o gatilho do cartão abre e rola até ele.
  check('E3 acordeão fechado por padrão', (await page.getAttribute('#sim-como-t', 'aria-expanded')) === 'false' && (await page.evaluate(() => document.querySelector('#sim-como-body').hidden)));
  await page.click('.sim-honesty [data-action="sim-como-open"]'); await page.waitForTimeout(600);
  check('E3 "Como é calculado" do cartão abre, foca e grava como=1', (await page.getAttribute('#sim-como-t', 'aria-expanded')) === 'true' && (await page.evaluate(() => document.activeElement.id)) === 'sim-como-t' && (await page.evaluate(() => location.hash)).includes('como=1'));
  await page.keyboard.press('Enter'); await page.waitForTimeout(150);
  check('E3 teclado: Enter recolhe', (await page.getAttribute('#sim-como-t', 'aria-expanded')) === 'false');
  await page.keyboard.press('Space'); await page.waitForTimeout(150);
  check('E3 teclado: Espaço abre', (await page.getAttribute('#sim-como-t', 'aria-expanded')) === 'true');
  // E3/E6: com a data fixa da linha de base, o texto de antes está inteiro na página.
  await go('#executivo?aba=simulador&chegada=2026-12-27&como=1');
  check('E3 deep link como=1 abre o acordeão', (await page.getAttribute('#sim-como-t', 'aria-expanded')) === 'true');
  const all = (await raw('#aba-simulador')).replace(/\s+/g, ' ');
  const missing = [...SIM_BASELINE, ...SIM_MOVED.flatMap(([, now]) => now)].filter((ph) => !all.includes(ph));
  check(`E3/L1 nenhuma informação de antes se perdeu (${SIM_BASELINE.length} frases únicas, ${SIM_MOVED.length} repetições removidas com o equivalente na página)`, missing.length === 0, missing.map((m) => m.slice(0, 50)).join(' | '));
  // L1: cada frase uma vez no acordeão; no máximo cinco seções, na ordem; o resultado por extenso não repete o cartão.
  const times = (txt, ph) => txt.split(ph).length - 1;
  const accText = await raw('#sim-como-body');
  const counts = ['Só embarques com chegada registrada', 'Período: últimos 12 meses', 'Modal separado'].map((ph) => times(accText, ph));
  check('L1 "Só embarques com chegada registrada", "Período: últimos 12 meses" e "Modal separado" uma vez cada no acordeão', counts.every((n) => n === 1), counts.join('/'));
  const secs = await page.$$eval('#sim-como-body .sim-como-sec h3', (els) => els.map((e) => e.textContent));
  check('L1 até cinco seções, na ordem', secs.join('|') === 'De onde vem o histórico|O que é medido|O resultado por extenso|Fórmula|Limites', secs.join('|'));
  const extenso = await page.evaluate(() => [...document.querySelectorAll('#sim-como-body .sim-como-sec')].find((x) => x.querySelector('h3').textContent === 'O resultado por extenso')?.textContent || '');
  check('L1 "O resultado por extenso" não repete o cartão', /faz \d+ de \d+ embarques parecidos/.test(extenso) && /Margem até/.test(extenso) && !/Embarcando hoje|Para a entrega final|Para a chegada/.test(extenso), extenso.slice(0, 80));
  check('L1 aviso de integração no acordeão é frase, não bloco destacado', (await page.locator('#sim-como-body .integrated-notice').count()) === 0 && /Disponível para clientes integrados/.test(await raw('#sim-como-body .sim-source')));
  const inAcc = await raw('#sim-como-body');
  check('E3 o acordeão contém as notas, as definições, a reserva e "Dado, não veredito"', ['Histórico, não garantia.', 'Só embarques com chegada registrada.', 'Período: últimos 12 meses', 'Modal separado', 'Sem nota, ranking nem recomendação. Custos ficam fora desta prévia.', 'Dado, não veredito', 'Chegada ao destino (porto ou aeroporto de descarga)', 'Entrega final = chegada ao destino', 'Essa reserva somada ao P90 do trânsito é conservadora', 'vale sempre para a chegada ao porto', '52 de 59 embarques com chegada registrada', 'Disponível para clientes integrados'].every((x) => inAcc.includes(x)));
  check('E5/E4 data passada: frase neutra e "já passou" na tabela', /o embarque limite para essa data já passou/.test(await text('.sim-answer')) && (await page.locator('.sim-agents-table .passed-tag').count()) >= 1, await text('.sim-answer'));
  check('F3 sem escala "de 10" no Simulador', !/\b\d+ de 10\b|Cobre/.test(await raw('#aba-simulador')));
  const measures = await raw('.sim-measures');
  check('F4 "Chegada ao destino" dito uma vez', (measures.match(/porto ou aeroporto de descarga/gi) || []).length === 1, measures.slice(0, 80));
  check('S4 tabela por agente de carga', (await page.locator('.sim-agents-table tbody tr').count()) >= 2);
  check('S3 sem veredito Cabe/Não cabe', !/Cabe na data|Não cabe|Apertado/.test(await raw('#aba-simulador')));
  await go('#executivo?aba=simulador');
  const above = await page.evaluate(() => document.querySelector('.sim-answer').getBoundingClientRect().bottom <= innerHeight);
  check('S7 resultado acima da dobra', above);
  await page.click('[data-action="sim-mode"][data-mode="embarcar"]'); await page.waitForTimeout(250);
  check('S1 modo "Vou embarcar em"', /^Embarcando em/.test(await text('.sim-answer')) && (await page.locator('.sim-agents-table thead th').count()) === 4, await text('.sim-answer'));
  await go('#executivo?aba=simulador&srota=genova&smodal=maritimo&chegada=2027-01-20');
  check('deep link antigo + aditivo', (await page.inputValue('#sim-route')) === 'genova' && (await page.inputValue('#sim-date')) === '2027-01-20');
  await go('#executivo?aba=simulador&sprom=alpha:40');
  check('deep link antigo com sprom abre a comparação', (await page.locator('.sim-agents-table thead th').count()) === 7 && (await page.inputValue('#prom-alpha')) === '40');
  await go('#executivo?aba=simulador&srota=genova&smodal=maritimo&chegada=2027-01-20');
  await page.click('[data-action="sim-clear"]'); await page.waitForTimeout(250);
  check('S1 Limpar esvazia (modal incluído)', (await page.inputValue('#sim-modal')) === '' && /Escolha a origem/.test(await text('.sim-result')));
  await go('#executivo?aba=simulador');
  await page.click('.sim-adjust > summary'); await page.selectOption('#sim-source', 'meus'); await page.waitForTimeout(250);
  check('S5 troca de fonte rotulada', /Meus embarques/.test(await raw('.sim-source')) && /Meus embarques/.test(await text('.sim-adjust-title')));
  await go('#executivo?aba=simulador&smodal=aereo&sfonte=meus');
  const nb = await text('.sim-result');
  check('S5 modal sem base: sem histórico suficiente', /Sem histórico suficiente para esta rota e modal/.test(nb), nb.slice(0, 60));
  await page.click('.sim-result [data-action="sim-source"]'); await page.waitForTimeout(250);
  check('S5 atalho para a fonte com base', /Referência agregada/.test(await raw('.sim-source')));
  await go('#executivo?aba=simulador');
  await page.click('.sim-agents-table a.sheet-link'); await page.waitForSelector('.sheet-back');
  await page.click('.sheet-back'); await page.waitForTimeout(400);
  check('S4 agente abre a ficha e Voltar volta ao Simulador', (await page.evaluate(() => location.hash)).includes('aba=simulador'));
  // Acessibilidade
  await go('#executivo?aba=simulador&comparar=1');
  const unlabeled = await page.evaluate(() => [...document.querySelectorAll('#aba-simulador select, #aba-simulador input')].filter((el) => !el.closest('label') && !(el.id && document.querySelector(`label[for="${el.id}"]`)) && !el.getAttribute('aria-label')).length);
  check('acessibilidade: todo campo tem rótulo', unlabeled === 0, unlabeled);
  check('acessibilidade: modo é radiogroup com aria-checked', (await page.locator('.sim-mode [role="radio"][aria-checked="true"]').count()) === 1);
  await page.focus('#sim-route'); await page.keyboard.press('Tab');
  check('acessibilidade: Tab leva ao modal', (await page.evaluate(() => document.activeElement.id)) === 'sim-modal');
  for (const theme of ['', 'dark']) {
    await go('#executivo?aba=simulador&como=1&chegada=2026-12-27', theme);
    const worst = await page.evaluate(() => {
      const lum = (c) => { const v = c.match(/[\d.]+/g).slice(0, 3).map((x) => +x / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
      const bg = (el) => { for (let e = el; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor; if (!/rgba\(0, 0, 0, 0\)|transparent/.test(c)) return c; } return 'rgb(255,255,255)'; };
      const sels = ['.sim-answer', '.sim-anchor', '.sim-fig dt', '.sim-fig-v', '.sim-fig small', '.passed-tag', '.sim-honesty', '.sim-honesty .text-button', '.sim-como-toggle small', '.sim-como-sec p', '.sim-cover', '.sim-reserve-note', '.sim-source', '.sim-measures li', '.sim-agents-table th .sort-label', '.sim-agents-table td small', '.sim-notes li', '.sim-compare', '.sim-task-foot .text-button', '.st-field', '.integrated-notice'];
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
