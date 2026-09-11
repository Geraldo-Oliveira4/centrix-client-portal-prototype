// Local visual-review fixture server; never connects to the project database.
import http from 'node:http';
const date = (offset) => {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const day = new Date(parts + 'T12:00:00Z'); day.setUTCDate(day.getUTCDate() + offset);
  return day.toISOString().slice(0, 10);
};
const scenarios = [
  ['Componentes eletrônicos', 'Shanghai, China', 'Santos', 'analise_booking', 6, 4, true],
  ['Peças para linha de produção', 'Hamburgo, Alemanha', 'Santos', 'booking_divergente', 9, 5, true],
  ['Tecidos de algodão', 'Ningbo, China', 'Itajaí', 'solicitado', null, 0, false],
  ['Resinas industriais', 'Busan, Coreia do Sul', 'Santos', 'coletado', 2, 3, false],
  ['Equipamentos de laboratório', 'Frankfurt, Alemanha', 'Guarulhos', 'coletado', 1, 0, true],
  ['Ferramentas de precisão', 'Gênova, Itália', 'Itajaí', 'coletado', 5, 0, false],
  ['Bombas hidráulicas', 'Shanghai, China', 'Santos', 'coletado', 18, 0, false],
  ['Embalagens industriais', 'Qingdao, China', 'Paranaguá', 'coletado', null, 0, false],
  ['Acessórios metálicos', 'Ningbo, China', 'Santos', 'embarcado', -2, 0, false, 'AVAILABLE'],
  ['Sensores e controladores', 'Hamburgo, Alemanha', 'Santos', 'embarcado', -4, 2, false, 'DISCHARGE'],
  ['Motores elétricos', 'Busan, Coreia do Sul', 'Itajaí', 'embarcado', -6, 0, false, 'AVAILABLE'],
  ['Conexões de aço', 'Gênova, Itália', 'Santos', 'embarcado', -7, 0, false, 'AVAILABLE'],
  ['Filmes plásticos', 'Shanghai, China', 'Paranaguá', 'embarcado', -8, 0, false, 'AVAILABLE'],
  ['Material de manutenção', 'Qingdao, China', 'Santos', 'embarcado', -10, 0, false, 'AVAILABLE'],
  ['Válvulas industriais', 'Hamburgo, Alemanha', 'Itajaí', 'embarcado', -12, 0, false, 'AVAILABLE'],
];
const quotations = scenarios.map((s, i) => ({
  id: 'quote-' + (i + 1), reference: 'COT-2026-' + String(i + 1).padStart(4, '0'),
  state: 'FECHADA', service_type: 'IMPORTACAO', modal: i === 4 ? 'AEREO' : 'MARITIMO',
  tipo_embarque: 'FCL', tipo_cotacao: 'SPOT', data_cotacao: date(-20), origin: s[1],
  porto_embarque: s[1].split(',')[0], porto_destino: [s[2]], aeroporto_destino: i === 4 ? [s[2]] : null,
  product: s[0], client_reference: 'PO-' + (4582 + i), created_at: date(-20) + 'T12:00:00Z',
  updated_at: date(-1) + 'T12:00:00Z', incoterm: 'FOB', proposals: [], equipments: [], volumes: [],
  proposals_count: 0, best_proposal: null, closed_at: date(-19) + 'T12:00:00Z',
}));
const items = scenarios.map((s, i) => ({
  id: 'preview-' + (i + 1), referencia: 'EMB-2026-' + String(i + 1).padStart(4, '0'),
  client_reference: quotations[i].client_reference, estado: s[3], incoterm: 'FOB',
  modal: quotations[i].modal, tipo_embarque: 'FCL', tipo_despacho: 'DIRETO', carga_urgente: s[6],
  agente_nome: 'Agente Demo', quotation_id: quotations[i].id, created_at: date(-20) + 'T12:00:00Z', updated_at: date(-1) + 'T12:00:00Z',
  tracking: { first_eta: s[4] === null ? null : date(s[4] - s[5]), current_eta: s[4] === null ? null : date(s[4]),
    eta_is_actual: !!s[7], data_status: s[4] === null ? null : 'COMPLETE',
    last_milestone: s[7] ?? null, last_milestone_at: s[7] ? date(s[4]) + 'T12:00:00Z' : null, is_mock: true },
  agente: { id: 'agent-demo', nome: 'Agente Demo' }, containers: [], observacao: null,
}));
const buckets = { aguardando_dados: [], aguardando_aprovacao: [], buscando_propostas: [], finalizadas: quotations, cancelada: [] };
http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3011');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (req.method !== 'GET') { res.writeHead(405); return res.end(JSON.stringify({ message: 'Prévia visual: escrita não disponível.' })); }
  const pathname = new URL(req.url, 'http://localhost').pathname;
  let data;
  if (pathname === '/portal/shipments') data = { items, total: items.length, by_estado: items.reduce((r, s) => ({ ...r, [s.estado]: (r[s.estado] || 0) + 1 }), {}) };
  else if (pathname.startsWith('/portal/shipments/')) data = { shipment: items.find((s) => s.id === pathname.split('/')[3]) };
  else if (pathname === '/portal/quotations') data = { buckets, bucket_order: Object.keys(buckets), total: quotations.length, summary: { aprovar_propostas: 0, aguardando_propostas: 0 } };
  else if (pathname.startsWith('/portal/quotations/')) data = { quotation: quotations.find((q) => q.id === pathname.split('/')[3]) };
  else if (pathname === '/portal/clients/me') data = { client: { id: 'demo', name: 'Cliente Demo · Prévia UX', email: 'demo@cliente.local' } };
  else { res.writeHead(404); return res.end(JSON.stringify({ message: 'Endpoint fora desta prévia.' })); }
  res.end(JSON.stringify(data));
}).listen(8011, '127.0.0.1', () => console.log('Centrix UX fixture: http://localhost:8011'));

