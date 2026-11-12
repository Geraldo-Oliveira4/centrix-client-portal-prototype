// Local visual-review fixture server; never connects to the project database.
import http from 'node:http';
import { buildPreviewData } from '../lib/offline/fixtures.ts';
const port = Number(process.env.PREVIEW_API_PORT || 8011);
const previewOrigin = process.env.PREVIEW_ORIGIN || 'http://localhost:3011';
const date = (offset) => {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const day = new Date(parts + 'T12:00:00Z'); day.setUTCDate(day.getUTCDate() + offset);
  return day.toISOString().slice(0, 10);
};
// Os cenários moram em lib/offline/fixtures.ts, a mesma fonte do modo offline
// do portal. Mesmos 15 embarques e 15 cotações de antes.
const { quotations, items } = buildPreviewData(date(0));
const buckets = { aguardando_dados: [], aguardando_aprovacao: [], buscando_propostas: [], finalizadas: quotations, cancelada: [] };
http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', previewOrigin);
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (req.method !== 'GET') { res.writeHead(405); return res.end(JSON.stringify({ message: 'Prévia visual: escrita não disponível.' })); }
  const pathname = new URL(req.url, 'http://localhost').pathname;
  let data;
  if (pathname === '/health') data = { status: 'ok' };
  else if (pathname === '/portal/shipments') data = { items, total: items.length, by_estado: items.reduce((r, s) => ({ ...r, [s.estado]: (r[s.estado] || 0) + 1 }), {}) };
  else if (pathname.startsWith('/portal/shipments/')) data = { shipment: items.find((s) => s.id === pathname.split('/')[3]) };
  else if (pathname === '/portal/quotations') data = { buckets, bucket_order: Object.keys(buckets), total: quotations.length, summary: { aprovar_propostas: 0, aguardando_propostas: 0 } };
  else if (pathname.startsWith('/portal/quotations/')) data = { quotation: quotations.find((q) => q.id === pathname.split('/')[3]) };
  else if (pathname === '/portal/clients/me') data = { client: { id: 'demo', name: 'Cliente Demo · Prévia UX', email: 'demo@cliente.local' } };
  else { res.writeHead(404); return res.end(JSON.stringify({ message: 'Endpoint fora desta prévia.' })); }
  res.end(JSON.stringify(data));
}).listen(port, '127.0.0.1', () => console.log('Centrix UX fixture: http://localhost:' + port));

