#!/usr/bin/env node
// Verificador de saúde do backend do protótipo.
//
// Faz GET numa rota que USA O BANCO, mede o tempo e sai com erro em 5xx, outro
// não-2xx ou timeout. "Servidor no ar" não é "dados disponíveis": em 11/2026 o
// backend respondia 200 em /health e /docs enquanto toda rota de dados dava 500
// (o banco tinha deixado de existir). Por isso /health, /docs ou só o host são
// trocados por DB_PATH no mesmo host. O endereço NUNCA fica no código: vem da
// variável de ambiente BACKEND_HEALTH_URL (no GitHub Actions, de uma variável
// do repositório). Sem ela, avisa e sai com sucesso — um repositório sem a
// variável configurada não deve acender alerta.
//
//   BACKEND_HEALTH_URL=https://<backend>/portal/clients/me node scripts/check-health.mjs
//
// Variáveis:
//   BACKEND_HEALTH_URL         rota que lê o banco (padrão no mesmo host: /portal/clients/me)
//   BACKEND_HEALTH_TIMEOUT_MS  prazo por tentativa, padrão 60000 (um serviço
//                              que dorme pode levar dezenas de segundos para acordar)
//   BACKEND_HEALTH_SLOW_MS     acima disto a resposta passa, mas com aviso, padrão 10000
//
// Saída: 0 = respondeu (ou sem URL configurada); 1 = não respondeu / não-2xx.
// Sem dependências: Node 18+ (fetch nativo).

const url = (process.env.BACKEND_HEALTH_URL ?? '').trim();
const timeoutMs = Number(process.env.BACKEND_HEALTH_TIMEOUT_MS) || 60_000;
const slowMs = Number(process.env.BACKEND_HEALTH_SLOW_MS) || 10_000;
const inActions = process.env.GITHUB_ACTIONS === 'true';

const notice = (msg) => console.log(inActions ? `::notice::${msg}` : msg);
const warn = (msg) => console.log(inActions ? `::warning::${msg}` : `AVISO: ${msg}`);
const fail = (msg) => console.log(inActions ? `::error::${msg}` : `ERRO: ${msg}`);

if (!url) {
  notice(
    'BACKEND_HEALTH_URL não configurada: verificação pulada. ' +
      'Configure a variável do repositório para ativar (ver docs/INFRA.md).',
  );
  process.exit(0);
}

let parsed;
try {
  parsed = new URL(url);
} catch {
  fail('BACKEND_HEALTH_URL não é um endereço válido.');
  process.exit(1);
}
// Rota que lê o banco (o cliente da sessão demo). Rotas que não tocam no banco
// não servem de prova de saúde.
const DB_PATH = '/portal/clients/me';
const NO_DB_PATHS = ['', '/', '/health', '/docs', '/openapi.json'];
if (NO_DB_PATHS.includes(parsed.pathname.replace(/\/+$/, '') || '/')) {
  notice(`O caminho configurado não usa o banco; consultando ${DB_PATH} no mesmo host.`);
  parsed.pathname = DB_PATH;
  parsed.search = '';
}
// O host aparece no log do Actions; a query não, porque o endereço pode
// carregar algo que não deveria ir para um log público.
const label = parsed.host + parsed.pathname;

const started = performance.now();
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), timeoutMs);
let status = null;
let error = null;
try {
  const res = await fetch(parsed, {
    signal: controller.signal,
    headers: { 'cache-control': 'no-cache', 'user-agent': 'centrix-proto-health-check' },
  });
  status = res.status;
  await res.arrayBuffer().catch(() => undefined);
} catch (err) {
  error = controller.signal.aborted ? `sem resposta em ${timeoutMs} ms` : String(err?.cause?.code ?? err?.message ?? err);
} finally {
  clearTimeout(timer);
}
const elapsed = Math.round(performance.now() - started);

if (status !== null && status >= 200 && status < 300) {
  console.log(`OK ${label} respondeu ${status} em ${elapsed} ms`);
  if (elapsed > slowMs) {
    warn(`${label} respondeu, mas levou ${elapsed} ms (acima de ${slowMs} ms): provável serviço acordando.`);
  }
  process.exit(0);
}

fail(
  status !== null
    ? `${label} respondeu ${status} em ${elapsed} ms (esperado 2xx)` +
        (status >= 500 ? ': erro do servidor, provável banco indisponível.' : '.')
    : `${label} não respondeu (${error}) após ${elapsed} ms.`,
);
process.exit(1);
