const TYPES = {
  confirmado: "Eventos confirmados de tracking",
  eta: "Mudança de estimativa de chegada",
  excecao: "Exceção detectada",
  demurrage: "Risco de demurrage/detention",
  preco: "Oportunidade ou alta de preço",
  documentos: "Pendências documentais",
  aprovacao: "Aprovações pendentes",
};
const UNAVAILABLE = {
  demurrage: "Depende de condição contratual, marco inicial e calendário de cobrança capturados. Sem fonte validada nesta prévia.",
  preco: "Depende de fonte de preços comparável, amostra, período e regra de relevância. Fonte de mercado não validada nesta revisão.",
};
const QUICK_FILTERS = [
  { id: "all", label: "Todos", status: "all", owner: "all", job: "all" },
  { id: "mine", label: "Minha ação", status: "action", owner: "client", job: "all" },
  { id: "documents", label: "Pendências documentais", status: "all", owner: "all", job: "documents" },
  { id: "delays", label: "Atrasos", status: "all", owner: "all", job: "delays" },
  { id: "costs", label: "Risco de custos", status: "all", owner: "all", job: "costs" },
];
const DEMO_NOW = "2026-09-11T09:20:00-03:00";
const JOBS = { all: "Qualquer foco", documents: "Pendências documentais", delays: "Atrasos", costs: "Risco de custos" };
let items,
  selected = null,
  query = "",
  status = "all",
  type = "all",
  owner = "all",
  job = "all",
  importantOnly = false,
  priorityShipments,
  read,
  prepared,
  mobileOpen = false,
  prefs,
  draft,
  settingsTab = "shipments",
  settingsGlobal = false;
let toastTimer;
const normalize = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
function toast(text) {
  $("#toast").textContent = text;
  $("#toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("show"), 4000);
}
function init() {
  items = structuredClone(fixture);
  priorityShipments = new Set(
    items.filter((x) => x.shipment && x.important).map((x) => x.shipment),
  );
  items.forEach((x) => delete x.important);
  selected = null;
  query = "";
  status = type = owner = "all";
  job = "all";
  importantOnly = false;
  read = new Set();
  prepared = new Set();
  mobileOpen = false;
  prefs = {
    tolerance: 0,
    delivery: Object.fromEntries(
      Object.keys(TYPES).map((t) => [
        t,
        { enabled: !UNAVAILABLE[t], portal: !UNAVAILABLE[t], email: false, whatsapp: false },
      ]),
    ),
  };
  $("#search").value = "";
  render();
}
function filtered(x, filterStatus = status, filterOwner = owner, filterJob = job) {
  return (
    (filterStatus === "history" || x.group !== "history") &&
    AlertRules.matchesJob(x, filterJob, DEMO_NOW) &&
    (filterStatus === "all" ||
      (filterStatus === "unread" && !read.has(x.id)) ||
      x.group === filterStatus) &&
    (type === "all" || x.type === type) &&
    (filterOwner === "all" || x.owner === filterOwner) &&
    (!importantOnly || priorityShipments.has(x.shipment)) &&
    normalize(
      [x.po, x.cargo, x.supplier, x.title, x.shipment, x.quote, x.origin, x.destination].join(" "),
    ).includes(normalize(query))
  );
}
function visible() {
  return items
    .filter(x => filtered(x))
    .sort((a, b) => AlertRules.compare(a, b, priorityShipments));
}
function badge(x) {
  const tone = AlertRules.tone(x);
  return `<span class="badge ${tone}">${icon(x.group === "history" ? "check" : tone === "red" ? "alert" : x.type === "preco" ? "chart" : x.type === "confirmado" ? "ship" : "info")}${x.badge}</span>`;
}
function arrival(x) {
  return `<div class="card-arrival"><small>${x.arrivalLabel}</small><strong>${x.arrival || x.arrivalMissing || "Sem previsão"}</strong>${x.previousArrival ? `<span class="arrival-change">Antes ${x.previousArrival} · +3 dias</span>` : ""}</div>`;
}
function shipmentPriority(x) {
  const active = priorityShipments.has(x.shipment);
  return `<button class="btn shipment-priority ${active ? "is-priority" : ""}" data-priority-shipment="${x.shipment}" aria-pressed="${active}">${icon("star")}${active ? "Embarque prioritário" : "Priorizar embarque"}</button>`;
}
function contextLink(x) {
  const target = AlertRules.destination(x);
  return target ? `<a class="shipment-link" href="${target.href}" aria-label="${target.label} ${target.reference}">${icon(target.kind === "cotacao" ? "file" : "ship")}<span>${target.label}<small>${target.reference}</small></span>${icon("arrow")}</a>` : "";
}
function card(x) {
  const tone = AlertRules.tone(x);
  return `<article class="card tone-${tone} ${x.id === selected ? "selected" : ""}" data-id="${x.id}">
    <button class="card-main" data-open="${x.id}" aria-haspopup="dialog" aria-label="${esc((x.po || x.cargo) + " — " + x.title)}">
      <div class="alert-card-content"><div class="alert-copy">
        <div class="alert-eyebrow">${badge(x)}<span class="read-state">${read.has(x.id) ? "Visto" : '<i class="new-dot"></i>Não visto'}</span></div>
        <h3>${x.title}</h3><p class="card-summary">${x.summary}</p><p class="source-caption">${x.source}</p>
        <p class="alert-context">${x.po ? `<strong>PO ${x.po}</strong><span>·</span>${x.cargo}<span>·</span>${x.supplier}` : `<strong>${x.cargo}</strong><span>·</span>Radar de Preços`}</p>
      </div>${x.shipment ? arrival(x) : x.quote ? `<div class="card-arrival"><small>Cotação</small><strong>${x.quote}</strong><span>${x.stage}</span></div>` : `<div class="card-arrival price-metric"><small>Variação de referência</small><strong>${x.price}</strong><span>Sem oferta firme</span></div>`}</div>
    </button>
    <div class="card-footer"><span class="owner">${icon("user")}${x.person}${x.group === "action" ? `<span class="deadline">· ${x.deadline || "Prazo não informado"}</span>` : ""}</span><span class="when">${x.when}</span><button class="seen" data-read="${x.id}" aria-label="Marcar ${x.po || x.cargo} como visto" ${read.has(x.id) ? "disabled" : ""}>${read.has(x.id) ? "Visto" : "Marcar como visto"}</button><div class="card-actions"><button class="card-cta" data-open="${x.id}" aria-haspopup="dialog">${AlertRules.cta(x)}${icon("arrow")}</button>${contextLink(x)}</div></div>
  </article>`;
}
function render() {
  const active = document.activeElement;
  const focusKey = active?.dataset.action ? `[data-action="${active.dataset.action}"]` : active?.dataset.read ? `[data-read="${active.dataset.read}"]` : null;
  const list = visible();
  $("#quick-filters").innerHTML = QUICK_FILTERS.map(preset => {
    const count = items.filter(x => filtered(x, preset.status, preset.owner, preset.job)).length;
    const active = status === preset.status && owner === preset.owner && job === preset.job;
    const caption = preset.job === "costs" ? "Sem base" : count;
    const accessibleCount = preset.job === "costs" ? "base de cálculo indisponível" : `${count} ${count === 1 ? "alerta" : "alertas"}`;
    return `<button type="button" class="quick-filter" data-preset="${preset.id}" aria-pressed="${active}" aria-label="${preset.label}, ${accessibleCount}">${preset.label}<span>${caption}</span></button>`;
  }).join("");
  renderFilterChips();
  $("#active-total").textContent = items.filter(x => x.group !== "history").length;
  $("#result-count").textContent = status === "history" ? `${list.length} registros no histórico` : `${list.length} ${list.length === 1 ? "alerta" : "alertas"} neste recorte`;
  $("#sort-label").textContent = "Ações e acompanhamentos primeiro";
  const mine = items.filter(x => x.group === "action" && x.owner === "client").length;
  $("#attention-summary").innerHTML = `<strong>${mine} ${mine === 1 ? "pendência depende" : "pendências dependem"} de você.</strong> Veja o que fazer e acompanhe as demais atualizações.`;
  $("#cards").innerHTML = list.length
    ? list.map(card).join("")
    : job === "costs" ? '<div class="empty"><h3>Falta base para avaliar risco de custos</h3><p>É preciso capturar a condição contratual, o marco inicial e a regra de cobrança. A falta desses dados não significa ausência de risco.</p></div>' : '<div class="empty"><h3>Nenhum alerta neste recorte</h3><p>Experimente outro termo ou ajuste os filtros acima.</p></div>';
  renderDetail();
  if (focusKey) {
    const target = (mobileOpen ? $("#detail") : $("#cards")).querySelector(focusKey);
    if (target && !target.disabled) target.focus({ preventScroll: true });
    else if (mobileOpen) $('#detail [data-action="close"]')?.focus({ preventScroll: true });
    else if (active?.dataset.read) {
      const restore = document.querySelector(`[data-open="${active.dataset.read}"]`) || document.querySelector('#quick-filters [aria-pressed="true"]') || $("#search");
      restore.focus({ preventScroll: true });
    }
  }
}
function evidence(x) {
  const contextHelp = x.context === "cotacao"
    ? "PO, carga e fornecedor precisam estar vinculados à cotação no Centrix. Este alerta usa o registro da proposta; não requer tracking ou embarque."
    : "PO, carga, fornecedor e vínculo ao tracking precisam ser cadastrados/importados no Centrix. A ShipsGo não fornece essas relações comerciais. As chegadas exibidas dependem de ARRV / EST no destino; ausência aparece sem previsão.";
  return `<dl class="capture-contract"><dt>Fonte</dt><dd>${x.source}</dd><dt>Dados necessários</dt><dd>${x.fields}</dd><dt>Regra para gerar o alerta</dt><dd>${x.trigger}</dd><dt>Disponibilidade técnica</dt><dd>${x.dependency}</dd></dl><p>${contextHelp}</p>`;
}
function timeline(x) {
  return `<ol class="history-list">${x.events.map(([date, text]) => `<li>${text}<small>${date}</small></li>`).join("")}</ol>`;
}
function actionUI(x) {
  if (x.group === "history")
    return `<span class="badge green">${icon("check")}Ocorrência concluída</span>`;
  const actions = {
    booking: ["approve", "Simular aprovação da versão 1", "Registra a decisão do cliente; não confirma o booking com o armador."],
    eta: [
      "ack",
      x.ack ? "Planejamento atualizado" : "Já considerei no planejamento",
      "Registra ciência sem alterar a previsão.",
    ],
    conflict: ["read", "Marcar como visto", "A previsão continuará indisponível até novo dado da fonte."],
    confirmed: [
      "read",
      "Marcar como visto",
      "A confirmação continua no histórico de alertas.",
    ],
  };
  if (x.action === "docs")
    return `<button class="btn primary" data-action="${prepared.has(x.id) ? "send-doc" : "prepare-doc"}">${icon("file")}${prepared.has(x.id) ? "Simular envio da packing list" : "Selecionar packing list de exemplo"}</button><p>${prepared.has(x.id) ? "Arquivo fictício selecionado. Será registrado somente o recebimento." : "Nenhum arquivo real será enviado ou conferido nesta prévia."}</p>`;
  if (x.action === "price")
    return `<a class="btn primary" href="#radar/${x.id}">Ver referência no Radar</a>`;
  const [action, label, help] = actions[x.action] || [
    "read",
    "Marcar como visto",
    "A situação da ocorrência será mantida.",
  ];
  return `<button class="btn ${["approve", "ack"].includes(action) ? "primary" : ""}" data-action="${action}">${label}</button><p>${help}</p>`;
}
function recordLinks(x) {
  const target = AlertRules.destination(x);
  if (!target) return "";
  return `<div class="record-links"><a href="${target.href}">${icon(target.kind === "cotacao" ? "file" : "ship")}${target.label} ${target.reference}${icon("arrow")}</a>${x.shipment && x.quote && target.kind === "embarque" ? `<a href="#cotacao/${x.id}">${icon("file")}Ver cotação vinculada ${icon("arrow")}</a>` : ""}</div>`;
}
function renderDetail() {
  const x = items.find((a) => a.id === selected),
    modal = mobileOpen && !!x;
  $("#detail").classList.toggle("mobile-open", modal);
  $("#detail-backdrop").hidden = !modal;
  document.body.style.overflow = modal ? "hidden" : "";
  document
    .querySelectorAll(
      ".skip,.sidebar,.topbar,.heading,.area-tabs,.toolbar,.quick-filters,.filters,.alert-overview,.queue,footer",
    )
    .forEach((el) => (el.inert = modal));
  if (modal) {
    $("#detail").setAttribute("role", "dialog");
    $("#detail").setAttribute("aria-modal", "true");
  } else {
    $("#detail").removeAttribute("role");
    $("#detail").removeAttribute("aria-modal");
  }
  if (!x) {
    $("#detail").innerHTML =
      '<div class="empty"><h3>Selecione um alerta</h3><p>Veja o contexto e resolva por aqui.</p></div>';
    return;
  }
  $("#detail").innerHTML =
    `<div class="detail-head"><div class="detail-top"><span>${x.shipment || x.quote || "Radar de preços"}</span><button class="icon-btn mobile-close" data-action="close" aria-label="Voltar para a fila">×</button><button class="seen" data-read="${x.id}">${read.has(x.id) ? "Visto" : "Marcar como visto"}</button></div><h3>${x.po ? "PO " + x.po : x.cargo}</h3><p class="identity">${x.po ? x.cargo + "<br>" + x.supplier : "Referência por rota"}</p>${x.shipment ? `<div class="detail-arrival">${arrival(x)}</div>` : ""}</div><div class="detail-body">${badge(x)}<div class="fact" style="margin-top:12px"><strong>${x.fact}</strong><p>${x.explain}</p></div><div class="fact-title">${x.group === "history" ? "Situação" : "Próximo passo"}</div><p>${x.group === "history" ? "Esta ocorrência está concluída." : x.next}</p><dl class="facts-grid"><div><dt>Responsável</dt><dd>${x.person}</dd></div><div><dt>Prazo da ação</dt><dd>${x.group === "history" ? "Concluído" : x.deadline || "Não informado"}</dd></div></dl><div class="callout">${x.impact}</div><details class="evidence"><summary>Origem dos dados e regra do alerta ${icon("chevron")}</summary>${evidence(x)}</details><details class="evidence"><summary>Histórico do alerta <span>${x.events.length} registros ${icon("chevron")}</span></summary>${timeline(x)}</details><div class="evidence"><p><strong>Fonte:</strong> ${x.source}<br>Consultada em ${x.checked}</p></div></div><div class="detail-actions">${actionUI(x)}${recordLinks(x)}</div>`;
}
function complete(x, text) {
  x.group = "history";
  x.badge = "Concluído";
  x.tone = "green";
  x.fact = x.title = text;
  x.when = "Agora · simulação";
  x.rank = 0;
  x.explain =
    "A confirmação foi registrada neste cenário. Os eventos anteriores estão preservados.";
  x.summary = "Conclusão registrada. Consulte o histórico do alerta.";

  x.events.unshift(["Agora · simulação", text]);
  read.add(x.id);
  render();
  toast("Confirmação simulada. Alerta concluído e mantido no histórico.");
}
function togglePriority(shipment) {
  if (!items.some((x) => x.shipment === shipment)) return;
  priorityShipments.has(shipment)
    ? priorityShipments.delete(shipment)
    : priorityShipments.add(shipment);
  render();
  if ($("#record").open) {
    showRecord();
    $("#record [data-priority-shipment]").focus();
  }
  toast(
    priorityShipments.has(shipment)
      ? "Embarque marcado como prioritário."
      : "Prioridade do embarque removida.",
  );
}
function clearFilters() {
  query = "";
  status = type = owner = "all";
  job = "all";
  importantOnly = false;
  $("#search").value = "";
  render();
}
document.addEventListener("click", (e) => {
  const quickFilter = e.target.closest("[data-preset]");
  if (quickFilter) {
    const preset = QUICK_FILTERS.find(p => p.id === quickFilter.dataset.preset);
    status = preset.status;
    owner = preset.owner;
    job = preset.job;
    render();
    document.querySelector(`[data-preset="${preset.id}"]`).focus({ preventScroll: true });
    return;
  }
  const priority = e.target.closest("[data-priority-shipment]");
  if (priority) {
    togglePriority(priority.dataset.priorityShipment);
    return;
  }
  const remove = e.target.closest("[data-remove-filter]");
  if (remove) {
    const key = remove.dataset.removeFilter;
    if (key === "status") status = "all";
    if (key === "type") type = "all";
    if (key === "owner") owner = "all";
    if (key === "job") job = "all";
    if (key === "priority") importantOnly = false;
    render();
    return;
  }
  const open = e.target.closest("[data-open]");
  if (open) {
    selected = open.dataset.open;
    mobileOpen = true;
    render();
    if (mobileOpen) $('#detail [data-action="close"]').focus();
    return;
  }
  const seen = e.target.closest("[data-read]");
  if (seen) {
    read.add(seen.dataset.read);
    render();
    toast("Visto. A situação do alerta foi mantida.");
    return;
  }
  const btn = e.target.closest("[data-action]");
  if (btn) {
    const x = items.find((x) => x.id === selected);
    switch (btn.dataset.action) {
      case "close":
        mobileOpen = false;
        renderDetail();
        (document.querySelector(`[data-open="${selected}"]`) || document.querySelector('#quick-filters [aria-pressed="true"]') || $("#search")).focus();
        break;
      case "prepare-doc":
        prepared.add(x.id);
        renderDetail();
        $('#detail [data-action="send-doc"]').focus();
        break;
      case "send-doc":
        x.impact = "Recebimento do arquivo registrado. Nenhuma conferência de conteúdo ou liberação foi realizada.";
        complete(x, "Packing list anexada");
        break;
      case "approve":
        x.impact = "Decisão da empresa registrada sobre a versão 1. Não confirma reserva com o armador nem avanço físico.";
        complete(x, "Proposta de booking aprovada pelo cliente");
        break;
      case "ack":
        read.add(x.id);
        x.ack = true;
        render();
        toast("Ciência registrada. A previsão foi mantida.");
        break;
      case "read":
        read.add(x.id);
        render();
        toast("Alerta marcado como visto.");
        break;
    }
    return;
  }
  const settingsSwitch = e.target.closest("[data-settings-tab]");
  if (settingsSwitch) {
    captureDraft();
    settingsTab = settingsSwitch.dataset.settingsTab;
    renderSettings();
    return;
  }
  const close = e.target.closest("[data-close]");
  if (close) {
    close.closest("dialog").close();
    return;
  }
});
const STATUS = {
  all: "Todas",
  action: "Precisam de ação",
  change: "Mudanças e atualizações",
  history: "Histórico",
  unread: "Não vistos",
};
const OWNERS = {
  all: "Todos",
  client: "Minha empresa",
  external: "Terceiros",
  unknown: "Sem responsável",
};
const filterIcon =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 17h16M9 4v6M15 14v6"/></svg>';
function renderFilterChips() {
  const chips = [];
  const presetActive = QUICK_FILTERS.some(p => status === p.status && owner === p.owner && job === p.job);
  if (!presetActive && job !== "all") chips.push(["job", JOBS[job]]);
  if (!presetActive && status !== "all") chips.push(["status", STATUS[status]]);
  if (type !== "all") chips.push(["type", TYPES[type]]);
  if (!presetActive && owner !== "all") chips.push(["owner", OWNERS[owner]]);
  if (importantOnly) chips.push(["priority", "De embarques prioritários"]);
  $("#open-filters").innerHTML =
    filterIcon +
    "Filtrar" +
    (chips.length ? `<span class="filter-count">${chips.length}</span>` : "");
  $("#active-filters").hidden = !chips.length;
  $("#active-filters").innerHTML =
    chips
      .map(
        ([key, label]) =>
          `<button class="applied-filter" data-remove-filter="${key}" aria-label="Remover filtro: ${label}">${label}<span aria-hidden="true">×</span></button>`,
      )
      .join("") +
    (chips.length
      ? '<button class="clear-filter" id="clear-filters">Limpar filtros</button>'
      : "");
  if ($("#clear-filters")) $("#clear-filters").onclick = clearFilters;
}
function filterGroup(name, title, options, value) {
  return `<fieldset class="filter-section"><legend>${title}</legend><div class="filter-choices">${Object.entries(
    options,
  )
    .map(
      ([id, label]) =>
        `<label class="filter-choice"><input type="radio" name="${name}" value="${id}" ${id === value ? "checked" : ""}><span>${label}</span></label>`,
    )
    .join("")}</div></fieldset>`;
}
function renderFilterOptions(reset = false) {
  $("#filter-options").innerHTML =
    filterGroup("status", "Situação", STATUS, reset ? "all" : status) +
    filterGroup("job", "Foco", JOBS, reset ? "all" : job) +
    filterGroup(
      "type",
      "Tipo de alerta",
      { all: "Todos os tipos", ...TYPES },
      reset ? "all" : type,
    ) +
    filterGroup("owner", "Responsável", OWNERS, reset ? "all" : owner) +
    `<fieldset class="filter-section"><legend>Embarques</legend><label class="priority-filter-option"><input type="checkbox" name="priority" ${!reset && importantOnly ? "checked" : ""}><span>Somente de embarques prioritários<small>A prioridade é definida no embarque.</small></span></label></fieldset>`;
}
$("#open-filters").onclick = () => {
  renderFilterOptions();
  $("#filter-panel").showModal();
};
$("#reset-filter-draft").onclick = () => renderFilterOptions(true);
$("#filter-form").onsubmit = (e) => {
  e.preventDefault();
  const form = new FormData(e.currentTarget);
  status = form.get("status");
  type = form.get("type");
  owner = form.get("owner");
  job = form.get("job");
  importantOnly = form.has("priority");
  $("#filter-panel").close();
  render();
};
$("#search").addEventListener("input", (e) => {
  query = e.target.value;
  render();
});
$("#coverage-button").onclick = () => $("#coverage-dialog").showModal();
$("#view-history").onclick = () => {
  clearFilters();
  status = "history";
  render();
  $("#result-count").setAttribute("tabindex", "-1");
  $("#result-count").focus();
};
$("#reset").onclick = () => {
  init();
  toast("Demonstração reiniciada.");
};

function captureDraft() {
  if (!draft) return;
  const form = new FormData($("#settings-form"));
  if (settingsTab === "shipments") {
    draft.priority = new Set(form.getAll("priority"));
    draft.tolerance = Number(form.get("tolerance"));
  } else {
    for (const t of Object.keys(TYPES)) {
      draft.delivery[t] = {
        enabled: form.has(t + "-enabled"),
        portal: form.has(t + "-portal"),
        email: form.has(t + "-email"),
        whatsapp: form.has(t + "-whatsapp"),
      };
    }
  }
}
function renderSettings() {
  $("#settings-title").textContent = settingsGlobal
    ? "Minhas Preferências"
    : "Preferências de alertas";
  $("#settings-subtitle").textContent = settingsGlobal
    ? "Notificações · suas preferências de alertas"
    : "As mesmas escolhas aqui e em Minhas Preferências.";
  $("#global-preferences").hidden = settingsGlobal;
  $("#settings").classList.toggle("global-settings", settingsGlobal);
  document.querySelectorAll("[data-settings-tab]").forEach((b) => {
    b.setAttribute("aria-selected", b.dataset.settingsTab === settingsTab);
    b.tabIndex = b.dataset.settingsTab === settingsTab ? 0 : -1;
  });
  if (settingsTab === "shipments")
    $("#settings-content").innerHTML =
      '<p class="setting-help" style="margin-top:0">Marque a estrela para destacar os embarques importantes. A prioridade é do embarque e ajuda a organizar o acompanhamento.</p>' +
      [
        ...new Map(
          items.filter((x) => x.shipment).map((x) => [x.shipment, x]),
        ).values(),
      ]
        .map(
          (x) =>
            `<label class="setting-row priority-setting"><input type="checkbox" name="priority" value="${x.shipment}" ${draft.priority.has(x.shipment) ? "checked" : ""}><span class="setting-star">${icon("star")}</span><span><strong>PO ${x.po}</strong><small>${x.cargo} · ${x.supplier}</small></span><span class="setting-arrival">${x.arrival || "Sem previsão única"}<small>Chegada ao porto</small></span></label>`,
        )
        .join("") +
      `<label class="tolerance">Nas demais cargas, avisar mudanças de chegada<select name="tolerance"><option value="0" ${draft.tolerance === 0 ? "selected" : ""}>Qualquer mudança</option><option value="1" ${draft.tolerance === 1 ? "selected" : ""}>Acima de 1 dia</option><option value="3" ${draft.tolerance === 3 ? "selected" : ""}>Acima de 3 dias</option></select></label><p class="setting-help">Embarques prioritários ignoram essa tolerância. Pendências e conflitos não são silenciados por ela.</p>`;
  else
    $("#settings-content").innerHTML =
      '<p class="setting-help" style="margin-top:0">Escolha os tipos e por onde quer receber novos avisos. Personalize os avisos sem perder o histórico.</p><div class="delivery-table"><div class="delivery-row delivery-head"><span>Tipo de alerta</span><span>Receber</span><span>No portal</span><span>E-mail</span><span>WhatsApp</span></div>' +
      Object.entries(TYPES)
        .map(
          ([id, label]) =>
            `<div class="delivery-row"><span>${label}${UNAVAILABLE[id] ? `<small>${UNAVAILABLE[id]}</small>` : ""}${["documentos", "aprovacao"].includes(id) ? "<small>Complementar</small>" : ""}</span>${["enabled", "portal", "email", "whatsapp"].map((ch) => `<label><input type="checkbox" ${UNAVAILABLE[id] ? "disabled" : ""} name="${id}-${ch}" ${draft.delivery[id][ch] ? "checked" : ""} aria-label="${label}: ${{ enabled: "receber", portal: "no portal", email: "e-mail", whatsapp: "WhatsApp" }[ch]}"></label>`).join("")}</div>`,
        )
        .join("") +
      '</div><p class="setting-help">Essas escolhas controlam novos avisos. O histórico de alertas continua disponível na tela, com seus filtros.</p><div class="setting-note">Prévia de canais: nenhum e-mail, mensagem ou notificação é enviado. Na integração, canais dependem de disponibilidade e contato confirmado.</div>';
}
function openSettings(global = false) {
  draft = {
    priority: new Set(priorityShipments),
    tolerance: prefs.tolerance,
    delivery: structuredClone(prefs.delivery),
  };
  settingsTab = global ? "delivery" : "shipments";
  settingsGlobal = global;
  renderSettings();
  $("#settings").showModal();
}
$("#preferences").onclick = () => openSettings();
$("#global-preferences").onclick = () => {
  captureDraft();
  settingsGlobal = true;
  renderSettings();
};
document.querySelector('.nav-link[href$="/preferencias"]').onclick = (e) => {
  e.preventDefault();
  openSettings(true);
};
$("#settings-form").onsubmit = (e) => {
  e.preventDefault();
  captureDraft();
  for (const [id, p] of Object.entries(draft.delivery)) {
    if (p.enabled && !p.portal && !p.email && !p.whatsapp) {
      settingsTab = "delivery";
      renderSettings();
      toast("Escolha ao menos um canal para " + TYPES[id] + ".");
      return;
    }
  }
  priorityShipments = new Set(draft.priority);
  prefs = {
    tolerance: draft.tolerance,
    delivery: structuredClone(draft.delivery),
  };
  $("#settings").close();
  render();
  toast("Preferências salvas nesta prévia. Disponíveis nos dois acessos.");
};
document.querySelector(".settings-tabs").onkeydown = (e) => {
  if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
  e.preventDefault();
  captureDraft();
  settingsTab = settingsTab === "shipments" ? "delivery" : "shipments";
  renderSettings();
  document.querySelector(`[data-settings-tab="${settingsTab}"]`).focus();
};

function showRecord() {
  const [kind, id] = location.hash.slice(1).split("/"),
    x = items.find((x) => x.id === id);
  if (!["embarque", "cotacao", "radar"].includes(kind) || !x) {
    if ($("#record").open) $("#record").close();
    return;
  }
  if ((kind === "embarque" && !x.shipment) || (kind === "cotacao" && !x.quote)) return;
  $("#record-breadcrumb").textContent =
    kind === "cotacao"
      ? "Minhas Cotações / Detalhe"
      : kind === "radar"
        ? "Inteligência / Radar de preços"
        : "Meus Embarques / Detalhe";
  $("#record-title").textContent =
    kind === "cotacao" ? "Cotação " + x.quote : kind === "radar" ? x.cargo : "Embarque " + x.shipment;
  $("#record-subtitle").textContent =
    kind === "radar"
      ? "Referência comercial demonstrativa"
      : "PO " + x.po + " · " + x.cargo + " · " + x.supplier;
  const logistics = `<dl class="record-grid"><div><dt>Embarque</dt><dd>${x.shipment}</dd></div><div><dt>Rota</dt><dd>${x.origin} → ${x.destination}</dd></div><div><dt>Etapa</dt><dd>${x.stage}</dd></div><div><dt>${x.arrivalLabel}</dt><dd>${x.arrival || x.arrivalMissing || "Sem previsão"}</dd></div></dl>`;
  $("#record-content").innerHTML =
    kind === "radar"
      ? `<div class="record-section"><h3>${x.title}</h3><p>${x.summary}</p><div class="fact" style="margin-top:18px"><strong>${x.price} na referência</strong><p>Oferta firme, preço reservado e validade comercial não disponíveis.</p></div><p>${x.impact}</p><p class="setting-help">${x.source} · ${x.checked}</p></div>`
      : kind === "cotacao" && !x.shipment
        ? `<div class="record-section"><h3>Contexto da cotação</h3><dl class="record-grid"><div><dt>Cotação</dt><dd>${x.quote}</dd></div><div><dt>PO</dt><dd>${x.po}</dd></div><div><dt>Rota solicitada</dt><dd>${x.origin} → ${x.destination}</dd></div><div><dt>Situação</dt><dd>${x.stage}</dd></div></dl><p>Sem embarque vinculado.</p></div><div class="record-section"><h3>Proposta recebida</h3><div class="fact"><strong>${x.fact}</strong><p>${x.explain}</p></div><p class="setting-help">Valores, validade e condições comerciais não estão preenchidos neste exemplo. Na integração, consultar a proposta original antes de decidir.</p></div><div class="record-section"><h3>Origem do alerta</h3>${evidence(x)}</div><div class="record-section"><h3>Histórico</h3>${timeline(x)}</div>`      : kind === "cotacao"
        ? `<div class="record-section"><h3>Condições vinculadas ao embarque</h3>${logistics}<dl class="record-grid"><div><dt>Identificação da cotação</dt><dd>${x.quote}</dd></div><div><dt>PO vinculada</dt><dd>${x.po}</dd></div><div><dt>Preço e taxas</dt><dd>Não informados nesta prévia</dd></div><div><dt>Condição de free time</dt><dd>Não informada</dd></div></dl><p class="setting-help">Somente condições deste cenário. Não há proposta comercial real anexada.</p><a class="btn" href="#embarque/${x.id}">Ver embarque vinculado</a></div>`
        : `<div class="record-section"><div class="record-section-heading"><h3>Acompanhamento do embarque</h3>${shipmentPriority(x)}</div>${logistics}</div><div class="record-section"><h3>Alerta e próxima ação</h3><p>${x.title}</p><div class="fact" style="margin-top:12px"><strong>${x.fact}</strong><p>${x.explain}</p></div><p>${x.group === "history" ? "Ocorrência concluída." : x.next}</p><p class="setting-help">${x.person} · Prazo: ${x.deadline || "não informado"}</p></div><div class="record-section"><h3>Documentos e evidências</h3>${evidence(x)}</div><div class="record-section"><h3>Histórico</h3>${timeline(x)}</div><div class="record-section"><h3>Cotação vinculada</h3><a class="btn" href="#cotacao/${x.id}">${x.quote} ${icon("arrow")}</a><p class="setting-help">Mesma PO e mesmo embarque. Sem valores comerciais inventados.</p></div>`;
  if (!$("#record").open) $("#record").showModal();
}
window.addEventListener("hashchange", showRecord);
$("#record").addEventListener("close", () => {
  if (location.hash)
    history.replaceState(null, "", location.pathname + location.search);
});
document.addEventListener("keydown", (e) => {
  if (document.querySelector("dialog[open]")) return;
  if (e.key === "Escape" && mobileOpen) {
    mobileOpen = false;
    renderDetail();
    (document.querySelector(`[data-open="${selected}"]`) || document.querySelector('#quick-filters [aria-pressed="true"]') || $("#search")).focus();
  }
  if (e.key === "Tab" && mobileOpen) {
    const all = [
        ...$("#detail").querySelectorAll("button,summary,a[href]"),
      ].filter((el) => el.getClientRects().length && !el.disabled),
      first = all[0],
      last = all.at(-1);
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
});
$("#detail-backdrop").addEventListener("click", () => {
  mobileOpen = false;
  renderDetail();
  (document.querySelector(`[data-open="${selected}"]`) || document.querySelector('#quick-filters [aria-pressed="true"]') || $("#search")).focus();
});
init();
showRecord();
