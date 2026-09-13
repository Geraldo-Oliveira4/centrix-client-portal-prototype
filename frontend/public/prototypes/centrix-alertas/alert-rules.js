// Read state never changes the operational meaning or position of an alert.
const AlertRules = {
  matchesJob(x, job, now) {
    if (job === "all") return true;
    if (job === "documents") return x.type === "documentos" && x.group === "action";
    if (job === "delays") return x.group === "action" && !!x.deadlineAt && Date.parse(x.deadlineAt) < Date.parse(now);
    // No contractual cost evidence has been validated for this prototype.
    if (job === "costs") return false;
    return false;
  },
  destination(x) {
    const kind = x.context;
    const reference = kind === "cotacao" ? x.quote : kind === "embarque" ? x.shipment : null;
    if (!reference) return null;
    return { kind, reference, label: kind === "cotacao" ? "Ver cotação" : "Ver embarque", href: `#${kind}/${x.id}` };
  },
  tone(x) {
    if (x.group === "history" || x.type === "confirmado") return "green";
    if (x.type === "preco") return "purple";
    if (x.owner === "client" && x.group === "action") return x.deadline ? "red" : "amber";
    if (x.type === "eta") return "amber";
    return "blue";
  },
  tier(x) {
    if (x.group === "history") return 6;
    if (x.group === "action" && x.owner === "client") return x.deadline ? 0 : 1;
    if (x.group === "action" || x.action === "conflict") return 2;
    if (x.type === "preco") return 5;
    if (x.type === "confirmado") return 4;
    return 3;
  },
  compare(a, b, priorities) {
    return this.tier(a) - this.tier(b) ||
      Number(priorities.has(b.shipment)) - Number(priorities.has(a.shipment)) ||
      a.rank - b.rank;
  },
  cta(x) {
    if (x.group === "history") return "Ver conclusão";
    return ({ quote: "Ver o que mudou", docs: "Anexar documento", booking: "Revisar proposta", pickup: "Ver dados disponíveis",
      release: "Ver evento de descarga", eta: "Ver mudança de chegada", conflict: "Ver dados disponíveis",
      confirmed: "Ver confirmação", price: "Explorar referência", validate: "Acompanhar conferência" })[x.action] || "Ver detalhes";
  },
};
if (typeof module !== "undefined") module.exports = AlertRules;
