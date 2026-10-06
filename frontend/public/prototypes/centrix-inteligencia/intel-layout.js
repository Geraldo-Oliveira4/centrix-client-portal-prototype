'use strict';
// "Personalizar" da Inteligência (02/10/2026): o mesmo padrão da Home — um
// modal com um switch por bloco, rascunho até "Salvar", e "Restaurar padrão"
// sempre à vista. PURO: estado entra e sai; quem lê e grava o storage é app.js.
//
// O padrão é TUDO ligado nos dois modos, e o modo padrão é Completa. Bloco
// desconhecido (de uma versão antiga do layout) é descartado em vez de
// esconder um bloco novo por engano: a lista guardada é de OCULTOS, então um
// bloco acrescentado depois nasce visível.
(function (root) {
  const MODES = [['completa', 'Completa'], ['objetiva', 'Objetiva']];
  const BLOCKS = {
    completa: [
      { id: 'destaque', label: 'Entrega final no prazo', desc: 'O número principal, a variação e a tendência dos últimos meses.' },
      { id: 'funil', label: 'Onde o prazo se perde', desc: 'Prontidão → Chegada ao porto → Entrega final, com a maior queda.' },
      { id: 'kpis', label: 'Indicadores', desc: 'Prontidão, Chegada ao porto, Frete contratado e Embarques no recorte.' },
      { id: 'graficos', label: 'Gráficos', desc: 'Prazo por etapa e frete por mês, nos últimos 6 meses.' },
      { id: 'performance', label: 'Performance', desc: 'Etapas, Exportadores e Agentes de cargas.' },
      { id: 'precos', label: 'Preços e rotas', desc: 'Suas rotas, frequência e frete médio.' },
      { id: 'compromissos', label: 'Compromissos do serviço', desc: 'Prazos e condições combinados × realizados, só leitura.' },
    ],
    objetiva: [
      { id: 'kpis', label: 'Indicadores', desc: 'Os quatro números principais em uma linha.' },
      { id: 'q_prazo', label: 'Estou entregando no prazo?', desc: 'Entrega final no prazo e onde pesa mais.' },
      { id: 'q_frete', label: 'Quanto estou pagando de frete?', desc: 'Frete contratado, média por embarque e rota mais cara.' },
      { id: 'q_parceiros', label: 'Com quem trabalho melhor?', desc: 'Agente e exportador mais pontuais no recorte.' },
      { id: 'q_perda', label: 'Onde o prazo se perde?', desc: 'A etapa com mais atraso e a maior queda de prazo.' },
    ],
  };
  const STORE_KEY = 'centrix-proto-v2:intelligence-layout';
  const defaults = () => ({ mode: 'completa', hidden: { completa: [], objetiva: [] } });

  /** Normaliza o que veio do storage: modo válido, só ids conhecidos. */
  function normalize(raw) {
    const base = defaults();
    if (!raw || typeof raw !== 'object') return base;
    if (MODES.some(([m]) => m === raw.mode)) base.mode = raw.mode;
    for (const mode of Object.keys(BLOCKS)) {
      const known = new Set(BLOCKS[mode].map((b) => b.id));
      base.hidden[mode] = [...new Set((raw.hidden && raw.hidden[mode]) || [])].filter((id) => known.has(id));
    }
    return base;
  }
  function visibleBlocks(state, mode = state.mode) {
    return BLOCKS[mode].filter((b) => !state.hidden[mode].includes(b.id)).map((b) => b.id);
  }
  function setVisible(state, mode, id, on) {
    const hidden = new Set(state.hidden[mode]);
    if (on) hidden.delete(id); else hidden.add(id);
    return normalize({ ...state, hidden: { ...state.hidden, [mode]: [...hidden] } });
  }
  function setMode(state, mode) {
    return normalize({ ...state, mode });
  }
  /** "Restaurar padrão": todos os blocos de volta; o modo escolhido fica. */
  function reset(state) {
    return { ...defaults(), mode: normalize(state).mode };
  }
  function load(storage) {
    try { return normalize(JSON.parse(storage.getItem(STORE_KEY) || 'null')); } catch { return defaults(); }
  }
  function save(storage, state) {
    try { storage.setItem(STORE_KEY, JSON.stringify(normalize(state))); return true; } catch { return false; }
  }

  // VISÕES SALVAS ("Preparar relatório" › Salvar como minha visão). Uma visão
  // é o recorte inteiro: período, filtros, modo e blocos visíveis. Guardada pelo
  // MESMO mecanismo do Personalizar (store de demonstração, por usuário).
  const VIEWS_KEY = 'centrix-proto-v2:intelligence-views';
  const PERIOD_KEYS = ['period', 'start', 'end'];
  /** Captura a visão atual. `filterKeys` vem do motor (IntelEngine.FILTERS). */
  function captureView(name, params, state, filterKeys, id) {
    const q = new URLSearchParams();
    for (const k of [...PERIOD_KEYS, ...filterKeys]) { const v = params.get(k); if (v) q.set(k, v); }
    const n = normalize(state);
    return { id: id || 'v' + Date.now().toString(36), name: String(name || '').trim() || 'Minha visão', query: q.toString(), mode: n.mode, hidden: n.hidden };
  }
  /** O que restaurar: a query (vai para a URL como qualquer filtro) e o layout. */
  function restoreView(view) {
    return { query: view.query || '', layout: normalize({ mode: view.mode, hidden: view.hidden }) };
  }
  /** A visão está aplicada agora? (para destacar o chip) */
  function isActiveView(view, params, state, filterKeys) {
    const cur = captureView('', params, state, filterKeys, view.id);
    const sort = (q) => [...new URLSearchParams(q).entries()].sort().join('&');
    return sort(cur.query) === sort(view.query) && cur.mode === view.mode && JSON.stringify(cur.hidden) === JSON.stringify(normalize(view).hidden);
  }
  function loadViews(storage) {
    try { const v = JSON.parse(storage.getItem(VIEWS_KEY) || '[]'); return Array.isArray(v) ? v.filter((x) => x && x.id && x.name) : []; } catch { return []; }
  }
  function saveViews(storage, views) { try { storage.setItem(VIEWS_KEY, JSON.stringify(views)); return true; } catch { return false; } }
  function renameView(views, id, name) { const n = String(name || '').trim(); return n ? views.map((v) => (v.id === id ? { ...v, name: n } : v)) : views; }
  function deleteView(views, id) { return views.filter((v) => v.id !== id); }

  const api = { MODES, BLOCKS, STORE_KEY, VIEWS_KEY, defaults, normalize, visibleBlocks, setVisible, setMode, reset, load, save, captureView, restoreView, isActiveView, loadViews, saveViews, renameView, deleteView };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.IntelLayout = api;
})(typeof window !== 'undefined' ? window : globalThis);
