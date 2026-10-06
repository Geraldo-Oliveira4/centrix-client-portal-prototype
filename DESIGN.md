---
name: Freitas Centrix
description: Central de controle de logística internacional. Previsibilidade e controle em cada etapa.
colors:
  navy: "#1A1C31"
  indigo: "#2C2E65"
  orange: "#F59C27"
  white: "#FFFFFF"
  mist: "#F4F5FA"
  indigo-700: "#464A78"
  indigo-600: "#686A9A"
  indigo-300: "#C1C3F3"
  indigo-100: "#EAECFC"
  orange-800: "#7A4407"
  orange-100: "#FDE8B8"
  border: "#DDE0EE"
  success: "#1E9E63"
  warning: "#C98A00"
  danger: "#D64545"
  danger-ink: "#B42F2F"
  success-ink: "#136B42"
  warning-ink: "#8A5E00"
  info: "#4C6FD1"
typography:
  display:
    fontFamily: "New Black, Source Sans Pro, sans-serif"
    fontSize: "clamp(2.75rem, 5vw, 4.5rem)"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  h1:
    fontFamily: "New Black, Source Sans Pro, sans-serif"
    fontSize: "clamp(2.25rem, 4vw, 3.5rem)"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  h2:
    fontFamily: "New Black, Source Sans Pro, sans-serif"
    fontSize: "clamp(1.75rem, 3vw, 2.5rem)"
    fontWeight: 600
    lineHeight: 1.15
  h3:
    fontFamily: "New Black, Source Sans Pro, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.25
  lead:
    fontFamily: "Source Sans Pro, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 400
    lineHeight: 1.5
  body:
    fontFamily: "Source Sans Pro, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Source Sans Pro, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.08em"
    textTransform: uppercase
rounded:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  2xl: "40px"
  pill: "999px"
spacing:
  xs: "8px"
  sm: "16px"
  md: "24px"
  lg: "48px"
  xl: "96px"
components:
  button-primary:
    backgroundColor: "{colors.orange}"
    textColor: "{colors.navy}"
    rounded: "{rounded.md}"
    padding: "0 20px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "#FEB93C"
  button-secondary:
    backgroundColor: "{colors.indigo}"
    textColor: "{colors.white}"
    rounded: "{rounded.md}"
    padding: "0 20px"
    height: "44px"
  button-outline:
    borderColor: "{colors.indigo}"
    textColor: "{colors.indigo}"
    rounded: "{rounded.md}"
  button-chevron:
    backgroundColor: "{colors.orange}"
    textColor: "{colors.navy}"
    rounded: "{rounded.md}"
    iconChip: "{colors.indigo}"
    iconColor: "{colors.orange}"
  input:
    backgroundColor: "{colors.white}"
    borderColor: "{colors.indigo-300}"
    textColor: "{colors.navy}"
    rounded: "{rounded.md}"
    height: "44px"
  input-focus:
    borderColor: "{colors.orange}"
    ring: "0 0 0 3px rgba(245,156,39,0.45)"
  card:
    backgroundColor: "{colors.white}"
    borderColor: "{colors.border}"
    rounded: "{rounded.lg}"
    padding: "24px"
  card-dark:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.white}"
    rounded: "{rounded.xl}"
  hero-dark:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.white}"
    accentColor: "{colors.orange}"
    rounded: "{rounded.2xl}"
---

## Overview

Freitas Centrix é a central de controle de logística internacional da Freitas, empresa de comércio exterior com mais de 30 anos, sediada em Itajaí (SC). A marca fala com quem gerencia importação e exportação e precisa de previsibilidade, controle e visibilidade. O sistema visual é sóbrio e técnico, com um único ponto de energia: o laranja. Três palavras de voz: **preciso, confiante, em movimento**.

A composição segue a regra 75/15/10. Cerca de 75% de cada peça é estrutural (Navy Profundo em layouts escuros, Branco e Cinza Névoa em layouts claros), 15% é Índigo (títulos, botões secundários, ícones) e no máximo 10% é Laranja (CTA, números, palavras-chave, símbolo). O laranja é teto, não meta.

## Colors

- **Navy Profundo `#1A1C31`**: superfície escura. É o fundo dos heros, posts e seções de impacto. Nunca use como cor de texto sobre índigo.
- **Índigo `#2C2E65`**: cor da marca. Logo, títulos em fundo claro, botões secundários, ícones, links. Sobre branco tem contraste 12,5:1.
- **Laranja `#F59C27`**: destaque. CTA primário (texto Navy Profundo por cima, 7,7:1), números de impacto, palavras-chave em headlines escuras, nós das linhas de rota, símbolo. Nunca como texto pequeno sobre branco: use `orange-800 #7A4407` para isso.
- **Branco / Cinza Névoa `#F4F5FA`**: base dos layouts claros. Névoa em grandes áreas, Branco em cards.
- **Rampas**: índigo 50–950 e laranja 50–800 para estados, superfícies secundárias e gráficos. Rampas nunca substituem as cores oficiais em elementos de marca.
- **Semânticas**: sucesso, aviso, erro e info aparecem só em feedback de interface, sempre com ícone ou texto além da cor.
- **Gradientes**: permitidos apenas de Navy Profundo para Índigo (`#1A1C31 → #2C2E65`) e como véu duotone sobre fotografia. Nunca gradiente laranja em grandes áreas.

## Typography

- **New Black** é a fonte de títulos (display, h1–h4) e de números de impacto. Pesos 600 para títulos, 500 para h4, 300 para display editorial leve. Tracking -0,02em acima de 36px.
- **Source Sans Pro** é a fonte de corpo, UI, labels e formulários. 400 corpo, 600 rótulos e botões, 700 ênfase. Itálico só em citações.
- Escala fluida com `clamp()`. Corpo mínimo 16px. Largura de linha entre 60 e 75 caracteres.
- Headlines de impacto seguem o padrão do post: o benefício ou número em Laranja, o restante em Branco (fundo escuro) ou Índigo (fundo claro). Uma única frase, sem ponto de exclamação.
- Labels de seção em caixa alta, 12px, tracking 0,08em, Índigo 600. Use um kicker por seção, não em todo bloco.

## Layout

- Grid de 12 colunas, container 1280px, gutter 24px (16px no mobile), margens fluidas de 16 a 48px.
- Breakpoints: 640, 768, 1024, 1280, 1440. Mobile-first.
- Espaçamento em múltiplos de 4px. Seções separadas por 80 a 128px no desktop e 48 a 64px no mobile.
- Formas de marca: cantos generosos (24 a 40px) em painéis e molduras; 12px em botões e inputs; 16px em cards.
- Grafismo de rota: molduras de linha fina (1px, branco a 28%) com um canto muito arredondado e nós laranja de 8px nas extremidades. Use no máximo duas molduras por tela.
- Fotografia sempre em duotone Navy Profundo para Laranja, com temas de porto, navio, contêiner, guindaste e mapa.

## Elevation & Depth

- Superfícies claras: bordas de 1px `#DDE0EE` antes de sombra. Sombra `md` só em elementos flutuantes (dropdown, popover) e `lg` em modais.
- Superfícies escuras: sem sombra. A profundidade vem de camadas (`#1A1C31` → `#23253F`) e das linhas de rota.
- O CTA laranja pode receber `glow-orange` no hover em fundos escuros. Nunca em fundos claros.

## Shapes

- Raio padrão 12px (botões, inputs, chips grandes). Cards 16px. Painéis e imagens 24px. Molduras de hero e formas de marca 40px ou mais.
- O chevron do símbolo é a única forma decorativa da marca. Aparece como bullet e seta de CTA. Nunca como padrão de fundo ou textura. Nunca redesenhe o chevron: use o SVG oficial.
- Botão de assinatura: barra laranja com chip índigo à esquerda contendo o chevron duplo laranja. Reservado para o CTA principal de heros e posts. Um por tela.

## Components

- **Botões**: primário laranja/navy, secundário índigo/branco, outline índigo, ghost, link, destrutivo. Alturas 36/44/56. Um primário por dobra. Ícone Lucide 20px à direita quando indicar avanço.
- **Inputs**: 44px, borda `indigo-300`, foco com anel laranja de 3px. Label sempre visível acima. Erro em `danger` com texto abaixo do campo.
- **Cards**: brancos com borda em fundo claro; navy `#23253F` com borda branca a 12% em fundo escuro. Título em New Black 600 20–24px.
- **Stat tile**: número em New Black 600 48–64px Laranja (fundo escuro) ou Índigo (fundo claro), label em Source Sans 600 12px caixa alta.
- **Badges**: fundo `indigo-100`/texto índigo; `orange-100`/texto `orange-800`; semânticos com fundo suave.
- **Header**: 72px, logo vertical (versão principal) à esquerda com 48px de altura, navegação Source Sans 600 16px, CTA primário à direita. Versão escura sobre hero navy.
- **Footer**: Navy Profundo, logo negativo, colunas de links em `indigo-300`, sem grafismo.
- **Ícones**: Lucide, stroke 1,75, 16px inline, 20px em botões, 24px em cards. Sem emojis.

## Urgency scale (Portal do Cliente)

One scale for Home, Central de trabalho, Minhas Cotações and Meus Embarques. The question it answers is "do I need to act, and by when?", never "which stage is this in". Stage is information, written as text; urgency is what moves up the screen and gets colour. The rule lives in one pure module, `frontend/app/portal/_shared/urgency.ts`, and is drawn by `UrgencyBadge` (`_shared/urgency-badge.tsx`).

| Level | When | Visual |
|---|---|---|
| Crítico | the client's deadline has passed, or a cost is running (demurrage) | `danger` plate at 10%, `danger-ink` text, octagon icon, reason text ("Prazo vencido") |
| Atenção | the client's deadline is today or within 3 days, or the pending item holds the next step (booking, missing quotation data) | `warning` plate at 10%, `warning-ink` text, clock icon, reason ("Vence hoje", "Trava a próxima etapa") |
| Normal | in progress with the Freitas or an agent; or a client item with no deadline ("Pendente com você") | neutral text, no plate, no border colour |
| OK | done | small `success` plate with `success-ink` text; never a border |

- **At most two levels of emphasis per screen.** Only Crítico and Atenção carry colour. Columns, tabs and stage labels are neutral.
- **Colour never travels alone.** Every coloured plate has an icon and the reason in words.
- **"Due today" is Atenção, not Crítico.** Red is reserved for what already costs something; otherwise red stops separating "missed" from "still possible".
- **A pending document without a due date is Normal.** It is work, not an emergency; it enters the scale by its due date when one exists. Counting it as Atenção painted 7 of 8 shipments amber.
- **Ink tokens for text.** `danger`, `success` and `warning` fail AA as text on white or on their own 10% plates; `danger-ink`, `success-ink` and `warning-ink` pass (5.4, 5.8 and 4.9:1 on the plate). In dark mode the inks collapse into the base tones and the 10% plates drop to 8% (`styles/globals.css`).
- **Card accent follows urgency.** A card's left border is `danger`/`warning` only when the card itself is Crítico/Atenção; `border` otherwise.

## Insight pattern

Every headline number carries its reading. A number alone ("73%") answers nothing; the client needs to know what it means and which way it moved.

- **Shape:** the number, then a variation badge (arrow icon + colour + text, e.g. "↑ 15 pontos acima de julho"), then one sentence in the client's language ("Seus fornecedores deixaram a carga pronta no prazo em 73% dos embarques"), then, when useful, where it weighs most or the base the variation came from ("Agosto: 3 de 3 no prazo").
- **Rates vary in points, amounts in %.** "0% no prazo" is an accusation, not a gap: with no data the card says so in words and shows no variation.
- **Tone follows direction and meaning, not sign.** Good = `success-ink` on a 10% plate, bad = `danger-ink`, neutral = `portal-neutral` on `muted`. When neither side is better (freight contracted) the arrow shows without colour; commercial KPIs (savings) never go red.
- **One source.** The variation is computed from the same data the screen already draws (in Inteligência, the monthly cohorts of the evolution chart), never from a second, invented baseline. A month with fewer than 3 eligible shipments does not enter the comparison.
- **Code:** `frontend/app/portal/_shared/insight.ts` + `InsightLine` in React; `public/prototypes/centrix-inteligencia/insights.js` mirrors the same rule for the iframe.

## Focus (Portal do Cliente, 02/10/2026)

"The less to-do list, the better; the client needs to focus" (Victor Orsi). A business decision that outranks technical preference.

- **No parallel to-do list.** Actions live in exactly two places: "Fazer agora" (Central › Meu dia) and the module where the action happens. Never add a list, tab or card that re-lists the same pending items (the Alertas tab was removed for this reason). A count that repeats the section right below it is noise: remove it.
- **Waiting is secondary.** What depends on a third party ("Aguardando retorno") starts collapsed.
- **Reading is not work.** Updates go in the read-only "Atualizações" feed (`_shared/updates-feed.tsx`; mirrored in the Central iframe): no "seen" state, no counter, no task CTA, colour only for a running cost. Each row only links to its context.
- **One summary layer per screen.** A dark summary bar and cards below it must not repeat the same numbers; the Operação overview is one bar + "Onde intervir" (max. 4) + Atualizações.
- **Management, not tables, for case pipelines.** Auditoria › Preço do frete is a three-column Kanban (aguardando fatura · para análise · sob ajuste). Read-only reports (service performance) belong in Inteligência, without dispute CTAs.

## One source for shipment indicators

`frontend/app/portal/embarques/lib/shipment-indicators.ts` defines the five shipment indicators once; Panorama, the shipment list, Visão por PO and the Home banner all draw `ShipmentIndicatorStrip` from it, with the same labels and the same numbers (locked by `shipment-indicators.test.ts`).

| Label | Definition |
|---|---|
| Precisam de você | Shipments with at least one pending client action (booking or document), from the same action queue as the shipment detail. |
| Com chegada atrasada | Not arrived yet, and the carrier's current ETA is later than its first ETA (`delayRiskFromTracking`, delta > 0 days). |
| Chegam nos próximos 7 dias | Not arrived yet, with a forecast, arriving at destination between today and the next 6 days. |
| Sem previsão | Not arrived yet and the carrier has no ETA (no tracking, `INCOMPLETE`, or no current date). Never counted as late. |
| Com exceção | Shipments postponed (`postergado`) or with a divergent booking (`booking_divergente`). |

- The unit is always the **shipment**. Grouped views (by PO) keep the shipment count and filter the groups that contain at least one shipment in the indicator.
- Indicators overlap and do not sum to the portfolio; screens say so.
- Only "Precisam de você" takes the attention tone, and only when non-zero: it is the one indicator that asks the client to act. The other four are information.
- A new screen that shows any of these numbers consumes this module; it never writes its own predicate.

## Inteligência: modes, filters, customization (02/10/2026)

One continuous page (`public/prototypes/centrix-inteligencia`), no tabs that only scroll and no nested sub-tabs. Header order: title → period → filter bar → content.

- **Two reading modes**, a segmented control "Completa | Objetiva", default Completa, persisted per user. Completa: hero "Entrega final no prazo" + "Onde o prazo se perde" funnel, four KPI cards with sparklines, two charts (prazo por etapa and frete por mês, last 6 months), then Performance (Etapas, Exportadores, Agentes stacked), Preços e rotas and Compromissos do serviço (read-only). Objetiva: the four KPIs in a row and four question blocks, each with ONE computed insight line (metric + variation + conclusion) and "Ver detalhes →" to the Completa section. Section links appear only in Completa, as plain anchors.
- **Personalizar** follows the Home pattern: a switch per block, draft until Salvar, "Restaurar padrão" always visible. What is stored is the list of HIDDEN blocks, so a new block is born visible.
- **Global filters** (Exportador, Agente de cargas, Rota, Incoterm, País de origem, SKU) change every block in both modes. OR within a filter, AND across filters; options come from the data; active filters are removable chips with "Limpar filtros" and "N de M embarques"; the state lives in the URL. SKU is item-level: a shipment matches if it contains the SKU, while freight and lead times stay shipment-level, and the page says so when SKU is active.
- **One comparison base**: every variation compares the chosen period with the immediately previous period of the same length, stated once in a caption. Rates vary in points, amounts in %.
- **Small sample**: with fewer than 3 shipments (in the cut or in the base) the value carries "Amostra pequena (n=X)" and no variation chip; with zero, an empty state with "Limpar filtros".
- **Colour**: improvement green, worsening amber, neutral grey. Red stays reserved for client action, and a variation is never one. No AI score.
- **Each chart has a one-line caption** saying what it shows.
- **Filter options never disappear.** The list and the count beside each option ("Shanghai → Santos (20)") come from the whole dataset; an option with no shipment in the current period plus the other active filters is shown disabled, never removed (a checked option always stays uncheckable).
- **The current view is the report.** "Preparar relatório" opens a side panel that summarises the view ("Rota Shanghai → Santos · FOB · Últimos 90 dias · 7 embarques") and offers: *Salvar como minha visão* (named chips on their own row under the title restore period, filters, mode and visible blocks, with rename/delete in the chip menu; same per-user storage as Personalizar); *Levar para uma conversa* (exactly one exporter → the existing Revisão de exportador with period and filters; agent or route → "Revisão de rota ou agente" marked Planejado; otherwise a hint); *Receber e compartilhar* (e-mail schedule and PDF are simulated and labelled "Prévia"; Copiar link is real). Modal panel: focus trap, Esc closes, labelled fields.


## Cotações: proposal comparison (06/10/2026)

`/portal/cotacoes/comparativo` (fixture-only, `frontend/app/portal/cotacoes/comparativo/`) mirrors the comparison clients receive today. Header "Proposta comercial · COT-…", left "Resumo da solicitação", then three true tabs (URL state `?aba=`, one level): **Mapa | Recomendação IA | Histórico do agente**.

- **"Resumo da solicitação" collapses** to a one-line strip (default collapsed below 1536px, expanded above; the client's choice is remembered). Collapsed, the table takes the full width.
- **Mapa** is one column per proposal, sticky label column, horizontal scroll inside the table container (never the page). Missing values always render "—". Totals are computed from components (origin + international freight + destination + insurance when accounted); "TOTAL EM BRL" converts with one PTAX rate per quotation. International freight is a TOTAL, never a per-kg/m³ rate.
- **Four badges, four concepts, never colour-only** (icon + word, legend on screen). *Facts*, outlined: **Menor preço** (lowest TOTAL EM BRL among non-expired) and **Menor prazo** (lowest transit time). *Decisions*, filled plates: **Recomendada** (`portal-info`: the system suggests, only after analyst approval; never green) and **Escolhida** (`portal-success`: the proposal the client approved).
- **Recommendation gate.** Before the Freitas analyst approves it, the tab shows only "Recomendação em revisão pela equipe Freitas…" — no score, no ranking, no hint. After approval: score 0–100, criterion bars, "Como calculamos" (weights 28/22/18/14/10/8) and a justification generated from the data. The recommended offer is not necessarily the highest score (10% price window over the cheapest eligible, direct route first), and the screen says so.
- **This is the only AI score in the portal.** It compares proposals of one quotation; **Histórico do agente** shows facts only (shipments, on-time per stage, last 5, commitments with deviations), "dado, não veredito", with "Amostra pequena" under 3 and "Sem histórico" when absent.

## Floating elements never overlap primary actions (07/10/2026)

The "Ajuda" button (bottom-right) and the Preview-only "Demonstração" tab (bottom-left) must never cover a primary action, at any width.

- **Every bar pinned to the bottom registers itself**: React bars use `useBottomActionBar()` (`frontend/app/portal/_shared/use-bottom-action-bar.ts`, a callback ref); iframe drawers report their `.drawer-footer` / `.drawer-actions` / `[data-bottom-action-bar]` through `public/prototypes/_shared/floating-safe.js`. The tallest one becomes `--floating-bottom-offset` on `<html>`; both floating elements rise above it with an 8px gap, and below 1024px Ajuda collapses to its icon (`aria-label` stays).
- **Content keeps clear of both**: the portal content wrapper pads by `max(6rem, --floating-content-pad)`.
- The math is pure and tested (`_shared/floating-safe-area.ts`). A new sticky footer that does not register is a bug, not a styling choice.

## Agent history on the quotation detail: inline + drawer (07/10/2026)

There is no standalone "Raio X do agente" block and no "Consultar agente" selector. Each offer row carries one line under the agent — "8 de 10 no prazo nesta rota · 1 divergência", "Sem histórico nesta rota" or "Amostra pequena (n=2)" — and a "Ver histórico" link that opens a drawer (right on desktop, bottom sheet on mobile; focus trap, Esc closes) with the three facts (cumprimento de prazo, cotado × cobrado, experiência nesta rota), the sample note, "A pontualidade observada não garante a próxima chegada" and the evidence expanded. Facts only, no score: "dado, não veredito". Copy lives in `frontend/app/portal/cotacao/lib/agent-history-line.ts`; the data source did not change.

## Onboarding teaches Performance (07/10/2026)

The welcome answers no longer stop at the Home. **Routes (up to 3) + priority become the saved view "Minha operação"** in Inteligência: a Rota filter (OR within it) and a block order pulled by the priority — Custo: freight charts, prices, KPIs first; Prazo: on-time hero and "where the time is lost"; Visibilidade: KPIs, stage delays, commitments. Priority orders, never hides. It is an ordinary view: it shows in "Minhas visões" and the client renames or deletes it; "Refazer personalização do zero" reopens the questions and recreates it. A route with no shipments shows the existing empty state, never an error.

- **Tour: 4 stops** (menu → Central de trabalho → **Performance** → Ajuda), numbered "N de 4" from the visible stops. The Performance stop highlights Inteligência in the menu and offers **"Ver na prática"**, which opens Inteligência on "Minha operação" with a 3-balloon mini-guide (how to read a metric: number + variation + conclusion; filters and Completa/Objetiva; Minhas visões and Preparar relatório). Facts only, no AI score.
- **Tour and guide placement**: never over the page's main title, never over Ajuda or a bottom bar (they read `--floating-bottom-offset`); on mobile both become bottom sheets that register as bottom bars, so Ajuda rises above them.
- **Primeiros passos: 5 items**, each closed by the action on the destination screen (quotation sent, alert preferences saved, Inteligência opened, a view saved/edited), never by clicking the checklist link; only "Convidar um colega" closes in the card. Collapses to a thin bar with one step left.
- **New-client Inteligência** shows the fictitious dataset under a fixed "Exemplo ilustrativo" seal and one sentence saying real data replaces it once there are shipments.
