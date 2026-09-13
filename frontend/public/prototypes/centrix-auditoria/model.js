/* Base exclusivamente demonstrativa; nenhum conector ou envio externo. */
(function (root) {
  const F = typeof module !== 'undefined' && module.exports ? require('./freight.js') : root.FreightAudit;
  const P = typeof module !== 'undefined' && module.exports ? require('./performance.js') : root.PerformanceAudit;
  const clone = value => JSON.parse(JSON.stringify(value));
  const line = (name, agreed, billed, note = '') => ({ name, agreed, billed, note });
  const invoice = (id, currency, lines, extra = {}) => ({ id, currency, lines, available: true, reference: true, recipient: 'financeiro@agente.example', ...extra });
  const check = (name, agreed, actual, unit, extra = {}) => ({ name, agreed, actual, unit, original: true, estimated: false, source: 'Eventos do transportador · amostra ilustrativa', ...extra });
  function performance(late = false) {
    return [check('Trânsito até o porto de destino', 35, late ? 43 : 35, 'dias', { note: 'Referência estimada na contratação; não é garantia contratual.' }), check('Transbordos', 1, 1, 'transbordo'), check('Free time concedido', 21, 21, 'dias', { source: 'Condição de serviço e confirmação · amostra ilustrativa', lowerIsWorse: true })];
  }
  function operation(id, supplier, po, route, agent, amount, billed, extra = {}) {
    return { id, supplier, po, route, agent, bl: `${agent.split(' ').pop().toUpperCase()}2608${id.slice(-2)}`, opened: '2026-09-01', updated: '2026-09-13', reference: `Condição aceita · ${id} · v2`, version: 1, external: false, requested: ['preco', 'performance'], invoices: [invoice(`FAT-${id}`, 'USD', [line('Frete e taxas contratadas', amount, billed)], { available: billed !== null })], checks: performance(), operationalRecipient: 'operacao@agente.example', timeline: [{ date: '2026-07-22', text: 'Referência de trânsito preservada: 35 dias até o porto.' }, { date: '2026-07-27', text: 'Partida realizada · evento do transportador.' }, { date: '2026-08-31', text: 'Chegada ao porto registrada · trânsito de 35 dias.' }], logs: [{ date: '2026-09-01', text: 'Auditoria aberta; fontes demonstrativas vinculadas.' }, { date: '2026-09-13', text: 'Verificações disponíveis comparadas à referência preservada.' }], ...extra };
  }
  function seed() {
    return [
      operation('0011', 'Eastbridge Components', 'PO-2026-084', 'Shanghai → Santos', 'Agente Alpha', 4425, 4620, { opened: '2026-09-08', reference: 'COT-2026-0001 · v3 · aceite preservado', invoices: [invoice('FAT-0011', 'USD', [line('Frete marítimo', 3800, 3800), line('THC destino', 550, 550), line('Documentation Fee', 75, 120), line('Taxa adicional', 0, 150, 'Sem previsão localizada na condição aprovada. Solicitar justificativa ou retificação.')])] }),
      operation('0012', 'Ningbo Industrial', 'PO-2026-091', 'Ningbo → Itapoá', 'Agente Beta', 3210, null, { opened: '2026-09-07' }),
      operation('0010', 'Nordwerk', 'PO-2026-077', 'Hamburgo → Santos', 'Agente Gamma', 5080, 5400, { checks: [check('Free time concedido', 21, 14, 'dias', { lowerIsWorse: true, source: 'Condição aceita e confirmação do serviço · amostra ilustrativa', note: 'Condição inferior à referência; a cobrança relacionada deve ser avaliada separadamente.' }), check('Trânsito até o porto de destino', 35, 35, 'dias')], cause: 'Motivo da alteração ainda não documentado.' }),
      operation('0009', 'Busan Precision', 'PO-2026-069', 'Busan → Navegantes', 'Agente Alpha', 2860, 2860, { opened: '2026-08-28' }),
      operation('0008', 'Delta Machinery', 'PO-2026-060', 'Roterdã → Santos', 'Agente Beta', 4120, 4120, { opened: '2026-09-10', checks: [check('Trânsito até o porto de destino', 35, 39, 'dias', { estimated: true, note: 'Previsão atual: 39 dias. Chegada ainda não realizada.' }), check('Transbordos', 1, null, 'transbordo', { pending: true })], timeline: [{ date: '2026-08-11', text: 'Referência estimada preservada: trânsito de 35 dias.' }, { date: '2026-08-16', text: 'Partida realizada.' }, { date: '2026-09-13', text: 'Previsão de chegada ao porto revisada para 24/09; ainda não realizada.' }] }),
      operation('0007', 'Liguria Parts', 'PO-2026-058', 'Gênova → Itapoá', 'Agente Gamma', 3960, 3960, { opened: '2026-08-26', checks: performance(true), cause: 'Causa ainda não comprovada. Nenhuma responsabilidade atribuída.', timeline: [{ date: '2026-07-09', text: 'Referência estimada preservada: 35 dias de trânsito.' }, { date: '2026-07-14', text: 'Partida realizada.' }, { date: '2026-08-26', text: 'Chegada ao porto realizada: 43 dias de trânsito; oito dias acima da referência.' }] }),
      operation('0013', 'Eastbridge Components', 'PO-2026-084', 'Shanghai → Santos', 'Agente Alpha', 2000, 2180, { opened: '2026-09-12', bl: 'ALPHA260913B', invoices: [invoice('FAT-0013-A', 'USD', [line('Frete marítimo', 2000, 2180)]), invoice('FAT-0013-B', 'BRL', [line('Serviço de destino', 500, 650), line('Desconto acordado', 0, -30)], { recipient: 'financeiro@destino.example', issuer: 'Operador de destino' }), invoice('FAT-0013-C', 'BRL', [line('Taxas do terminal', 300, null)], { available: false, recipient: '', issuer: 'Terminal de destino' })], checks: [check('Trânsito até o porto de destino', null, 36, 'dias', { original: false, note: 'Compromisso original não localizado. Não comparar com a previsão atual.' })] }),
    ].map(op => { op.logs[0].date = op.opened; return op; });
  }
  function financial(op) {
    const requested = op.requested.includes('preco');
    const invoices = requested ? op.invoices : [];
    const checked = invoices.filter(i => i.available && i.reference && i.lines.every(l => Number.isFinite(l.agreed) && Number.isFinite(l.billed)));
    const cases = checked.filter(i => op.freight ? i.lines.some(l => F.charge(l).question > 0) || F.exchange(op,i).question > 0 : i.lines.some(l => l.billed > l.agreed));
    const totals = {};
    for (const i of cases) {
      const difference = i.lines.reduce((sum,l)=>sum + (op.freight ? F.charge(l).question : Math.max(0,l.billed-l.agreed)),0);
      if (difference) totals[i.currency] = (totals[i.currency] || 0) + difference;
      const exchangeDifference = op.freight ? F.exchange(op,i).question : 0;
      if (exchangeDifference) totals.BRL = (totals.BRL || 0) + exchangeDifference;
    }
    const missing = invoices.length - checked.length;
    const rulePending = op.freight && requested ? F.coverage(op).pending : 0;
    return { requested, invoices, checked, cases, totals, missing, rulePending, complete: requested && invoices.length > 0 && missing === 0 && rulePending === 0, status: !requested ? 'outside' : cases.length ? 'deviation' : missing || rulePending || !invoices.length ? 'missing' : 'clean' };
  }
  function operational(op) {
    if (op.performanceAudit) return P.evaluate(op);
    const requested = op.requested.includes('performance');
    const checks = requested ? op.checks : [];
    const evaluated = checks.filter(c => c.original && Number.isFinite(c.agreed) && Number.isFinite(c.actual) && !c.estimated);
    const deviations = evaluated.filter(c => c.lowerIsWorse ? c.actual < c.agreed : c.actual > c.agreed);
    const missing = checks.filter(c => !c.original || !Number.isFinite(c.agreed) || (!Number.isFinite(c.actual) && !c.pending));
    const pending = checks.filter(c => c.original && Number.isFinite(c.agreed) && (c.estimated || c.pending));
    return { requested, checks, evaluated, deviations, missing, pending, complete: requested && checks.length > 0 && evaluated.length === checks.length, status: !requested ? 'outside' : deviations.length ? 'deviation' : missing.length || !checks.length ? 'missing' : pending.length ? 'pending' : 'clean' };
  }
  const normalize = text => String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  function filterOperations(operations, filters) {
    return operations.filter(op => (!filters.query || normalize([op.id, op.supplier, op.po, op.bl, op.route, op.agent].join(' ')).includes(normalize(filters.query))) && (!filters.agent || op.agent === filters.agent) && (!filters.supplier || op.supplier === filters.supplier) && (!filters.from || op.opened >= filters.from) && (!filters.to || op.opened <= filters.to));
  }
  function matches(op, dimension, preset) {
    const r = dimension === 'preco' ? financial(op) : operational(op);
    if (!r.requested) return preset === 'all';
    return preset === 'all' || (preset === 'deviation' && r.status === 'deviation') || (preset === 'missing' && (dimension === 'preco' ? r.missing > 0 || r.rulePending > 0 || !r.invoices.length : r.missing.length > 0 || !r.checks.length)) || (preset === 'clean' && r.complete && r.status === 'clean') || (preset === 'pending' && r.pending?.length > 0);
  }
  function summary(ops, dimension) {
    if (dimension === 'preco') {
      const totals = {}; let cases = 0, checked = 0, known = 0;
      ops.forEach(op => { const r = financial(op); cases += r.cases.length; checked += r.checked.length; known += r.invoices.length; Object.entries(r.totals).forEach(([c, n]) => totals[c] = (totals[c] || 0) + n); });
      return { totals, cases, checked, known };
    }
    const results = ops.map(operational).filter(r => r.requested);
    return { deviations: results.filter(r => r.deviations.length).length, cases: results.filter(r => r.deviations.length).length, checked: results.filter(r => r.complete).length, partial: results.filter(r => !r.complete && r.evaluated.length).length, known: results.length };
  }
  function complement(op, dimension, invoiceId) {
    const before = dimension === 'preco' ? financial(op).checked.length : operational(op).evaluated.length;
    let changed = false;
    if (dimension === 'preco') op.invoices.filter(i => !invoiceId || i.id === invoiceId).forEach(i => { if (!i.available || !i.reference) { i.available = true; i.reference = true; i.lines.forEach(l => { if (l.billed === null) l.billed = l.agreed; }); changed = true; } });
    if (dimension === 'performance') op.checks.forEach(c => { if (!c.original || !Number.isFinite(c.agreed)) { c.original = true; c.agreed = c.unit === 'dias' ? 35 : 1; changed = true; } });
    if (changed) { op.version++; const after = dimension === 'preco' ? financial(op).checked.length : operational(op).evaluated.length; op.logs.push({ date: '2026-09-13', text: `Complemento demonstrativo v${op.version} em ${dimension === 'preco' ? 'preço' : 'performance'}${invoiceId ? ' · '+invoiceId : ''}: antes, ${before} verificações concluídas; depois, ${after}. Fonte pendente vinculada; outra dimensão preservada.` }); }
    return changed;
  }
  function addExternal(ops, input) {
    const bl = input.bl.trim();
    const existing = ops.find(o => normalize(o.bl) === normalize(bl));
    if (existing) return { op: existing, existing: true };
    const op = operation(`EXT-${ops.filter(o => o.external).length + 1}`, input.supplier.trim(), input.po.trim(), input.route.trim() || 'Rota não informada', input.agent.trim() || 'Agente não informado', 2000, input.sample === 'partial' || !input.sample ? null : 2180, { external: true, bl, opened: '2026-09-13', requested: input.scope === 'both' ? ['preco', 'performance'] : [input.scope], operationalRecipient: '', reference: input.sample ? 'Proposta externa aceita · EX-DEMO · v1' : 'Referência ainda não identificada', logs: [{ date: '2026-09-13', text: 'Operação externa adicionada nesta prévia; arquivos não enviados ou interpretados.' }], filenames: input.filenames || [] });
    if (!input.sample) { op.invoices[0].reference = false; op.checks = [check('Prazo até o porto', null, null, 'dias', { original: false })]; op.timeline = []; }
    if (input.sample === 'clean') op.invoices[0].lines[0].billed = 2000;
    if (input.sample === 'partial') { op.checks = performance(true); op.timeline = [{date:'2026-07-09',text:'Referência estimada preservada: 35 dias.'},{date:'2026-07-14',text:'Partida realizada.'},{date:'2026-08-26',text:'Chegada ao porto registrada: trânsito de 43 dias.'}]; }
    if (!op.requested.includes('preco')) op.invoices = [];
    if (!op.requested.includes('performance')) { op.checks = []; op.timeline = []; }
    ops.push(op); return { op, existing: false };
  }
  function entryDimension(op, preferred) {
    const available = { preco:financial(op).checked.length > 0, performance:operational(op).evaluated.length > 0 };
    if (available[preferred]) return preferred;
    return op.requested.find(dim => available[dim]) || (op.requested.includes(preferred) ? preferred : op.requested[0]);
  }
  const api = { seed, clone, financial, operational, normalize, filterOperations, matches, summary, complement, addExternal, entryDimension };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AuditModel = api;
})(typeof globalThis === 'undefined' ? this : globalThis);
