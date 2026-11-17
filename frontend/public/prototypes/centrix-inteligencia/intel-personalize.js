'use strict';
// "Personalizar a Inteligência" (v4, revisão de 13/11/2026). O MESMO modelo do
// "Personalizar a Home" (app/portal/home/lib/home-layout.ts): o cliente escolhe
// TEMAS e liga/desliga os CARDS de cada tema; a tela mostra só os cards ligados
// dos temas escolhidos. Não há perfis (gerente/analista): há personalização.
//
// PURO: estado entra e sai; quem lê e grava o storage é intel-page.js. Roda no
// navegador (window.IntelPersonalize) e sob node --test (intel-personalize.test.cjs).
//
// Três regras:
//   1. A ORDEM É FIXA. `CARDS` está na ordem da hierarquia da Visão geral
//      (resultado, apoio, evolução, detalhe por trecho). Personalizar só liga e
//      desliga; ninguém reordena.
//   2. O PADRÃO É TUDO LIGADO, e o formato guardado é o da Home
//      (`{ themes, enabled_cards }`). Tema ou card desconhecido é descartado;
//      valor ilegível volta ao padrão. A tela nunca depende do storage.
//   3. DESLIGAR UM TEMA DESLIGA OS CARDS DELE; religar traz o tema com tudo
//      ligado. Os cards dos outros temas não mudam (mesma regra do
//      `reconcileEnabledCards` da Home).
(function (root) {
  const THEMES = [['prazo', 'Prazo'], ['custo', 'Custo'], ['volume', 'Volume']];
  const CARDS = [
    { id: 'entrega_final', theme: 'prazo', label: 'Entrega final no prazo', desc: 'O resultado do período, com a variação' },
    { id: 'funil', theme: 'prazo', label: 'Onde o prazo se perde', desc: 'Prontidão, Chegada e Entrega final lado a lado' },
    { id: 'frete', theme: 'custo', label: 'Frete contratado', desc: 'O frete do período contra o anterior' },
    { id: 'embarques', theme: 'volume', label: 'Embarques no recorte', desc: 'O volume do período contra o anterior' },
    { id: 'evolucao_prazo', theme: 'prazo', label: 'Evolução do prazo por etapa', desc: 'Prazo por etapa nos últimos 6 meses' },
    { id: 'evolucao_frete', theme: 'custo', label: 'Evolução do frete', desc: 'Frete por mês nos últimos 6 meses' },
    { id: 'trechos', theme: 'prazo', label: 'Onde os tempos excedem o previsto', desc: 'Os 5 trechos da cadeia' },
  ];
  const STORE_KEY = 'centrix:inteligencia:personalizacao';
  const ONBOARDING_KEY = 'centrix:inteligencia:onboarding-visto';
  const THEME_IDS = THEMES.map(([id]) => id);
  const CARD_IDS = CARDS.map((c) => c.id);

  /**
   * Destino do "Ver detalhe" de cada bloco. UM MAPA SÓ, de propósito: os
   * destinos ainda serão validados com o time (ver a PR), e trocar um deles tem
   * de ser trocar uma linha. `portal` = rota do portal; `aba` = submódulo da
   * própria Inteligência. Card fora do mapa não mostra o link.
   */
  const DETAIL_LINKS = {
    entrega_final: { kind: 'portal', href: '/portal/embarques', name: 'Meus Embarques' },
    funil: { kind: 'portal', href: '/portal/embarques', name: 'Meus Embarques' },
    frete: { kind: 'aba', aba: 'rotas', name: 'Rotas' },
    embarques: { kind: 'portal', href: '/portal/embarques', name: 'Meus Embarques' },
    trechos: { kind: 'aba', aba: 'agentes', name: 'Agentes de carga' },
  };

  const defaults = () => ({ themes: [...THEME_IDS], enabled_cards: [...CARD_IDS] });

  /** Normaliza o que veio do storage: só ids conhecidos, na ordem canônica. */
  function normalize(raw) {
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.themes) || !Array.isArray(raw.enabled_cards)) return defaults();
    const themes = THEME_IDS.filter((t) => raw.themes.includes(t));
    const enabled = CARDS.filter((c) => themes.includes(c.theme) && raw.enabled_cards.includes(c.id)).map((c) => c.id);
    return { themes, enabled_cards: enabled };
  }
  /** Liga ou desliga um tema. Tema novo entra com os cards dele ligados. */
  function toggleTheme(state, theme) {
    const s = normalize(state);
    if (!THEME_IDS.includes(theme)) return s;
    const own = CARDS.filter((c) => c.theme === theme).map((c) => c.id);
    if (s.themes.includes(theme)) {
      return normalize({ themes: s.themes.filter((t) => t !== theme), enabled_cards: s.enabled_cards.filter((id) => !own.includes(id)) });
    }
    return normalize({ themes: [...s.themes, theme], enabled_cards: [...s.enabled_cards, ...own] });
  }
  /** Liga ou desliga um card. Card de tema não escolhido não liga. */
  function setCard(state, id, on) {
    const s = normalize(state);
    const card = CARDS.find((c) => c.id === id);
    if (!card || !s.themes.includes(card.theme)) return s;
    const set = new Set(s.enabled_cards);
    if (on) set.add(id); else set.delete(id);
    return normalize({ themes: s.themes, enabled_cards: [...set] });
  }
  /** Os cards que a Visão geral desenha, na ordem fixa da hierarquia. */
  function visibleCards(state) {
    return normalize(state).enabled_cards;
  }
  /** Para o painel: os temas escolhidos, cada um com os seus cards. */
  function cardsByTheme(state) {
    const s = normalize(state);
    return THEMES.filter(([id]) => s.themes.includes(id)).map(([id, label]) => ({
      id, label, cards: CARDS.filter((c) => c.theme === id).map((c) => ({ ...c, on: s.enabled_cards.includes(c.id) })),
    }));
  }
  const isDefault = (state) => JSON.stringify(normalize(state)) === JSON.stringify(defaults());

  function load(storage) {
    try { const raw = storage.getItem(STORE_KEY); return raw ? normalize(JSON.parse(raw)) : defaults(); } catch { return defaults(); }
  }
  function save(storage, state) {
    try { storage.setItem(STORE_KEY, JSON.stringify(normalize(state))); return true; } catch { return false; }
  }
  /** "Refazer personalização do zero": apaga a escolha; a ausência é o padrão. */
  function clear(storage) {
    try { storage.removeItem(STORE_KEY); return true; } catch { return false; }
  }
  /**
   * A introdução já foi vista? Storage indisponível conta como VISTA: sem onde
   * guardar o "já vi", o modal reabriria em toda entrada.
   */
  function onboardingSeen(storage) {
    try { return storage.getItem(ONBOARDING_KEY) === '1'; } catch { return true; }
  }
  function markOnboardingSeen(storage) {
    try { storage.setItem(ONBOARDING_KEY, '1'); return true; } catch { return false; }
  }

  const api = { THEMES, CARDS, STORE_KEY, ONBOARDING_KEY, DETAIL_LINKS, defaults, normalize, toggleTheme, setCard, visibleCards, cardsByTheme, isDefault, load, save, clear, onboardingSeen, markOnboardingSeen };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.IntelPersonalize = api;
})(typeof window !== 'undefined' ? window : globalThis);
