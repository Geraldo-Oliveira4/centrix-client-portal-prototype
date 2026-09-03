# Centrix Frontend — AI Context

Next.js 14 frontend for Centrix, a logistics and import management platform built by Arboria Software for Freitas COMEX.

## Maintenance instructions for AI

This file is the primary source of truth for any AI working on this codebase. Keep it accurate and lean:

- **Update this file** whenever a new architectural decision is made, a new domain is added, a convention changes, or a significant task is completed.
- **Remove or replace** outdated information immediately — stale context is worse than no context.
- **Do not let this file grow unbounded.** Prefer updating existing sections over appending new ones. If a section becomes irrelevant, delete it.
- **Keep examples short.** One representative example beats three redundant ones.
- **New page/domain?** Add a row to the routing table, note any new types and hooks introduced.

## Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript (strict)
- **Styling:** Tailwind CSS + shadcn/ui (Radix UI primitives)
- **Data fetching:** SWR 2 + Axios (via `base_api` — see below)
- **Forms:** react-hook-form + zod
- **Tables:** @tanstack/react-table v8
- **Auth:** AWS Cognito — JWT stored in localStorage + cookie
- **Notifications:** react-toastify
- **Animation:** framer-motion (use sparingly)
- **Charts:** recharts
- **Internal lib:** `@arboria-tech/arboria-ui` (installed from GitHub Packages registry)

## Directory structure

```
frontend/
├── app/                     # Next.js App Router pages
│   ├── api/
│   │   └── axios-config.js  # base_api instance (single source of truth for HTTP)
│   ├── context/             # React context providers
│   ├── (admin-routes)/      # Route group: admin-only pages (users, logs)
│   ├── cotacao/             # Quotation module pages
│   │   ├── clientes/        # Client management
│   │   ├── agentes/         # Freight agent (agentes de carga) management
│   │   ├── empresas-exterior/ # Exporter management (ARB-2443)
│   │   ├── nova-cotacao/    # New quotation creation (T14)
│   │   └── [id]/            # Quotation detail analyst workspace (T18)
│   ├── proposta-cliente/    # Public client portal — shareable proposal view (ARB-2051)
│   │   └── [token]/         # Token-gated public page (no auth, 30-day TTL)
│   │       ├── page.tsx            # Full detail page: header, completeness, tabs
│   │       ├── components/
│   │       │   ├── rfq-modal.tsx        # RFQ form modal (T15)
│   │       │   ├── agent-selector.tsx   # Multi-checkbox agent selector (T15)
│   │       │   ├── proposals-section.tsx # Proposals list with audit flags
│   │       │   ├── attachments-section.tsx # Files + original email viewer
│   │       │   └── history-section.tsx  # Quotation log timeline
│   │       └── lib/
│   │           └── rfq-validation.ts    # Field label map + dispatch block helpers
│   ├── home/
│   ├── inbox/
│   ├── login/
│   ├── register/
│   └── reset-password/
├── components/
│   ├── ui/                  # shadcn/ui generated components (do not edit manually)
│   ├── data-table.tsx       # Base table component (@tanstack/react-table)
│   ├── data-table-extended.tsx
│   └── side-navbar.tsx      # App navigation (centrix-specific routes)
├── hooks/                   # SWR data hooks — one file per domain
├── types/                   # TypeScript interfaces and type aliases
├── lib/
│   ├── utils.ts             # cn() — kept local (trivial, avoids full bundle import)
│   ├── session-key.ts       # SESSION_KEY constant — no deps, safe for Edge Runtime
│   ├── session.ts           # createSessionManager('@centrix:session') wrapper
│   └── axios-config.ts      # createApiClient(baseURL, session) wrapper
├── utils/                   # Other utility helpers
├── styles/                  # Global CSS
├── public/
├── assets/
└── middleware.ts            # Edge middleware for role-based route protection
```

## Routing and middleware

Route protection is handled at the edge in `middleware.ts`. It reads the session cookie, decodes the Cognito JWT, and checks `cognito:groups` for role membership.

| Route | Required role |
|-------|--------------|
| `/users`, `/pre-registered-users` | `admin` or `manager` |
| `/logs` | `admin` only |
| Everything else | authenticated (client-side guard via session context) |

Route groups use Next.js conventions — `(admin-routes)/` is a layout group with no URL impact.

## Auth and session

Session is stored as JSON in two places so both client components and the middleware can access it:

- `localStorage` key: `@centrix:session`
- Cookie: `@centrix:session` (SameSite=Lax; Secure; max-age=3600)

Session shape (`UserSession` in `types/auth.ts`):

```typescript
{
  accessToken: string;
  refreshToken: string;
  accessTokenExpires: number;
  user: { email: string; name: string; roles: string[] };
}
```

`base_api` reads the access token from localStorage on every request via interceptor. On 401, it attempts a token refresh against `POST /refresh-token`, queues concurrent requests, and replays them on success. On refresh failure it clears the session and redirects to `/login`.

**Never bypass `base_api` for authenticated requests.** Use raw `axios` only for unauthenticated calls (e.g. S3 presigned URL uploads).

## Data fetching conventions

All server data goes through SWR hooks backed by `base_api`. Hooks live in `hooks/` — one file per domain.

**Standard read hook:**

```typescript
const fetcher = async (url: string) => {
  const res = await base_api.get<{ items: T[]; total: number }>(url);
  return res.data.items;
};

export const useThings = () => {
  const { data, error, mutate } = useSWR<T[]>('/things', fetcher);
  return { things: data, isLoading: !error && !data, isError: !!error, mutate };
};
```

**Mutation pattern** (create / update / delete):

```typescript
const createThing = async (payload: CreateThingPayload): Promise<Thing | null> => {
  try {
    const res = await base_api.post<{ thing: Thing }>('/things', payload);
    globalMutate('/things');
    toast.success('Criado com sucesso!');
    return res.data.thing;
  } catch {
    toast.error('Erro ao criar.');
    return null;
  }
};
```

**Key rules:**
- Always call `globalMutate(key)` after mutations to revalidate the list.
- Never `throw` from mutation functions — catch, toast, return `null` or `false`.
- Polling: pass `{ refreshInterval: ms }` to SWR options; prefer `revalidateOnFocus: false` for stable detail views.
- S3 uploads: import `uploadFileToS3` from `lib/upload-file.ts` — never redefine it locally. It bypasses `base_api` (raw `axios.put`, no `Authorization` header, since presigned URLs reject one). Pass `{ silent: true }` as the 4th arg for callers that build their own error UI from the axios error instead of the default toast.

## Type system

Types live in `types/` — one file per domain. Shared / cross-domain types go in the most relevant file with re-exports where needed.

| File | Contents |
|------|----------|
| `types/quotation.ts` | `Quotation`, `QuotationState`, `QuotationModal`, `RFQ`, `ValidationBlock`, `RFQValidationResult`, `CreateRFQPayload`, `QuotationProposal`, `AuditFlag`, `AuditCategory`, `Severity`, `QuotationLog`, `TransitTimeReference`, `QuotationFilters`, `ExtractedField`, `QuotationKanban`, `COMPLETENESS_FIELDS` |
| `types/client.ts` | `QuotationClient`, `ClientDna`, `ClientTier`, `Modal`, `InsuranceResponsibility`, `LogisticsType`, `PriceOrPerformance`, create/update payloads |
| `types/freight-agent.ts` | `FreightAgent`, `FreightAgentContact`, create/update payloads |
| `types/exporter.ts` | `Exporter`, `ExporterCargoProfile`, create/update payloads (ARB-2443) |
| `types/portal.ts` | `PortalQuotation`, `PortalProposal`, `PortalDeclineReason`, `PORTAL_DECLINE_REASONS`, `PORTAL_DECLINE_REASON_LABELS`, portal response payloads |
| `types/auth.ts` | `UserSession` |
| `types/log.ts` | `LogEntry`, `LogFilters`, `LogActionType`, `LogStatus` |
| `types/shipment.ts` | GE module: `EmbarqueEstado`, `ShipmentModal`, `TipoDespacho`, `ShipmentDatas`, `ShipmentKanbanItem`, `ShipmentKanbanColumn`, `ShipmentKanban`, `ShipmentDetail`, `EmbarqueDocumento`, `EmbarqueDocumentosResponse`, `UploadDocumentoPayload`, `TipoArquivo`, create/update payloads. Reuses `QuotationModal`/`TipoEmbarque` from `types/quotation.ts` |

**Rules:**
- Co-locate payload types (create/update) with their entity type in the same file.
- Use `interface` for object shapes, `type` for unions and aliases.
- Never define types inline in component files — always import from `types/`.

## Hook inventory

| Hook | File | Key |
|------|------|-----|
| `useClients()` | `hooks/use-clients.ts` | `/clients` — CRUD + `updateDna(clientId, serviceType, payload)`, `bulkUpdateDna` (`PATCH /clients/dna/bulk`, ARB-2445: applies one partial DNA change to many selected clients per operation; UI in `clientes/components/bulk-dna-modal.tsx` with per-field opt-in toggle + Import/Export/Ambos scope). DNA is split per `ServiceType` — `client-modal.tsx` edits one operation at a time via a tab; `nova-cotacao` prefills from the DNA matching the quotation's `service_type`, never overwriting filled fields. |
| `useClientDNA(clientId)` | `hooks/use-clients.ts` | `/clients/{id}/dna` — returns `dnas: ClientDna[]` (one per `ServiceType`) |
| `useFreightAgents()` | `hooks/use-freight-agents.ts` | `/freight-agents` |
| `useExporters()` | `hooks/use-exporters.ts` | `/exporters` (ARB-2443) |
| `useQuotations(filters?)` | `hooks/use-quotations.ts` | `/quotations[?params]` |
| `useQuotation(id)` | `hooks/use-quotations.ts` | `/quotations/{id}` |
| `useQuotationKanban()` | `hooks/use-quotations.ts` | `/quotations/kanban` |
| `useQuotationLogs(quotationId)` | `hooks/use-quotations.ts` | `/quotations/{id}/history` |
| `useQuotationAudit(quotationId)` | `hooks/use-quotations.ts` | `/quotations/{id}/audit` |
| `useRFQ(quotationId)` | `hooks/use-rfq.ts` | `/quotations/{id}/rfq` — returns `{ rfq, hardBlocks, softWarnings }` |
| `useProposals(quotationId)` | `hooks/use-proposals.ts` | `/quotations/{id}/proposals` |
| `useProposal(quotationId, proposalId, poll?)` | `hooks/use-proposals.ts` | `/quotations/{id}/proposals/{proposal_id}` |
| `useProposalVersions(quotationId, proposalId)` | `hooks/use-proposals.ts` | `/quotations/{id}/proposals/{proposal_id}/versions` |
| `useRecommendation(quotationId)` | `hooks/use-proposals.ts` | `/quotations/{id}/recommendation` |
| `useClientLinks(quotationId)` | `hooks/use-client-links.ts` | `/quotations/{id}/client-links` |
| `usePortalContacts(clientId)` | `hooks/use-portal-contacts.ts` | `/clients/{id}/portal-contacts` — e-mails authorised to self-register for the client portal (ARB-2501), decoupled from `ClientDna.contact_email`. `addPortalContact()`, `deletePortalContact()` |
| `useShipmentInstruction(quotationId)` | `hooks/use-shipment-instruction.ts` | `/quotations/{id}/si` |
| `useLogs(filters)` | `hooks/use-logs.ts` | `/logs` |
| `useUsers()` | `hooks/use-users.ts` | `/get-users` |
| `useAutosave(options)` | `hooks/use-autosave.ts` | — debounced autosave for quotation field values; returns `{ autoSaveStatus, markAsSaved }` |
| `useServerSync(value, apply, options?)` | `hooks/use-server-sync.ts` | — guards a "seed local state from async server data" effect against clobbering in-progress local edits. `options.skip` gates each sync pass; `options.once` (default `true`) limits it to a single seed per `options.resetKey` epoch. Use this instead of a hand-rolled `useRef` + `useEffect` whenever local editable state is initialized from an SWR/polling value. |
| `useSearchInput(initial?, delay?)` | `hooks/use-search-input.ts` | — standard kanban search pattern; returns `{ inputValue, setInputValue, debouncedValue }`. Base hook for all kanban search inputs; `useDebouncedFilter` builds on it. |
| `useKanban<T>(baseUrl, params?)` | `hooks/use-kanban.ts` | generic `{baseUrl}/kanban` fetcher + key builder + SWR options (poll 30 s, `keepPreviousData`); backs both kanban hooks below |
| `useShipmentKanban({ search?, modal?, cargaUrgente? })` | `hooks/use-shipments.ts` | `/shipments/kanban` — GE kanban; all filters server-side, polls every 30 s |
| `useShipment(id)` | `hooks/use-shipments.ts` | `/shipments/{id}` — GE workspace detail |
| `useShipmentDocumentos(processId)` | `hooks/use-shipments.ts` | `/shipments/{id}/documentos` — list + curated Inova file types. `uploadShipmentDocumento()` does a 2-phase upload (presigned S3 PUT via `uploadFileToS3`, then `/confirm`). `deleteShipmentDocumento()` — DB-only delete |
| `useMyAgents()` | `hooks/use-portal-agents.ts` | `/portal/agents` — agentes pré-aprovados do cliente + contadores. Payload sem score de agente (o backend não o devolve) |
| `useMyPreferences()` | `hooks/use-portal-agents.ts` | `/portal/preferences` — perfil de operação + agentes pausados. `updateMyPreferences()` é PATCH (só as chaves enviadas gravam); `setAgentActive()` recebe a lista de pausados atual porque o backend grava a lista inteira, não um delta, e revalida **as duas** chaves SWR |

`hooks/use-quotations.ts` holds only quotation-level CRUD, kanban, logs, audit, notes, documents, and transitions. Proposal-, RFQ-, client-link-, and shipment-instruction-specific mutations (`createProposal`, `selectWinner`, `dispatchRFQ`, `generateClientLink`, `createShipmentInstruction`, etc.) live in their respective domain files above — do not add new domain logic back into `use-quotations.ts`.

When adding a new hook, add it to this table.

## Autosave

Quotation form pages (`nova-cotacao` and `[id]`) use `useAutosave` for silent background saving with a 2-second debounce after field changes. Key invariants:

- `updateQuotation` accepts `silent?: boolean` (default `false`) — pass `true` for autosave calls to suppress toasts.
- `buildQuotationUpdatePayload(values)` in `utils/quotation-fields.ts` is the single source of truth for converting `QuotationFieldValues` to a PUT payload. Do not duplicate this logic in page files.
- `markAsSaved(values)` must be called whenever fresh server data is loaded into `fieldValues` (prevents re-saving what was just received).
- `<AutoSaveIndicator status={autoSaveStatus} />` in `components/auto-save-indicator.tsx` renders the status: nothing (idle), "Salvando..." (saving), "Salvo" (saved, 3 s), or "Erro ao salvar automaticamente" (error, 5 s).

## Syncing local state from server data

Any component that seeds editable local state (`useState`) from an SWR-backed or otherwise async value must use `useServerSync` (`hooks/use-server-sync.ts`) instead of a hand-rolled `useRef` guard. Without it, a background revalidation (polling, tab refocus, an unrelated mutation calling the same SWR key's `mutate()`) silently overwrites whatever the user is mid-editing — perceived by the user as "the screen refreshed and wiped my input." Four independent ad-hoc `useRef` versions of this existed before `useServerSync` was extracted (quotation autosave sync in `[id]/page.tsx`, RFQ modal seed in `rfq-modal.tsx`, portal RFQ agent-selection seed in `rfq-dispatch-card.tsx`, GE booking form seed in `dados-frete-section.tsx`) — do not add a fifth. `dados-frete-section.tsx` still uses its own `initializedRef` and is a good candidate to migrate next time it's touched.

Note this is distinct from react-hook-form's own `reset(values, { keepDirtyValues: true })` — when the form is RHF-backed (e.g. `proposal-form.tsx`), prefer that built-in option over `useServerSync`.

## @arboria-tech/arboria-ui integration

Components that exist in `@arboria-tech/arboria-ui` are imported directly from the lib — no local copies, no re-export wrappers. When something needs to change in a lib component, **improve the lib first** (`packages/arboria-ui/src/`), rebuild (`npm run build`), and the consuming import picks it up automatically.

**Import directly from the lib — no local copies:**

| Export | Notes |
|---|---|
| `ErrorComponent` | — |
| `LoaderComponent` | `color?`, `size?` props |
| `PageTitle` | — |
| `DatePicker` | `placeholder?` prop |
| `EmptyState` | Empty list/table states |
| `LoadingState` | Inline loading with optional spinner |
| `SectionHeader` | Label above a group of fields |
| `FormSection` | fieldset + legend wrapper |
| `FormGrid` | Responsive 2 or 3-col grid for forms |
| `CardSection` | Numbered card with header + content |
| `FileListItem` | File row with icon, name, meta and actions |
| `LineItemsTable` + `LineItemsTableRow` | Grid-based table for line items |
| `TextInput`, `TextAreaInput`, `SelectInput`, `MoneyInput`, `DateInput` | RHF-integrated form inputs |
| `useAuth`, `AuthProvider` | Auth via `app/context/auth/auth-context.tsx` wrapper |
| `Roles`, `useAuthorization`, `ProtectedComponent` | Importar direto da lib |

**Kept local (intentional):**

- `lib/utils.ts` (`cn`) — trivial, avoids pulling full bundle for a one-liner
- `lib/session-key.ts` — SESSION_KEY constant without deps (Edge Runtime safe)
- `lib/session.ts` — thin wrapper: `createSessionManager('@centrix:session')`
- `lib/axios-config.ts` — thin wrapper: `createApiClient(NEXT_PUBLIC_API, session)`
- `app/context/auth/auth-context.tsx` — configures `AuthProvider` with centrix-specific `postLoginRedirect` and `publicRoutes`

**Tailwind content scanning:** `tailwind.config.ts` includes `./node_modules/@arboria-tech/arboria-ui/dist/*.{js,mjs}` so class names in lib components are included in the CSS output.

## Component conventions

- **UI primitives** — always use components from `components/ui/` (shadcn/ui). Do not hand-roll buttons, inputs, dialogs, etc.
- **Shared components** live in `components/`. Page-specific components live alongside the page file in `app/`.

**Shared domain-agnostic components in `components/`:**

| Component | File | Purpose |
|-----------|------|---------|
| `KanbanColumnShell` | `components/kanban-column-shell.tsx` | Layout-only kanban column: header with label + badge, ScrollArea, empty state. Used by `cotacao/kanban` and `embarques/kanban`. Any new kanban domain (PO, etc.) must use this instead of copying the shell. Props: `label`, `headerColor`, `headerBg`, `darkHeaderBg`, `count`, `emptyLabel`, `children`. |
- **`cn()`** from `lib/utils.ts` — use for all conditional className merging. Never concatenate class strings manually.
- **Loading states** — use `<LoaderComponent />` for full-page loads; inline skeletons for partial content.
- **Error states** — use `<ErrorComponent />` for fetch errors; toast for mutation errors.
- **No inline styles** — Tailwind classes only. Exception: dynamic values that Tailwind cannot handle (e.g. calculated pixel widths).

## Select vs Combobox — when to use each

**Rule: use `<Combobox>` whenever an option list has more than ~8 items or when the user is unlikely to know the exact value upfront.** Use `<Select>` only for short, well-known lists (e.g. Sim/Não, KG/LB, modal, service type).

`<Combobox>` lives in `components/ui/combobox.tsx` and is exported from the barrel. It wraps `Command` + `Popover` and renders a search input inside the dropdown.

**API:**

```tsx
<Combobox
  value={field.value}
  onValueChange={field.onChange}
  options={Object.entries(MY_LABELS).map(([value, label]) => ({ value, label }))}
  placeholder="Selecionar..."
  searchPlaceholder="Buscar..."
  disabled={disabled}
/>
```

`CommandItem` matching is done against `option.label` (not value), so the search text is always human-readable.

**Current usages:** `tipo_container` (18 options) in `equipment-dialog.tsx`; `embalagem` (59 options) in `volume-dialog.tsx`.

## Modal pattern (create / read / edit)

Every entity that supports CRUD must expose a **single modal component** with three internal modes. Do not create separate components for creation and detail viewing.

**Modes:**

| Mode | Triggered by | Behaviour |
|------|-------------|-----------|
| `create` | "Cadastrar" button (no `clientId`/`agentId` passed) | Blank form; on submit closes modal |
| `read` | Clicking a table row (entity id passed) | Formatted read-only view; header has an "Editar" button that switches to `edit` mode |
| `edit` | "Editar" button inside `read` mode | Pre-filled form; on save → back to `read`; on cancel → back to `read` |

**Implementation rules:**

- The parent page holds a single `modalOpen: boolean` and `selectedEntityId: string | null`. No separate drawer/sheet state.
- Pass `entityId` (or `undefined`) and `open`/`onOpenChange` to the modal. The modal derives its initial mode from whether an id was provided.
- All form logic lives once inside the modal — `create` and `edit` share the same form fields, schema, and submit handler (branch on mode).
- Use `size="lg"` on `<Dialog>` (maps to `dialog-content-lg` in `globals.css` — `max-width: min(960px, 90vw)`). Never use a narrower size for entity modals that display substantial data.
- Do not use `<Sheet>` (drawer) for entity details. Modals are the single pattern.

**Reference implementations:** `app/cotacao/clientes/components/client-modal.tsx`, `app/cotacao/agentes/components/agent-modal.tsx`

## Dialog sizing

Three CSS utility classes are defined in `styles/globals.css`:

| Class | Max-width |
|-------|-----------|
| `dialog-content-sm` | 400px |
| `dialog-content-md` | 600px |
| `dialog-content-lg` | `min(960px, 90vw)` |

Use `size="lg"` on `<DialogContent>` for entity modals (clients, agents, quotations, etc.). Use `sm`/`md` only for confirmation dialogs or simple single-field prompts.

## Page layout width

Pages should **not** artificially constrain their width. Do not apply `max-w-*` to top-level page containers — let the layout fill the available space. The sidebar + main layout already provides appropriate padding.

## Client Portal design system (`/portal` only)

The portal screens follow a small explicit system so the pages stop hand-rolling
sizes and every card stops carrying the same visual weight. Defined once in
`styles/globals.css` (type + surfaces) and `tailwind.config.ts` (colours).

**Type scale** — `.portal-h1` (28/700), `.portal-h2` (20/600), `.portal-h3`
(16/600), `.portal-body` (14/400), `.portal-small` (12/400), all line-height 1.5.
Emphasis inside cards uses `font-medium`, not bold: at 14px bold flattens the
hierarchy. Use `<PagePortalHeader>` / `<SectionHeading>` from
`app/portal/_shared/page-header.tsx` rather than a bare `<h1>`/`<h2>`.

**Surfaces** — two levels, and only two:
- `.portal-card` — primary: the content the screen exists for (proposals table,
  current shipment status, shipment list). White, bordered, faint shadow.
- `.portal-card-muted` — supporting detail (dados da cotação, containers,
  observação). No shadow, tinted background, recedes on the canvas.

Page background is `bg-portal-canvas` (#F5F5F7), applied in `app/portal/layout.tsx`.

**Colour — two systems that must never be merged.**

*System 1 — identity (guia de marca Freitas).* Three colours, defined once as
CSS variables in `styles/globals.css` (`--pink`/`--primary`, `--orange`/`--accent`,
`--navy`/`--foreground`) and spelled as Tailwind tokens in `tailwind.config.ts`
(`brand-pink`, `brand-gold`, `brand-navy`). The HSL triples carry decimals on
purpose — they are the exact conversion of the hex and rounding them moves the
rendered colour off-brand.

| Colour | Hex | Pantone | Where |
|---|---|---|---|
| Rosa/magenta (primária) | `#CE0F69` | 214 C | actions, links, active nav, `preview` seal (`--primary`) |
| Laranja (secundária) | `#FF9E1B` | 1375 C | shadcn hover/focus (`--accent`), brand gradients |
| Azul-marinho (terciária) | `#2C2D65` | 2119 C | all headings and dark text (`--foreground`), auth-shell plate |

`--accent-foreground` is the navy, not white: white on `#FF9E1B` is 2.07:1, and
`bg-accent` is only ever used paired with it.

*System 2 — status semáforo (`/portal` only).* STATE, never actions, and
**deliberately not aligned to the brand guide**:

| Token | Hex | Meaning |
|---|---|---|
| `portal-success` | `#00B050` | done / approved |
| `portal-warning` | `#FF9500` | waiting / attention |
| `portal-danger` | `#FF3B30` | critical / divergent |
| `portal-info` | `#2E5CFF` | in progress, nothing required from the client |
| `portal-neutral` | `#8E8E93` | secondary metadata |

`portal-warning` is `#FF9500`, **not** the brand orange `#FF9E1B`. Aligning it
would make "atenção" indistinguishable from a branded surface — the whole point
of a semáforo is that its colour means one thing only. Do not "fix" the semantic
palette towards the brand palette; a colour audit that touches System 1 must
leave System 2 byte-identical.

State→colour maps live next to their type (`ESTADO_BADGE_CLASS` /
`ESTADO_ACCENT_CLASS` in `types/portal-shipment.ts`) so the badge, the summary
tile and the progress steps cannot drift apart.

**Typography** — Montserrat (`app/layout.tsx`, `next/font/google`) app-wide,
including `/portal`; `.portal-h1/h2/h3` set size and weight only and inherit it.
The brand guide specifies **Avenir** for headings, which is **not applied**:
Avenir is a Monotype/Linotype family with no free web license and is absent from
Google Fonts. Do not swap it in until Freitas provides the webfont license —
this is an open brand pendency, not an oversight. `Source_Sans_3` is loaded, but
only by `app/proposta-cliente/layout.tsx`, and is the natural fallback candidate
if the licence never lands (humanist, far closer to Avenir than the geometric
Montserrat).

**Shared components on a portal surface** — do not fork them. `RecommendationView`
takes `variant="portal"`; the analyst and public-proposal surfaces keep the
default. Follow that pattern for any other shared component that has to sit on a
portal screen.

Desde 27/08/2026 o `variant="portal"` troca também o CORPO, não só a casca —
e a divergência é o ponto, não deriva. Ver a seção "Recomendação no portal"
adiante antes de mexer.

**PO do cliente (`client_reference`) — identificador de rastreio adicional.**
O número que o cliente digita na cotação ("PO-12345") acompanha a jornada
inteira e é pesquisável nas duas telas: Funil, Histórico e detalhe da cotação, e
Meus Embarques (lista e detalhe), onde chega **por join** com a cotação de
origem (nunca copiado — ver o CLAUDE.md da raiz). Três invariantes:

- **Não substitui o ID interno.** COT-XXXX / EMB-XXXX seguem sendo a identidade
  do registro, a chave de rota e o texto de maior peso no card. O selo
  `ClientReferenceTag` (`app/portal/_shared/client-reference-tag.tsx`) é
  deliberadamente mais discreto e leva o prefixo "PO" para nunca ser lido como
  referência interna.
- **Sem PO, não renderiza nada.** O campo é opcional na cotação e simplesmente
  não existe num embarque aberto fora do portal; um "PO —" leria como campo
  faltando em vez de campo que não se aplica.
- **Uma normalização só.** `matchesClientReference` (mesmo arquivo) tira caixa e
  separadores, então "PO 2026/1183" acha "PO-2026-1183" — e as duas buscas
  (`applyPortalFilters` das cotações e o filtro da Lista de embarques) usam essa
  função, não uma comparação própria.

**Filtros rápidos de Meus Embarques** (chips) — predicados sobre o dado que a
listagem já traz: Urgentes (`carga_urgente`), Embarcados (`estado`), Com atraso
(`delayRiskFromTracking`, a mesma função do badge) e Com exceção
(`isExceptionState`). O chip é "**Embarcados**", não "Em trânsito": `embarcado` é
o estado real do GE e significa PARTIDA, enquanto "Em trânsito" é o milestone
`OCEAN_TRANSIT` do ShipsGo — um chip com aquele nome selecionaria embarques cuja
própria timeline diz que o trânsito é desconhecido.

Desde 14/08/2026 a **Lista e o Mapa** compartilham os dois lados disso:
`lib/shipment-filters.ts` (predicados + contagem, unit-testado) e
`components/shipment-filter-chips.tsx` (o desenho). Nasceram dentro do
`shipment-list-tab.tsx`; copiá-los para o Mapa criaria a segunda implementação da
mesma pergunta, e "Com atraso" tem de dar o mesmo número nas duas abas. Duas
diferenças deliberadas entre as telas, e as duas estão comentadas no código:

- **Chip zerado**: a Lista esconde (o conjunto dela varia com busca e filtros, e
  um chip permanentemente zerado lê como funcionalidade quebrada); o Mapa mantém
  (são três chips fixos, "Com exceção 0" É a resposta, e é o único caminho até o
  estado vazio amigável).
- **Quais chips**: o Mapa não tem "Embarcados". O critério lá é "isto precisa de
  atenção?", e `embarcado` é o estado da maioria da carteira — o chip removeria
  pouca coisa, contra um pedido que era exatamente sobre remover poluição.

**`PortalSearchInput`** (`app/portal/_shared/portal-search-input.tsx`) is the
portal's only search affordance: a lupa que expande num input. Minhas Cotações
(Funil e Histórico) e Meus Embarques > Lista renderizam **o mesmo componente** —
havia duas implementações idênticas e elas divergiram. `open`/`onOpenChange` são
opcionais: sem eles o componente controla o próprio estado; com eles a página
dirige (é como o atalho "Verificar embarque" do header abre a busca de
embarques via `?tab=lista&busca=1`). Não inline uma terceira cópia.

**`ShipmentRoute`** (`app/portal/embarques/components/shipment-route.tsx`) is an
illustrative origin→destination track: the vehicle position is a fixed
percentage per `estado`, NOT a location — there is no GPS/AIS/carrier feed in
this repo. Its "não é rastreamento por GPS" caption is load-bearing; keep it if
you touch the component. Endpoints are labelled generically because the shipment
payload carries no route (origin lives on the quotation).

Duas regras de espaçamento no componente, ambas contra o mesmo sintoma ("branco
do lado da barra"), e ambas medidas antes/depois com Playwright:

- O badge do veículo é **centrado na linha**, não empilhado acima: acima ele
  forçava 28px de padding cujo único ocupante era o próprio badge estacionado
  numa ponta.
- A linha de legenda (estágio à esquerda · ressalva à direita) tem
  **`max-w-3xl` e `portal-body`**. Com `justify-between` sem limite de largura
  ela ancorava os dois textos nas bordas do card: 475px de vão a 1440px, e
  crescendo — a 1920px o card interno tem 1552px. Com o teto, o vão fica em 43px
  de 1280px para cima e a linha quebra em duas (as duas alinhadas à esquerda)
  abaixo disso. **Não devolva a linha para full-width nem para `portal-small`**:
  o vão volta proporcional à largura da tela.

O detalhe do embarque mostra um link discreto "Ver exemplo com dado de tracking
preenchido →" quando ESTE embarque não tem rastreamento. O alvo é **descoberto
na lista pelo próprio dado** (`data_status === 'COMPLETE'` + um milestone
reportado), nunca por uma lista de EMB-XXXX chumbada: quando um embarque real
ganhar rastreamento ele vira alvo válido sozinho, e se o top-up de demonstração
sair o link some em vez de apontar para uma referência inexistente.

**Carrier tracking (ShipsGo) — structure only, no integration.** The backend
ships a `tracking` block on every shipment payload (backend migration 091) whose
four fields are ALL NULL today. Three rules hold this together; keep them if you
touch Meus Embarques:

- **One rule, one place.** The delay risk is a pure function,
  `computeDelayRisk` / `delayRiskFromTracking` in
  `app/portal/embarques/lib/delay-risk.ts`: `delta = ETA atual (ou chegada real,
  se `IsActual`) − primeiro ETA`, semáforo por **dia absoluto** (≤0 no prazo ·
  1–3 atenção · >3 atraso — percentual distorceria rota curta × rota longa).
  Unit-tested in `delay-risk.test.ts` (`npm run test:unit`, Node test runner with
  native TS stripping; `*.test.ts` is excluded from tsconfig). Components render
  what the function returns — never re-implement the threshold in JSX. A novo
  arquivo de teste precisa ser acrescentado ao script `test:unit` do
  `package.json`: ele lista os arquivos um a um, não faz glob.
  `inteligencia/lib/shipment-dimensions.ts` **consome** esta função para agregar
  desvio por rota e on-time por armador — é o caminho certo para qualquer
  agregação de atraso, em vez de recalcular o delta.
- **The number IS shown** next to the colour, unlike the AI score: this is
  arithmetic over two carrier-published dates, reproducible by the client, not a
  model estimate.
- **Demo data wears the seal.** `tracking.is_mock` (backend migration 092) marks
  a shipment whose tracking was fabricated by
  `backend/scripts/topup_tracking_demo.py` so the prototype can show all three
  visual paths. Every surface that renders a tracking value must check it and
  SAY SO — today the list card and the "Acompanhamento" section do it with
  `ProvenanceBadge preview`, e o `ArrivalIndicator` do topo do detalhe faz em
  texto corrido (18/08/2026 — ver a seção do indicador-chave abaixo). O que não
  pode acontecer é uma superfície imprimir valor de tracking sem nenhuma das
  duas, nem marcar um valor cujo `is_mock` é false.
- **Downstream steps move only from `tracking.last_milestone`** (ShipsGo:
  `OCEAN_TRANSIT` | `ARRIVAL` | `DISCHARGE` | `AVAILABLE`). The rule lives in
  `lib/timeline-steps.ts` (`buildTimelineSteps`, unit-tested) — steps before the
  milestone are done, the milestone is the current stage, and nothing past it is
  claimed. `ShipmentTimeline` is presentational over that helper; do not put
  step logic back in the component. Desde 14/08/2026 quem CHAMA `buildTimelineSteps`
  é a página de detalhe (`embarques/[id]/page.tsx`), não o componente: os passos
  alimentam três consumidores (timeline, insights por etapa e a seção
  Documentos) e uma segunda montagem divergiria da primeira. Os rótulos vêm de
  `lib/real-steps.ts`, que existe só porque `timeline-steps.ts` roda no runner
  do Node e não pode importar valor pelo alias `@/`.
- **Passo downstream não alcançado mostra PREVISÃO, não "Pendente integração"**
  (`lib/step-forecast.ts`, puro e unit-testado). Quatro regras, e a primeira é a
  que sustenta as outras:
  - **A previsão é DERIVAÇÃO do ETA que a mesma tela já mostra**, nunca um
    segundo número inventado: Chegada **é** o `current_eta` (mesma string que o
    `ShipmentEtaBadge` imprime), Descarregado é +2 dias e Liberado é +5. Foi
    assim que o card "Rastreamento marítimo" morreu — ETA próprio contradizendo
    o ETA do topo da tela. Uma pergunta, uma resposta.
  - **"Em trânsito" é a única que o ETA não dá sozinho** (é a PARTIDA). Subtrair
    uma perna de trânsito da chegada cairia no passado para carga que ainda nem
    ficou pronta, então ela é derivada para frente a partir de hoje pelo que
    falta da jornada operacional (`DEPARTURE_LEAD_DAYS`, decrescente por
    `estado`), com teto na metade do caminho até a chegada. Estado de exceção não
    tem lead (a linha está congelada e não se sabe o estágio anterior): cai no
    ponto médio. A partida fica **sempre** antes da chegada, inclusive com ETA
    vencido — há teste para isso.
  - **Previsão é só TEXTO.** Nada aqui muda `status`: o círculo do passo futuro
    continua vazio e "Etapa atual" continua onde a regra do milestone a colocou.
    Vale igual para `occurredAt` (a data REALIZADA, 18/08/2026): datar uma etapa
    não a promove nem a conclui.
  - **Sem ETA, sem previsão**: o passo volta para `ProvenanceBadge pending`. É o
    estado de um banco recém-semeado (sem top-up), o mesmo que `O15` trava no
    e2e. `INCOMPLETE` não entra nisso — aqueles passos são `blocked` e mantêm
    "Sem atualização da companhia".
- **`tracking.last_milestone_at` dates that milestone** (backend migration 093)
  and is the ONLY source for "liberado em". It is null whenever the carrier
  named a stage without dating it — never backfill it from `current_eta`, which
  is the arrival at POD and therefore earlier than every milestone after it.
- **Three data states, three visuals.** `null` → `ProvenanceBadge pending`
  ("Pendente integração" — we have not integrated); `'INCOMPLETE'` →
  `IncompleteDataBadge` (`app/portal/_shared/incomplete-data-badge.tsx`: dashed
  neutral ⚪ "Sem dado suficiente" — integrated, the carrier stayed quiet);
  `'COMPLETE'` → the real value. The INCOMPLETE state must NEVER borrow
  `portal-success`/`warning`/`danger`: those three are the shipment's health
  semáforo, and this badge is about data quality, not cargo. Copy is centralised
  as `INCOMPLETE_DATA_COPY`. Surfaces already wired for it: list card (ETA +
  risk), timeline (downstream steps go "travados"), world map (dashed neutral
  marker at the arc apex + a legend entry that appears only when some shipment
  is INCOMPLETE).

**Aba Alertas — cinco tipos, e dois deles não são como os outros.** O feed é
ilustrativo (`lib/shipment-alerts.ts`, selo `preview` no topo da aba), montado
sobre os embarques que o cliente já tem. Três tipos são informativos
(`confirmado`, `eta`, `excecao`); `demurrage` é o único com custo financeiro
direto, e por isso é o único que:

- é **sempre** `danger`, nunca o `ESTADO_SEMAFORO` do embarque — a saúde da carga
  é verde (ela chegou bem) enquanto a exposição do cliente é vermelha;
- **fura a ordem cronológica** enquanto não lido (`sortAlertsForFeed` em
  `lib/alert-priority.ts`, pura e unit-testada). Depois de lido volta para o
  lugar cronológico: a exceção existe para o cliente VER uma vez, não para fixar
  no topo. Adicionar um segundo tipo prioritário é uma afirmação forte — de que
  o cliente perde dinheiro lendo o feed em ordem;
- nasce de `tracking.last_milestone === 'AVAILABLE'`, não de `estado`: os
  estados do GE param em `embarcado` (partida), então só o rastreamento sabe que
  a carga está parada no terminal de destino.

O que ele **não** diz: prazo, contagem regressiva, "vence em X dias". Free time
é cláusula comercial que mora no Inova e não vem no feed da companhia — sem essa
integração o alerta afirma a liberação (com a data, quando existe) e para aí.
Como o alerta deriva de `tracking`, ele carrega `isMock` e desenha o selo
`preview` quando o embarque é dado de demonstração, igual a todo o resto.

O toggle do tipo nasce **ligado** como os outros, mas a chave de preferências é
versionada (`portal:shipment-alerts:types:v3`, em
`_shared/alert-type-preferences.ts`) porque uma lista salva antes deste tipo
existir o deixaria desligado sem o cliente saber. Bump de novo se um tipo futuro
não puder herdar opt-out antigo. Esse módulo é a **única** implementação da
preferência: a aba Alertas e Minhas Preferências > Notificações editam a mesma
coisa e o consomem juntas — não releia o localStorage numa terceira tela.

**O quinto tipo (`preco`) é o único que não fala de um embarque** — ele fala de
uma ROTA, e é o que transforma o Radar de Preços de painel passivo em aviso
(pedido do Victor Orsi: "notificar clientes sobre flutuações nas rotas
preferidas"). Vive em `lib/price-alerts.ts`, puro e unit-testado, e as regras
que o sustentam:

- **Só os dois extremos viram alerta** (`oportunidade` e `alta`). `atencao` é,
  por definição, "oscilação dentro do normal" — notificar isso é avisar que nada
  mudou, e três avisos desses ensinam o cliente a desligar o toggle antes do
  primeiro que importava.
- **Uma rota de cada extremo**, a mais distante da média (`MAX_PER_PRICE_TYPE`).
  O feed é cutucada, não catálogo: seis entradas de preço afogariam os alertas
  de embarque, que são os que têm carga andando.
- **As rotas são as MESMAS que a tela do Radar mostra**, `limit` incluído. A
  notificação termina em "Ver no Radar de Preços"; avisar sobre uma rota que a
  grade não exibe entregaria o cliente numa tela onde ele não acha o que foi
  avisado. Consequência prática, e ela é correta: uma oportunidade numa rota de
  uma carga só fica fora dos dois lugares, pelo mesmo critério.
- **Título e texto vêm do MESMO `route.alert`** que o card do Radar imprime.
  Escrever uma segunda frase criaria duas explicações para o mesmo número — o
  erro que já custou o KPI de Economia.
- **Não é prioritário** (`PRIORITY_ALERT_TYPES` continua só com `demurrage`): o
  cliente não perde dinheiro por ler o aviso de mercado uma hora depois.
- **Sem `shipmentId`**, porque não há embarque; é o que faz o filtro do Mapa
  deixá-lo de fora quando um chip está ligado, em vez de o pendurar numa carga
  qualquer. E **sem selo de proveniência**, seguindo a filosofia vigente para as
  partes novas — a mesma escolha da tela do Radar.
- **A data é a única do feed que não sai de um embarque.** É a hora da leitura,
  e é honesta pelo mesmo motivo que as outras: a janela do Radar é móvel e
  termina hoje. Entra por parâmetro (`observedAt`), fixada no mount da tela, e
  **não** entra no id — se entrasse, cada visita ressuscitaria a notificação
  como não lida.

**Toda notificação agora tem destino** (`alert.link`): as de embarque levam ao
embarque, a de preço leva ao Radar. Foi o que motivou trocar
`referencia`/`shipmentId` por `subject`/`link` no `ShipmentAlert` — nem todo
alerta é DE um embarque, e um campo chamado `referencia` obrigaria o alerta de
preço a mentir o nome do próprio assunto. O link mora numa faixa abaixo do corpo
do item porque `<a>` dentro de `<button>` é HTML inválido; clicar no corpo
continua marcando como lida.

**Ordem das abas: [Lista][Alertas][Mapa]**, com Lista como padrão. É prioridade
de uso: Lista é a tela do dia a dia e Alertas é o que exige ação. O deep link
`?tab=lista&busca=1` do header continua valendo; `TABS` em `embarques/page.tsx`
é quem define ordem e padrão.

### Aba Mapa — geografia real (Leaflet + OpenStreetMap)

Redesenhada em 12/08/2026. O SVG estilizado (`shipment-world-map.tsx`, removido)
não funcionava nem como visualização rica nem como visão agregada. No lugar,
`shipment-map-view.tsx` monta **resumo | mapa | eventos**:

- **Esquerda** (`map-summary-panel.tsx`): números grandes na cor do semáforo.
  Deliberadamente NÃO é o desenho do `SemaforoCounter` da Lista — lá a pergunta
  é "quantos nesta lista que estou filtrando", aqui é "como está a operação". A
  fonte é a mesma (`countBySemaforo`), então os dois nunca discordam.
- **Centro** (`shipment-map.tsx`): Leaflet. Precisa de `window`, então entra por
  `dynamic(..., { ssr: false })` — `shipment-map-view.tsx` é o único lugar que
  sabe disso.
- **Direita** (`map-events-feed.tsx`): os MESMOS alertas da aba Alertas, com as
  mesmas preferências de tipo e o mesmo estado de lido. Sem switches e sem
  "marcar como lida": esses controles são da aba Alertas, e duplicá-los criaria
  dois lugares editando o mesmo estado. O selo `preview` acompanha o dado.

Regras que sustentam a tela:

- **Duas réguas de "situação" convivem, e o vocabulário as separa (18/08/2026).**
  O chip "Com atraso" e o card "Visão do todo" ficam a centímetros um do outro e
  diziam 5 e 1 usando a mesma palavra — leitura imediata de quem valida a tela:
  "um dos dois está errado". Nenhum está:
  - o **chip** mede o deslize da COMPANHIA (`delayRiskFromTracking`: ETA atual −
    primeiro ETA, a mesma função do badge de cada card). Contínua, existe só onde
    há rastreamento, e um embarque em curso normal pode estar atrasado nela;
  - o **card** mede o ESTADO do embarque no GE (`ESTADO_SEMAFORO`), categórico,
    existe para todo embarque e hoje só acende laranja em `postergado`.

  Foram **mantidas as duas contagens** — unificar apagaria ou o embarque adiado
  que a companhia ainda não reportou, ou o que a Freitas não reprogramou e mesmo
  assim chega cinco dias tarde. O que mudou foi o NOME: `SEMAFORO_LABELS`
  (`types/portal-shipment.ts`, fonte única para o contador da Lista, o filtro
  "Situação", a legenda do Mapa e o "Visão do todo") passou de "Atenção / atraso"
  para **"Reprogramado"**. Só o chip fala em atraso. `shipment-semaforo.test.ts`
  falha se um rótulo do semáforo voltar a falar em atraso, se as duas réguas
  passarem a contar igual, ou se um estado laranja novo tornar "Reprogramado"
  mentira.
- **A regra "sem filtro/busca/card solto" foi PARCIALMENTE levantada em
  14/08/2026.** Victor Orsi: o mapa "é mais visual do que funcional", mostra os
  treze embarques de uma vez e não deixa isolar o que precisa de atenção. Entrou
  a fileira de chips (Todos / Urgentes / Com atraso / Com exceção — os mesmos
  predicados e o mesmo componente da Lista, ver a seção de filtros rápidos).
  Busca e card solto continuam fora, e as duas colunas laterais continuam sendo
  leitura. O que o filtro faz e não faz:
  - recorta o **mapa** e os **eventos**; o que não bate **some**, não fica
    esmaecido — esmaecer não remove poluição visual, só a repinta;
  - **não** recorta o "Visão do todo", que é a saúde da carteira inteira. Mudá-lo
    com o filtro faria o cliente achar que embarques sumiram da contagem.
  - Estado vazio no lugar do mapa ("Nenhum embarque com exceção no momento —
    ótimo sinal.") com atalho de volta para Todos.
  - Não persiste: o `TabsContent` do Radix desmonta a aba inativa, então trocar
    de aba já devolve "Todos". Não acrescente localStorage a isto — o filtro é
    uma pergunta do momento, não uma preferência.
- **O mapa se enquadra no que está plotado** (`FitToPlotted` em
  `shipment-map.tsx`), e reenquadra quando o filtro muda. Foi o que tornou o
  filtro útil: com a vista fixa em `center=[15,0] zoom=2`, filtrar para dois
  embarques deixava as duas origens FORA do quadro. Pelo mesmo motivo o
  `minZoom` é **1**, não 2 — a coluna do mapa tem ~574px a 1440, e 360° só cabem
  ali a partir do zoom 1; com o piso em 2 o enquadramento de um par distante
  (Los Angeles + Shenzhen) era clampado e centrava num Atlântico vazio.
- Abaixo de `xl` as colunas empilham (resumo → mapa → eventos), que é o padrão do
  portal — abas dentro de aba seria navegação que nenhuma outra tela usa.
- **Uma tabela de portos só** (`lib/port-coordinates.ts`): coordenadas públicas
  reais, dado estático, nada de ShipsGo. `lib/shipment-origins.ts` virou **alias**
  dela, porque a Lista e o detalhe nomeiam a origem do card pelos mesmos hubs —
  duas tabelas divergiriam no primeiro porto acrescentado a uma delas. Unit-tested
  (`port-coordinates.test.ts`), inclusive um teste que falha se o seed ganhar uma
  origem sem coordenada.
- **A posição é do PORTO, nunca do navio.** Não há AIS nem `mapPoint` do ShipsGo:
  um embarque em trânsito aparece parado no porto de origem. Quem diz isso é a
  nota do rodapé, uma vez, para todos os pontos — **nenhum marcador carrega selo
  próprio de "real" vs "aproximado"** (decisão de 12/08/2026). Origem real vem da
  cotação quando existe; sem cotação vinculada (a maioria dos processos), cai num
  hub determinístico pela referência, com a mesma aparência.
- **Porto desconhecido não some do mapa**: cai no hub ilustrativo. Quando a
  coordenada for acrescentada à tabela, o mesmo embarque passa a cair no lugar
  certo sozinho.
- **Cluster via `leaflet.markercluster` direto**, anexado por `useMap()` e não por
  um wrapper React (os wrappers estão presos a majors antigos de react-leaflet).
  `react-leaflet` fica na linha **4.x** — a 5.x exige React 19 e o projeto está no
  18. O marcador de destino (Santos) fica **fora** do cluster, e por isso precisa
  sair no cleanup do efeito junto com o grupo: sem isso, cada re-render empilhava
  outro Santos no mesmo ponto.
- **Cores em hex, não em classe Tailwind**, dentro de `shipment-map.tsx`: aquele
  DOM é do Leaflet (divIcon, polyline SVG, popup) e nossas utilities não chegam
  lá. Mantenha em sincronia com os tokens do semáforo pelo nome.
- **Offline é estado de primeira classe**: sem os tiles, as rotas e os marcadores
  continuam e uma nota explica que só o mapa base caiu. A atribuição do
  OpenStreetMap é obrigatória pela licença — a nota é posicionada para não
  cobri-la.

There is **no illustrative tracking panel**. An earlier "Rastreamento marítimo"
card on the detail screen showed a fabricated voyage / MBL / carrier / POL / POD
/ ETD / ETA grid (hashed from the reference) under a `preview` seal; it was
removed because its made-up ETA ("26 de ago") contradicted the "Pendente
integração" the same screen gives at the top — one screen, one answer per
question. The only real value it held, the vessel named in the Freitas note,
survives as `parseVesselFromObservacao` (`lib/vessel.ts`) and renders as "Navio"
inside "Dados do embarque" with a `real` badge, and only when the note names
one. Do not reintroduce the panel: those fields belong to the `tracking` block
when the feed exists.

`ShipmentTimeline` shows the real states then the four ShipsGo milestones (Em
trânsito, Chegada, Descarregado, Liberado = Ocean Transit, Arrival at POD,
Discharge, Available for Pickup); Gate-in and Vessel Loading are not repeated
because they already are the real `coletado` / `embarcado`. Its
`customsClearance` prop ("✓ Desembaraçado", a TAG on Chegada, not a step) comes
from a future Camada 2 (Inova / Portal Único) and is never passed today — with
no data it renders **nothing**, deliberately not even a `pending` badge, because
clearance data is not guaranteed for every process and a permanent grey badge
would read as a process gap.

### Indicador-chave do detalhe: data final + dias restantes (18/08/2026)

Planning da Sprint 13. Vinicius: "eu colocaria a data final como
indicador-chave... e quantos dias faltam em destaque lá em cima", e "prefiro dar
mais ênfase em poucos indicadores que ela precisa bater o olho e saber". A dor é
do comprador do cliente, que não sabe quando a carga chega e cobra o time
errado.

O que **saiu** do topo: o bloco "Chegada estimada (ETA) / Risco de atraso /
Previsão da companhia" — dois chips de 12px do mesmo peso, cada um com a própria
legenda, para responder a uma pergunta só (Orsi: "tira todo aquele chegada
estimada e coisas do gênero"). O que **entrou**: `ArrivalIndicator`
(`embarques/components/arrival-indicator.tsx`) sobre `lib/arrival-countdown.ts`,
puro e unit-testado.

- **A âncora é `tracking.current_eta`** (com `first_eta` de reserva) — a MESMA
  string que o `ShipmentEtaBadge` imprimia e a MESMA que `step-forecast.ts` usa
  como Chegada para derivar Descarregado (+2) e Liberado (+5). Não há segunda
  fonte de data de chegada nesta tela e não pode haver: foi ETA próprio
  contradizendo o ETA do topo que matou o card "Rastreamento marítimo".
- **O atraso não foi apagado, foi fundido.** O delta em dias é a única
  aritmética real da tela e o `step-insights` continua citando o número por
  extenso nas etapas ("O atraso de 7 dias já confirmado na chegada..."), então
  removê-lo do topo deixaria aquelas frases apontando para um número que a tela
  não afirma mais. Ele vive em duas formas: `arrivalTone` (o semáforo do atraso
  pinta o chip da contagem, e sem as duas previsões a cor é NEUTRA, nunca
  semáforo) e `arrivalNote` ("Postergada 7 dias sobre a primeira previsão da
  companhia."). **Não recalcule atraso aqui** — este módulo só redige o que
  `computeDelayRisk` devolveu.
- **Sem ETA não há contagem**: `unknown` é um resultado da função, não uma
  decisão do componente (mesma disciplina de `pending`/`incomplete` em
  `computeDelayRisk`), e a tela imprime "Sem previsão da companhia" ocupando a
  linha inteira, sem chip e sem "—" gigante ao lado.
- **`IsActual` sobre data futura não vira "Chegada confirmada".** É fonte se
  contradizendo (aparece no dado ilustrativo do `topup_tracking_full.py`), e
  entre o flag e o calendário a tela acredita no calendário: "Chegada confirmada
  — faltam 9 dias" é a única das duas leituras que não pode ser verdade.
- **Sem `ProvenanceBadge`** — decisão da mesma reunião, escopada a este
  componente, que era um dos últimos pontos do portal na convenção antiga (selo
  + moldura tracejada em volta do valor). A honestidade sobre `tracking.is_mock`
  **continua**, em texto corrido ("Rastreamento de demonstração — não vem da
  companhia marítima"), e a seção Acompanhamento logo abaixo segue selada. A
  coluna `tracking_is_mock` e a regra do selo nas demais superfícies **não
  mudaram**; aposentar o componente segue sendo decisão separada.

**Três indicadores no topo, no máximo** (princípio, não regra mecânica): a data
de chegada aqui, o badge de estado no header da página e a faixa de Ação
Necessária da timeline. Rota e Modal continuam no card porque são identidade do
embarque, não estado a interpretar.

### Acompanhamento: eixo HORIZONTAL em três níveis (14/08/2026)

Revisão semanal com Victor Orsi e Vinicius: a timeline vertical mostrava as nove
etapas com o mesmo peso e não respondia "onde meu embarque está agora". O
conteúdo não mudou (os textos descritivos de cada etapa continuam todos lá); a
apresentação passou a ter hierarquia, e são três níveis, nesta ordem:

1. **Ação necessária** — o que depende do CLIENTE, em faixa destacada
   (`portal-warning`), nunca dentro de accordion. É a única coisa da tela que
   ele pode mudar.
2. **Etapa atual dominante + próxima etapa secundária, EMPILHADAS** (uma sobre
   a outra, largura inteira), com risco e justificativa por extenso.
3. **O eixo horizontal** com as nove etapas, que rola no eixo x e **abre
   centrado na etapa atual** (`scrollLeft` do trilho, nunca da página). Os véus
   de esmaecimento nas pontas só aparecem quando existe conteúdo escondido
   daquele lado — véu fixo apagava a primeira letra de "Solicitado" num eixo que
   nem rolou.

**Dois ajustes de VOLUME na revisão de 18/08/2026** (planning da Sprint 13, com
a tela rodando). Nenhum dos dois tira conteúdo do cálculo, só da renderização:

- **Nível 2 empilhado por uma rodada, e revertido.** A troca para pilha foi
  feita para resolver um scroll horizontal de página que, medido depois em 15
  larguras de 320 a 1920px, **não existia**: o único overflow encontrado era do
  header do portal a 320px, sem relação com estes cards. Empilhados, os dois
  blocos somavam quase uma dobra de altura antes de a régua aparecer — o
  problema oposto ao que a mudança tentava resolver. Estão **lado a lado de
  novo** (`lg:grid-cols-3`, atual 2/3 + próxima 1/3), e o texto da próxima
  voltou para `portal-small`: o `portal-body` tinha sido consequência da largura
  inteira, não decisão de conteúdo. Lado a lado MINIMALISTA — mesmo conteúdo,
  menos volume. Abaixo de `lg` as colunas empilham sozinhas, que é o grid
  fazendo o certo, não uma exceção.
- **Risco só na etapa atual e na próxima, no eixo** (`showsRisk` no map do
  eixo). Orsi: "não precisa talvez apontar todos os riscos, talvez só da próxima
  etapa" — nove semáforos com nove justificativas era informação demais, e com a
  cascata do atraso confirmado (17/08) viravam sete chips vermelhos seguidos
  dizendo variações da mesma frase. `buildStepInsights` continua devolvendo risco
  para toda etapa não concluída (é o que os dois cards do nível 2 consomem) e os
  testes de `step-insights.test.ts` continuam valendo palavra por palavra: o que
  mudou é o componente, não a regra. Num embarque em exceção não há "atual" nem
  "próxima" e o eixo fica sem semáforo nenhum — quem responde por ele é a faixa
  vermelha da exceção.

#### O eixo virou RÉGUA (terceira rodada, mesmo planning)

Tirar os semáforos não bastou: o que carregava o eixo era o TEXTO — nove
parágrafos descritivos sob nove nomes de etapa, repetindo o que o card de
destaque logo acima já dizia por extenso. Cada card do eixo agora diz quatro
coisas, todas de uma linha:

    círculo de status · nome da etapa · data · marcas

- **Nada de descrição no eixo.** Ela continua inteira nos dois cards de destaque,
  que estão fora do escopo desta rodada e não mudaram. Não é perda de informação,
  é fim de duplicação.
- **As "marcas" são compactas e nunca só cor**: ponto de risco (sem a palavra),
  triângulo de reprogramação, badge de trecho travado e chip de ação. Todas
  carregam o texto por extenso em `title` + `aria-label` — cor sozinha não é
  informação para quem não a distingue. O badge/justificativa por extenso e a
  frase de reprogramação continuam nos cards de destaque.
- **Larguras são medidas, não escolhidas no olho**: `STEP_WIDTH` 112px e
  `STEP_WIDTH_CURRENT` 136px, constantes de JS (não classes Tailwind) porque o
  componente precisa SOMÁ-LAS para escolher o modo da régua — duas cópias do
  mesmo número divergiriam no primeiro ajuste. A 1440px o trilho tem 1070px
  úteis e 8 × 112 + 136 = 1032 põe as **nove etapas na tela sem rolagem**, com
  ~38px de folga (com 116/140 dava 1068 em 1070, e qualquer quebra de rótulo
  diferente devolvia a barra). Medido: **9/9 sem rolagem a 1440px e 1920px; 7/9
  a 1280px; 5/9 a 1024px; 1–2/9 a 390px**, sempre rolando o trilho e nunca a
  página.
- **Dois modos, escolhidos por MEDIÇÃO** (`fills`, com `ResizeObserver` no
  trilho — não por breakpoint, porque a barra lateral do portal colapsa e um
  `lg:` fixo erraria em metade dos casos na mesma tela):
  - **cabe** (`railWidth >= naturalWidth`): os degraus crescem (`flex: 1 0 base`)
    e a régua ocupa **100% do card**, primeiro círculo colado na borda esquerda e
    último na direita. O último degrau é **espelhado** — mesma largura de sempre,
    mas círculo à direita da célula (`items-end`), rótulo alinhado por ele e o
    traço conector vindo ANTES do círculo (colorido pela etapa ANTERIOR, que é
    quem desenharia aquele trecho no modo normal). Espelhar em vez de encolher a
    célula ao diâmetro do círculo é o que evita a colisão: com a célula estreita,
    o rótulo transbordava para a esquerda e "Previsto: 17 de set." caía em cima
    de "Previsto: 14 de set." da etapa anterior.
  - **não cabe**: largura fixa (`flex: 0 0 base`) + rolagem do trilho, exatamente
    o comportamento validado antes. `min-w-max` no `ol` vale **só** neste modo —
    no outro ele mediria o eixo pelo max-content dos rótulos em vez da largura do
    trilho.
  - `railWidth` nasce 0, então o primeiro render é sempre o modo com rolagem: na
    dúvida, o que não deforma nada.
- **Rótulo quebra em duas linhas, nunca trunca.** "Aguardando prontidão" e "Em
  análise de booking" não cabem numa linha a 112px, e reticências no NOME da
  etapa tirariam a única coisa que o card ainda diz.

#### Datas por etapa: só as duas que existem

`TimelineStep.occurredAt`, ao lado do `forecastAt` que já havia. **Não existe
tabela de transição de embarque** — `centrix_shipment_embarques` guarda só o
`estado` atual e nenhuma linha é escrita quando ele muda; `processos.datas` é
JSONB `null` em todo processo provisionado pelo portal. Isso já estava afirmado
no docstring de `shared/portal_shipment_helpers.py` e foi reconferido no banco em
18/08/2026. Logo, "concluído em 24 de jul." **não é derivável** para Aguardando
prontidão, Coletado, Em análise de booking nem Embarcado, e inventar o timestamp
seria pior do que não datar.

Existem exatamente dois fatos datados, e por isso exatamente duas etapas podem
receber `occurredAt`:

| Etapa | Fonte | Observação |
|---|---|---|
| `solicitado` | `processo.created_at` | O mesmo "Aberto em 13 de ago." do cabeçalho da página, mostrado onde responde "quando esta etapa aconteceu". Não é segunda fonte. |
| a etapa do milestone | `tracking.last_milestone_at` (migração 093) | Data o ÚLTIMO marco reportado. Os marcos anteriores ficam `done` e **sem data**: herdar para trás inventaria três datas a partir de uma. |

`occurredAt` só é preenchido em etapa `done`/`current` (o que não aconteceu não
tem quando), e em exceção — linha congelada, ninguém é `done`/`current` — não há
data nenhuma. Data realizada e prevista **nunca coexistem** na mesma etapa; há
teste para isso. No eixo o formato é o que separa as duas: realizada sai crua
("13 de ago."), prevista sai prefixada ("Previsto: 20 de ago.").

**Risco por etapa** (`lib/step-insights.ts`, puro e unit-testado) — semáforo de
3 cores + uma frase curta explicando o porquê. Duas regras:

- **Onde existe aritmética, ela ganha.** Os quatro passos pós-embarque herdam o
  resultado de `computeDelayRisk` (o MESMO do badge do topo, do card da Lista e
  das agregações de Inteligência), com o mesmo número de dias no texto. "Risco
  baixo" embaixo de um badge "Atraso, +7 dias" na mesma tela é a contradição que
  matou o card "Rastreamento marítimo".
- **Atraso confirmado CASCATEIA: força alto em toda etapa operacional restante**,
  sem gradação pelo peso próprio da etapa (17/08/2026, Vinicius/Geraldo). A
  versão anterior agravava uma casa, e o eixo saía "Em análise de booking" alto,
  "Embarcado" moderado (perfil próprio baixo) e "Em trânsito"/"Chegada" alto de
  novo — o vale do meio lia como alívio que não existe. O percentual histórico da
  etapa continua na frase (é o motivo específico dela) e o fator dominante fecha:
  "…10% perderam a janela de atracação. O atraso de 7 dias já confirmado na
  chegada é o fator dominante desta etapa." A cascata só age em `delayed`: em
  `attention` e no cenário no prazo cada etapa mantém o próprio nível. **Exceção
  (`postergado` / `booking_divergente`) continua agravando UMA casa** — mecanismo
  separado, porque ali não há medição nenhuma, só perda de visibilidade.
- **O que é ilustrativo é o percentual histórico da ROTA**, não uma medição
  deste embarque — determinístico pela referência, nível base por etapa. É
  estruturado como um modelo devolveria (`level` + `label` + `rationale`) para a
  versão integrada trocar a fonte sem tocar na tela.

**Gatilho de ação** — dois tipos, e nenhum é decorativo: `documento` leva à
seção Documentos (onde o envio acontece — um segundo lugar de envio seria um
lugar a mais para os dois estados discordarem) e `aprovacao` abre o
`ShipmentActionModal`. O portal continua **sem escrever no embarque** (nenhuma
rota de escrita do GE foi copiada para cá), mas desde 17/08/2026 o modal
**confirma** em vez de encerrar com "Nada foi enviado":

- O sucesso é **estado local**, que morre no refresh: `onConfirm` do prompt move
  `submittedDocumentIds` / `bookingApproved` na página, e quem projeta isso na
  tela é `applyLocalDocumentActions` (documentos) e o flag `bookingApproved` de
  `buildStepInsights` (faixa de ação). O builder de documentos segue descrevendo
  só o que o backend sabe — a projeção é camada por cima, e sai inteira quando a
  Aprovação Documental existir.
- **A faixa de ação não some: vira recibo** (`StepAction.status === 'concluida'`
  — verde, sem botão; no eixo, chip "Ação concluída"). Continuar pedindo o que já
  foi feito quebra a demo; apagar a faixa tira a única prova de que o clique
  chegou a algum lugar.
- **O documento anda UM degrau** — `pendente` -> `em_analise`, nunca direto para
  `aprovado`: quem valida é a Freitas, e pular a validação apagaria a etapa que
  dá nome ao módulo futuro. Aprovar o booking fecha o "Booking confirmado"
  (`em_analise` -> `aprovado`), porque é o mesmo ato.
- **A ETAPA NÃO AVANÇA.** Os passos saem de `buildTimelineSteps` sobre o `estado`
  do backend, que também alimenta o badge do topo, o card da Lista, o Mapa e a
  própria seção Documentos: fingir a transição só aqui faria o detalhe discordar
  de quatro superfícies. E a transição real não é do cliente — ele aprova, quem
  move `analise_booking -> embarcado` é o analista fechando com o armador.
- O selo `preview` + "Confirmação simulada nesta demonstração" no rodapé do
  sucesso é o que impede a tela de afirmar um efeito que o backend não teve.
  `request-agent-modal` (Meus Agentes) e `dispute-draft-modal` (Auditoria)
  seguem no contrato antigo de propósito: lá o clique pediria algo a um
  destinatário que não existe, aqui ele responde a uma pergunta da própria tela.

**Mudança de data** ("Postergado 5 dias — motivo: navio lotado") — o
deslocamento em dias é REAL (delta das duas previsões da companhia, via
`delayRisk.deltaDays`); só o motivo é ilustrativo, porque o embarque não guarda
histórico de transição. Sem as duas previsões não há número, e a linha afirma só
o motivo. Num embarque `postergado` o aviso fica na **Chegada**, não na primeira
etapa não concluída — aquela é "Solicitado", que já aconteceu.

### Documentos do embarque (`lib/shipment-documents.ts` + seção própria)

Seção primária e ABERTA (`.portal-card`, âncora `#documentos`), nunca accordion:
documento é a segunda pergunta que o cliente traz para esta tela, e arquivo que
só existe atrás de um clique de expansão é arquivo que ninguém encontra. A lista
é ilustrativa — não há tabela de documento de embarque exposta ao portal — mas o
shape é o que a **Aprovação Documental** vai devolver, e é isso que não pode
afrouxar: `type` é código estável (não o rótulo em português), `status` tem os
três estados que uma aprovação precisa distinguir (`pendente` / `em_analise` /
`aprovado`) e `source` diz de quem é a obrigação, que é o que decide se a linha
mostra botão de envio ou de download.

- **Que documentos existem sai dos PASSOS da timeline**, não de uma segunda
  tabela de etapas: o builder recebe a saída de `buildTimelineSteps`. Duas
  listas de etapas divergiriam no primeiro estado acrescentado a uma delas.
- **O pendente do cliente é o mesmo registro que o gatilho de ação da timeline
  cobra** (`pendingClientDocuments` alimenta `buildStepInsights`). A etapa nunca
  pede um arquivo que a lista mostra como entregue.
- **Nenhuma data de upload é futura** (clampada em `now`) e documento pendente
  não tem arquivo, data nem tamanho — os três são `null`, não zeros.
- Visualizar/baixar são mockados (toast): não há arquivo por trás. Upload abre o
  mesmo `ShipmentActionModal` dos gatilhos, **sem seletor de arquivo**: o clique
  já vale como envio, porque um `<input type="file">` real devolveria um `File`
  que não tem para onde ir e o cliente escolheria um arquivo do disco dele para
  ver na tela um nome de arquivo gerado.
- `applyLocalDocumentActions` aplica o efeito do modal por cima da lista
  (ver "Gatilho de ação" acima). Ela reordena com o MESMO comparador do builder,
  para um documento que muda de status andar na lista como andaria se o backend
  já soubesse dele.

**Spacing** — 8px grid: `gap-1` (4) / `gap-2` (8, default) / `gap-4` (16, between
sections) / `p-6` (24, card padding) / `space-y-8` (32, between page blocks).
Do not introduce `p-3`, `gap-3`, `space-y-5` or other off-grid steps in `/portal`.

**Icons** — outline (lucide), `h-5 w-5` (20px), always paired with a label.

> Class names composed in `types/` are only picked up because
> `./types/**/*.{ts,tsx}` is in the Tailwind `content` globs. Keep it there.

## MUDANÇA DE PROPÓSITO — 12/08/2026

O protótipo virou **referência visual** para quem vai construir a versão
integrada, e deixou de ser uma réplica que anuncia ao usuário final o que é real
e o que é mock. Onde a tela dizia "Pendente integração", ela agora mostra dado
ilustrativo rico. O contexto completo, com a tabela de telas afetadas e a lista
do que NÃO afrouxou, está no `CLAUDE.md` da raiz — leia antes de tratar qualquer
mock desta seção como regressão.

O que isso muda nas convenções descritas abaixo:

- **`pending` recuou, `preview` avançou.** "Rotas com maiores desvios",
  "Armadores mais usados", "Economia e Benchmark" e o card "Quando a auditoria
  dispara" trocaram `pending` por `preview`: o dado passou a existir, ilustrativo.
  `pending` continua válido e em uso — é o fallback quando NEM ilustrativo existe
  (ex.: On-time rate num banco sem nenhum top-up de tracking).
- **Legenda de selo só lista o que aparece.** A legenda de proveniência do
  Performance esconde a entrada `pending` quando nenhum indicador da tela está
  nesse estado — mesma regra da legenda do Mapa.
- **`ProvenanceBadge` continua como está**, nos mesmos ~8 lugares. Aposentá-lo é
  decisão separada e ainda não tomada.
- **Economia tem fonte única**: `inteligencia/lib/illustrative-kpis.ts`
  (`computeIllustrativeSavings` + `computeOnTimeRate`), consumida por Performance
  E Executivo. O número foi removido das duas telas em 05/08/2026 justamente
  porque elas discordavam; ele só voltou porque agora é calculado uma vez. **Não
  recalcule savings numa terceira tela — importe daqui.**
- **Rota e armador aceitam fallback ilustrativo** (`shipment-dimensions.ts`): a
  cotação tem prioridade, e sem ela o embarque cai no mesmo hub de
  `port-coordinates.ts` que o Mapa e a Lista usam. A regra antiga — embarque sem
  cotação fica FORA do ranking — foi levantada nesta data, e os dois testes
  unitários que a travavam foram reescritos, não apagados. O que continua
  proibido: balde genérico ("Não informado", "Outras") no topo de um ranking.
- **Filtro de Origem da Lista é busca**, não lista fixa, e o menu Filtros virou
  `Popover` (era `DropdownMenu`): o typeahead do DropdownMenu do Radix captura as
  teclas e um `<input>` dentro dele não recebe o que o usuário digita.
- **Banner da Auditoria** diz "Referência visual", não mais "Conceitual —
  aguarda conclusão do módulo de Tracking": a tela passou a mostrar o fluxo
  inteiro funcionando, e o texto antigo a contradizia. O selo `preview` do
  cabeçalho e o prefixo `EXEMPLO-` das referências continuam — são eles que
  dizem, por linha, o que é ilustrativo.

## Client Portal modules — Inteligência & Auditoria

Two `/portal` modules that surface product answers under one **honesty
discipline**: nothing real wears the preview badge, nothing fabricated is shown
without it. The shared badge is `ProvenanceBadge`
(`app/portal/_shared/provenance-badge.tsx`) — three variants: `real` (green "Dado
real"), `preview` (pink dashed "Pré-visualização" — a fabricated number, same seal
as the per-quotation Auditoria section) and `pending` (grey "Pendente integração"
— NOT fabricated, just has no data source yet: ETA feed, exception engine,
invoice/BL). Reuse it on any new portal surface that mixes real and illustrative
data; do not invent a second badge style. The distinction matters: `preview` = a
made-up value; `pending` = a real value that will arrive when an integration
lands.

Both modules are **read-only** and add **no backend endpoint** — they compose
existing `GET` routes. Their sidebar entries live in
`app/portal/components/portal-sidebar.tsx` (`Sparkles` → Inteligência,
`Scale` → Auditoria). Minhas Preferências (`Settings`) mora lá também, mas
**não** é read-only: é a área de conta, e as telas dentro dela são as únicas do
portal que escrevem no backend (ver a seção delas adiante).

**A sidebar tem SETE itens** (03/09/2026): Início, Visão Geral, Minhas Cotações,
Meus Embarques, Inteligência, Auditoria, Minhas Preferências. Fora a Home e a
Visão Geral, é uma
lista de telas OPERACIONAIS: Meus Exportadores e Meus Agentes eram itens de
primeiro nível e desceram para dentro de Minhas Preferências — são
cadastro/configuração, e no nível de cima se misturavam com o uso do dia a dia.
Antes de acrescentar um item aqui, pergunte se ele é uma tela de trabalho ou de
configuração; o segundo caso é uma aba de Preferências.

Uma nota sobre o `preview` que vale para todo o portal: ele marca **número
fabricado**. A única exceção documentada é o bloco "Perfil de operação" de
Minhas Preferências, onde o selo marca um bloco funcional cujo efeito a jusante
ainda não existe — e a exceção só se sustenta porque o texto do bloco explica
isso. Não abra uma segunda.

### Inteligência (`/portal/inteligencia/`)

Quatro abas (`layout.tsx`): `performance/`, `agentes/`, `executivo/` e
`radar/`. A raiz `/portal/inteligencia` é só um `redirect()` para `performance`
— a antiga aba "Visão geral" **foi fundida** no Performance, porque "estou indo
bem ou não?" só se responde cruzando cotação e embarque na mesma tela. **Não
recrie uma aba de visão geral**: essa é a única que já foi removida por
redundância, e é a que sempre tenta voltar.

`radar/` (Radar de Preços) entra por último de propósito: as três primeiras
olham para TRÁS (como fomos), e ela olha para FRENTE (quando cotar).

`performance/page.tsx` tem três níveis de peso, e só três:

1. **Par dominante**: "Taxa de aprovação" (real) + "On-time rate" (badge
   `pending` — sem ETA/histórico de embarque, nunca um número fabricado).
2. **Apoio** (`StatNumber size="compact"`): Cotações (30 dias), Tempo médio de
   resposta, Embarques (30 dias), Embarques em andamento.
3. **Visualizações** (`performance/components/`): `agent-wins-block`,
   `status-donut-block`, `weekly-volume-chart`.
4. **Dimensões do embarque e o que falta** (fecham a tela): `route-deviations-block`,
   `carrier-usage-block`, `savings-benchmark-block`.

Duas regras que mantêm a tela coerente depois da fusão: as duas métricas de
volume usam a **mesma janela de 30 dias** (senão "volume" significa duas coisas
na mesma tela), e o **total histórico de cotações aparece uma única vez**, no
centro do donut — por isso o nível 2 mostra "Cotações (30 dias)", não o total.

#### Dimensões do embarque: rota e armador (`lib/shipment-dimensions.ts`)

`computeRouteDeviations` e `computeCarrierUsage` são puras e unit-testadas
(`shipment-dimensions.test.ts`). Três coisas que precisam continuar valendo:

- **O join é com a COTAÇÃO, e é obrigatório.** O payload do embarque não carrega
  rota nem armador: a rota real mora em `quotation.origin`/`porto_destino` e o
  armador em `best_proposal.carrier`. O elo é `shipment.quotation_id`. **Não**
  use a origem de `embarques/lib/shipment-origins.ts` para agregar — aquilo é um
  hash da referência, ilustrativo por design, e viraria um ranking de rotas
  inventadas com cara de medição.
- **`porto_destino` é LISTA.** A cotação pode nomear vários portos candidatos; só
  nomeamos o destino quando há exatamente um. Com dois, a rota agrega em
  "Brasil" — pegar o primeiro inventaria um destino.
- **Sem dado, a linha sai da conta; nunca vira zero.** Embarque sem rastreamento
  não entra na média de desvio, e `onTimePct` é `null` (renderizado "—"), não 0%.
  "0% no prazo" é uma acusação ao armador, não uma lacuna. Por isso os dois
  blocos mostram quantos embarques foram MEDIDOS ao lado do número.

**Armador ≠ Agente.** Armador/cia (Maersk, ONE) opera o navio ou o avião e vem de
`Proposal.carrier`; agente de frete intermedia e cota, tem tela própria ("Meus
Agentes") e ranking próprio (`lib/agent-helpers.ts`). Um agente cota vários
armadores e vice-versa — são duas perguntas distintas ("com quem contrato" ×
"em que navio a carga vai"). Não unifique os dois rankings nem renomeie um pelo
outro; há teste cobrindo justamente o join acidental por `best_proposal.agent`.

Os dois blocos levam `pending` por **volume**, não por cálculo: hoje só os
embarques do top-up de demonstração têm rastreamento, então a média sai de uma ou
duas observações. Quando o ShipsGo popular os embarques reais, viram `real` sem
mudar o cálculo.

`shipment-dimensions.ts` é o primeiro lib testável que importa um **valor** de
outro módulo (`delayRiskFromTracking`), e por isso o import traz a extensão
`.ts` — o runner nativo do Node não resolve caminho relativo sem extensão, e
`allowImportingTsExtensions` está ligado no `tsconfig.json` para isso. Os outros
libs testáveis importam só tipos (apagados na compilação) e não precisam disso.
A alternativa seria reimplementar o limiar de atraso aqui, o que a regra "uma
regra, um lugar" proíbe.

`agentes/page.tsx` é um **ranking ilustrativo** (painel inteiro na moldura
tracejada + badge `preview`), montado por `lib/agent-helpers.ts` sobre
`useMyQuotations` — sem endpoint novo. Chamava-se "Fornecedores" e foi renomeado
(05/08/2026): numa importação, **fornecedor é o exportador** — quem fabrica e
embarca a carga —, e usar a mesma palavra para o agente de frete embaralha dois
papéis que o cliente vê separados no portal (Meus Exportadores × Meus Agentes).
Não reintroduza "fornecedor" para agente de frete. **Real:** nome do agente, quantas
cotações ele fechou com a melhor proposta e as rotas correspondentes (o payload
da listagem só expõe a `best_proposal`, então a leitura é "melhor oferta", não
"todos os agentes que responderam"). **Ilustrativo:** Preço e Prazo são
relativos à média do **próprio cliente** (não é benchmark de mercado) e
Confiabilidade é rótulo qualitativo Alta/Média/Baixa. A nota de metodologia no
topo do arquivo é load-bearing: a versão real espera a correção do score de
agentes (contador cumulativo → taxa de erro em janela móvel). **Nunca** exiba
score numérico de agente aqui — mesma regra do `ScoreBadge` da cotação.

As 6 perguntas do canvas foram **distribuídas** para onde respondem em contexto
(ver tabela abaixo); os blocos continuam em
`app/portal/inteligencia/components/` e são **importados** pelas telas de destino
(cross-import, como `evidence-block` já importava `estado-badge`).

Tudo deriva de `computePerformanceMetrics(data)` (`lib/performance-helpers.ts`) +
`volumeTrend`/`weeklyVolume` (`lib/volume-helpers.ts`) sobre `useMyQuotations` e
`useMyShipments` — **sem endpoint novo**. Métricas **reais**: volume de cotações
e de embarques (por `created_at`), taxa de aprovação (aprovadas /
aprovadas+reprovadas), tempo médio de resposta (`created_at` →
`best_proposal.received_at`), embarques em andamento, cotações vencidas por
agente (vencedor de cada FECHADA), cotações por status.
`computePerformanceMetrics` **não produz mais nenhum número fabricado**: todo
campo que ele devolve é real.

#### Economia / Savings — nenhuma tela do módulo mostra número (05/08/2026)

O módulo tinha um `estimatedSavingsBRL` = `Σ(fechadas.total_brl) × 0,08` servindo
duas telas. Ele **foi removido do helper**, junto com os dois consumidores:

- **Performance** — "Economia estimada" (`preview`) virou "Economia e Benchmark"
  (`savings-benchmark-block.tsx`, `pending`), que **não calcula nada**, nem função
  pura: savings vs. a primeira proposta exigiria a série completa de propostas (o
  payload expõe só a `best_proposal`), e benchmark e operações semelhantes
  dependem do Data Lake.
- **Executivo** — o KPI "Economia estimada" (`preview`, com valor) virou
  "Economia" (`pending`, sem valor), no mesmo formato do "On-time rate" ao lado.

O motivo de fechar os dois: Performance e Executivo respondiam **a mesma
pergunta com respostas contraditórias na mesma sessão** — uma dizia "não temos
como saber", a outra dava um valor em reais. É o erro já corrigido no card
"Rastreamento marítimo" dos embarques: uma pergunta, uma resposta.

**Não reintroduza o campo no helper nem o número em nenhuma das duas telas** —
um valor fabricado disponível em `computePerformanceMetrics` volta para a tela na
primeira pessoa que procurar "savings". O fator +8% continua vivo, de propósito,
**só** em `components/market-block.tsx`, que declara o próprio `BENCHMARK_FACTOR`,
vive no detalhe da cotação (outra tela, outra pergunta) e emoldura o resultado
como ilustrativo.

O selo "Rascunho · Em validação" do Executivo permanece: Economia/Savings entra
como pauta da cocriação com o Victor Orsi junto com o resto daquele dashboard.

Cada bloco continua auto-fetchando via SWR (deduped por key), embrulhado em
`IntelBlock` (`components/intel-block.tsx`: `.portal-card` para `real`, moldura
tracejada para `preview`, + `ProvenanceBadge` + footnote). Helpers puros em
`lib/intel-helpers.ts` e `lib/performance-helpers.ts`. Mantenha os blocos
presentacionais; lógica nos helpers.

Distribuição dos blocos (o `provenance` de cada um **não muda** com o local):

| Bloco (arquivo) | Onde vive agora | Badge | Real vs Mockado |
|---|---|---|---|
| Decisão (`decision-block.tsx`) | **Coberta** pelo painel "Recomendação" (`recommendation-panel.tsx`) no detalhe da cotação — o bloco não é mais renderizado (arquivo mantido) | `real` | **Real:** recomendação por IA (score determinístico, exibido sem número) |
| Confiabilidade (`reliability-block.tsx` -> `ReliabilityBody`) | Metade de cima do card composto `agent-trust-block.tsx`, no detalhe da cotação | **sem selo** (28/08/2026) | **Real:** nomes dos agentes. **Mock:** scores (`seededInt`), que desde 27/08/2026 só ordenam a lista e escolhem o rótulo — nem número nem barra vão para a tela |
| Mercado (`market-block.tsx`) | Detalhe da cotação, painel ao lado das propostas | **sem selo** (28/08/2026) | **Real:** seu preço médio. **Mock:** benchmark do setor (`avg × 1.08`) e a tendência da rota, que vem inteira do Radar de Preços (ver abaixo) |
| Evidência (`evidence-block.tsx` -> `useEvidence` + `EvidenceBody`) | Metade de baixo do MESMO card ("O que já vimos com esse agente") | **sem selo** (28/08/2026) | **Real:** cards de embarques do histórico **e a frase de conclusão** (`lib/evidence-summary.ts`, sobre `estado`). **Mock:** critério de semelhança (agente + modal, sem rota/produto) |
| Risco (`risk-block.tsx`) | Detalhe da cotação, junto da seção Auditoria (só FECHADA) | `preview` | **Real:** sinais de campos reais + refs. **Mock:** a "análise de risco" consolidada |
| Prazo (`deadline-block.tsx`) | **Removido** de `/portal/embarques` (o "Prazo 87%" não tinha lastro; o resumo da aba Mapa mostra contagem real, não percentual inventado). Arquivo mantido, sem uso — candidato a remoção | `preview` | **Real:** contagem de embarques. **Mock:** % no prazo (constante 87%) |

Ao mexer num bloco, mantenha o `provenance` coerente com o **headline**: se o
número em destaque é fabricado, o bloco é `preview` (mesmo que use nomes/valores
reais em volta) e a footnote deve dizer o que é real e o que é ilustrativo.

#### Recomendação no portal: dado, não carimbo (27/08/2026)

Feedback do Vinicius sobre a tela de escolha de proposta — "mais limpo e menos
gritante", hierarquia errada, Evidência e Detalhes incompreensíveis. A parte da
Recomendação não era só peso visual: a caixa verde com "Pontuação geral: X/100"
e as seis barras ponderadas reproduziam o padrão discutido no discovery original
da Cotação (**ZO4**), sinalizado pelo Victor Orsi como risco reputacional alto —
se a Freitas carimba uma recomendação forte e a escolha dá errado, o cliente
responsabiliza a Freitas. A decisão registrada na época foi introduzir
recomendação de forma **gradual**, nunca com placar explícito cedo demais. A tela
tinha pulado direto para a versão mais forte.

**O CÁLCULO NÃO MUDOU.** `recommendation_service` (copiado do Centrix) segue
intacto, o endpoint segue o mesmo, o analista segue vendo a ferramenta inteira.
Mudou só a exibição, e só no `variant="portal"`:

- **Sem `total_score` e sem `ScoreBar`.** As seis barras e o 0-100 são a
  ferramenta de decisão do analista (Camada 2); no cliente elas viram veredito.
  O portal guarda o RANKING (a ordem da lista) e joga fora o aparato.
- **`recommendation_text` do backend não é renderizado no portal.** Aquela string
  traz a pontuação embutida e a frase-carimbo ("Esta rota oferece o melhor
  custo-benefício"). O portal redige a própria frase a partir do
  `recommended_proposal_id`, e ela termina em "A escolha é sua".
- **A frase diz "entre as propostas recebidas", NUNCA "com base no histórico
  desta rota"** — apesar de a linguagem de histórico ter sido a sugerida no
  feedback. Não existe histórico de rota por trás disto: `_compute_scores`
  normaliza custo/prazo/free time/validade ENTRE AS PROPOSTAS DESTA COTAÇÃO e lê
  rota/frequência dos campos da própria proposta. Invocar histórico trocaria um
  carimbo por uma fonte inventada — e o bloco "Evidência", na mesma tela, é o que
  de fato lê histórico. Suavizar o carimbo, sim; realocá-lo para uma fonte que
  não existe, não.
- **Selo discreto, sem estrela**: "Melhor equilíbrio", em `portal-info`, na
  linha do agente. Não é caixa, não é troféu.
- **O que ficou**: inelegibilidade e validade em risco. São fatos sobre a oferta
  que o cliente está prestes a escolher, não aparato de pontuação.
- O título do card no portal é **"Recomendação"** (sem "por IA"); no analista
  continua "Recomendação por IA".

Na mesma rodada, e pelo mesmo motivo (a régua que imitava o placar):

- **Confiabilidade perdeu a barra de progresso** — texto factual no lugar. A
  barra tinha altura, pista e preenchimento idênticos aos do `ScoreBar` logo
  acima; tirar o número de um e manter a régua do outro devolveria a sensação de
  placar sem sequer ter um número para justificá-la. Mercado não tinha barra e
  não mudou.
- **Evidência ganhou conclusão** (`inteligencia/lib/evidence-summary.ts`, puro e
  unit-testado). A lista crua de embarques não dizia o que significava para a
  decisão. A conclusão sai SÓ de `estado` — pontualidade ficaria em cima de
  `tracking_*`, hoje NULL ou `is_mock`, e o bloco perderia o selo "Dado real"
  que ostenta com razão. Como não há tabela de transição de embarque, a frase
  fala em ocorrência "em aberto", no presente, e a janela analisada é a janela
  exibida (`EVIDENCE_WINDOW`), para o cliente conferir a conta na lista logo
  abaixo. Recorte em cascata agente+modal -> modal -> qualquer, e o rodapé
  declara qual foi usado.
- **A seção "Detalhes" foi RECOLHIDA e depois REMOVIDA** (segunda rodada, mesma
  data). Frete, Total, Transit time e Validade já estão na tabela de propostas,
  lado a lado com as concorrentes, que é onde a comparação acontece — recolhida
  a seção ainda custava um clique e uma linha para não entregar nada novo.
  Foram-se com ela `cost-breakdown-section.tsx`, `proposal-details-card.tsx` e
  `additional-costs-card.tsx`. **Não reintroduza.** Sobre o último: `AdditionalCostsCard`
  era a única parte que a tabela não mostrava, mas `Proposal.additional_costs` é
  JSONB que nenhum seed e nenhum handler deste repositório escreve — era código
  morto na prática. Quando a extração de PDF passar a preencher a coluna, o
  lugar dele é uma linha da tabela comparativa, não um card no rodapé.

#### Segunda rodada da mesma tela: fato de volta, sem placar (27/08/2026)

Feedback do Vinicius depois de ver a primeira correção rodando: **"minimalista"
não é "vazio"**. Sem o placar E sem nenhum número, a Recomendação virou opinião
sem lastro. As quatro mudanças:

- **A frase carrega a maior diferença REAL contra a segunda colocada**
  (`app/portal/cotacao/lib/recommendation-gap.ts`, puro e unit-testado):
  "AGENTE ALPHA custa R$ 600,00 a menos que AGENTE BETA, a segunda colocada".
  Não é o placar voltando — é uma subtração que o cliente refaz com os olhos
  sobre duas células da tabela logo acima. Três regras no cabeçalho do módulo, e
  a do meio é a que não pode afrouxar: **uma dimensão só entra na frase quando é
  vantagem**. Na COT-2026-0001 a recomendada é mais barata e 4 dias MAIS LENTA;
  a frase fala do preço e cala sobre o prazo, que continua visível na tabela.
  Sem vantagem mensurável (proposta única, ou recomendada que vence por rota e
  perde em preço e prazo) a função devolve `null` e a tela cai na frase
  qualitativa — genérico é melhor que número torcido.
- **Confiabilidade e Evidência viraram UM card** (`agent-trust-block.tsx`): as
  duas respondem "posso confiar nesse agente?" em níveis de certeza diferentes,
  e separadas nenhuma explicava por que existia — a primeira era rótulo sem
  prova, a segunda prova sem pergunta. `reliability-block.tsx` e
  `evidence-block.tsx` passaram a exportar CORPO (`ReliabilityBody`,
  `useEvidence` + `EvidenceBody`) em vez de card próprio.
- **A proveniência não se misturava dentro do card composto** — cada
  `IntelSubBlock` (novo, em `intel-block.tsx`) carregava o seu, porque um selo
  único no topo teria de mentir sobre uma das metades. **Superado em 28/08/2026**
  (seção seguinte): os dois cards deixaram de marcar proveniência. O que continua
  valendo é a regra de composição — se os selos voltarem, eles voltam POR METADE,
  nunca um só no topo. `IntelBlock` e `IntelSubBlock` mantêm `provenance`
  opcional; não use a versão sem selo para escapar de declarar a proveniência de
  um bloco simples FORA da Comparação de Propostas.
- **O par lado a lado estica na mesma altura** (o grid perdeu o `items-start`) e
  o Mercado **centra o próprio conteúdo** (`justify-center`). Igualar altura sem
  distribuir o conteúdo produzia ~300px de vazio abaixo do texto do Mercado, que
  lê como card truncado, não como par equilibrado. Medido: 711px nos dois a
  1440px; a 390px empilham e o `justify-center` não tem efeito, porque não há
  altura sobrando.

**A ordem da página é narrativa, não arbitrária**: Recomendação (qual escolher)
-> Confiabilidade com Evidência dentro (posso confiar) -> Mercado (o preço está
competitivo) -> Dados da cotação (o dado bruto para conferir). Está comentada em
`cotacao/[id]/page.tsx`; mexer nela quebra a leitura, não só o layout.

#### Comparação de Propostas parou de marcar real x ilustrativo (28/08/2026)

Decisão de produto: clientes reais já estão vendo o protótipo, e nos dois cards
da Comparação de Propostas (Confiabilidade e Mercado) a distinção visível
estranha mais do que ajuda. Alinha os dois ao padrão que o Mapa segue desde o
Prompt 15.

- **Uma chave só**: `inteligencia/lib/proposal-provenance.ts`
  (`SHOW_PROPOSAL_PROVENANCE = false`). `agent-trust-block.tsx` e
  `market-block.tsx` passam `provenance={flag ? ... : undefined}`, e `IntelBlock`
  /`IntelSubBlock` já sabiam omitir selo e moldura tracejada quando a prop falta.
  **Não apague o `ProvenanceBadge` nem os call sites** — reverter é trocar o
  `false` por `true`.
- **Saiu junto o que era só moldura**: a borda tracejada dos dois cards, a do
  mini-card "Benchmark do setor" (agora `portal-card-muted`, igual ao "Esta
  cotação") e a do bloco "Tendência da rota" (borda de linha cheia). Manter a
  moldura sem o selo seria a mesma distinção, só que sem legenda.
- **Os textos que existiam SÓ para declarar proveniência foram removidos como
  texto, não escondidos pelo flag.** `reliabilityFootnote` deixou de existir (sem
  a ressalva não sobrava conteúdo); o rodapé da Evidência foi reescrito e ficou
  com o que é factual — qual recorte da amostra foi usado e o que "ocorrência em
  aberto" quer dizer (`Postergado` e `Booking divergente`), que é o que liga a
  frase de conclusão aos badges da lista; o rodapé do Mercado guardou só "A
  tendência da rota é a mesma do Radar de Preços, calculada uma vez", que é
  transparência FUNCIONAL (o bloco termina em "Ver no Radar de Preços" e o
  cliente precisa saber que reencontra o mesmo número), não declaração de
  autenticidade.
- **ESCOPO: esses dois cards.** `ProvenanceBadge` segue vivo e em uso na
  Auditoria, no Mapa e no resto do portal, e `tracking_is_mock` (Meus Embarques)
  **não** foi tocado — aquele contrato é outro e continua obrigatório.
- **Tipografia subiu um degrau** no conteúdo dos dois (o mesmo ajuste do Prompt
  14, `portal-small` -> `portal-body`; as conclusões e os valores em destaque
  foram para `portal-h3`), porque sem os selos e sem os rótulos sobrava altura na
  altura igualada do grid. `AgentTrustBlock` ganhou `justify-center` como reforço
  para o caso em que ELE é o card mais baixo (cliente sem histórico, uma proposta
  só) — o Mercado já tinha. Medido a 1440px: 568/568px na COT-2026-0001 e
  539/539px no caso de rota fora do Radar, sem overflow horizontal.

#### Radar de Preços (`inteligencia/radar/` + `lib/price-radar.ts`)

Responde "cotar agora ou esperar?". Proposta do Victor Orsi (14/08/2026): frete
das rotas que o cliente mais usa, com alerta de flutuação, para ele cotar no
momento certo. O Vinicius pediu para modelar com dado simulado e validar o VALOR
com dois ou três clientes antes de puxar o Lake — a tela é essa validação, e por
isso é convincente de propósito.

**REAL:** quais rotas aparecem e com que frequência. **SIMULADO:** todo número em
dinheiro. **Sem selo de proveniência**, seguindo a filosofia vigente (dado
ilustrativo rico). Quem sustenta a honestidade é a nota de metodologia do rodapé,
que declara a janela e o critério de cada número — apague-a e a tela passa a
afirmar um feed de mercado que não existe. Os limiares citados no texto vêm das
constantes do lib, nunca digitados na página.

- **As rotas são as MESMAS do resto do portal**: `computePriceRadar` agrupa por
  `routePartsOf` (exportada de `shipment-dimensions.ts` justamente para isto), a
  mesma resolução que "Rotas com maiores desvios" e o Mapa usam. Uma segunda
  geografia faria a mesma carga ser "Shanghai → Santos" numa aba e outra coisa na
  outra. Quando `routePartsOf` cai no genérico "Brasil" (a cotação não nomeia um
  porto único), o radar adota o **mesmo** `DESTINATION_PORT` (Santos) que o Mapa
  já adota — frete é cotado porto a porto, e "Hamburgo → Brasil" não tem preço de
  lane.
- **Preço é da LANE, não do embarque**: derivá-lo do embarque faria a mesma rota
  mostrar preços diferentes conforme quantas cargas o cliente moveu nela. E a
  **média histórica é a âncora**; o preço atual sai dela pela variação, nunca o
  contrário — os três números são impressos lado a lado e o cliente refaz a conta
  de cabeça.
- **`MARKET_REGIMES` (frouxo / estável / pressionado)** gera os números. É a peça
  que mais se parece com o que o Lake devolveria: uma lane está em algum estado, e
  os números caem dentro dele. Sortear variação e tendência de forma independente
  produziria combinações inexistentes no mercado (preço 20% abaixo da média
  subindo 25% em duas semanas), e é também o que garante que a tela mostre as três
  cores sem ninguém chumbar "este card é verde".
- **`classifyPriceAlert` não conhece o regime** — recebe só números. O regime gera
  a entrada, a classificação é a regra de negócio, e quando o Lake existir sai o
  gerador e fica a regra. Precedência: ALTA vence tudo (patamar OU subida forte);
  OPORTUNIDADE exige abaixo da média **E** estável, porque um preço barato subindo
  12% está com a janela fechando e mandaria o cliente cotar tarde — o radar é
  sobre o momento, não só sobre o nível.
- **`unit` e `currency` viajam com o preço**: marítimo cota por contêiner e aéreo
  por quilo, e colapsar os dois num "preço" faria a comparação entre modais
  mentir.
- **CTA "Cotar agora"** monta a query em `quotationPrefillParams` e cai em
  `/portal/nova-cotacao`, que a lê e passa `initialValues` ao `ManualForm`
  (prop nova, opcional; a tela do analista não passa nada e segue idêntica). Só
  três campos — modal e os dois portos —, porque são os que a rota realmente
  conhece: chutar mercadoria ou prazo faria o cliente enviar uma cotação que não
  conferiu. A tela de destino mostra uma faixa dizendo de onde veio o
  preenchimento; sem ela, campos já preenchidos leem como resíduo de rascunho e o
  cliente apaga o que estava certo.
- **`QUOTATION_PORT_OPTION` é mapa explícito**, não busca por prefixo: a tabela de
  coordenadas fala português ("Gênova", "Nova York") e a do formulário fala
  UN/LOCODE em inglês ("Genova, Italy (ITGOA)"). O unit test confere cada valor
  contra `PORTS_*_OPTIONS` de verdade, então uma entrada errada quebra o teste em
  vez de abrir a cotação com o campo vazio — falha silenciosa é a pior espécie.
- **O bloco "Mercado" do detalhe da cotação mostra a tendência da rota
  (28/08/2026)**, e não recalcula nada para isso. Ele existia para preencher o
  vazio que sobrava ao lado da Confiabilidade (medido: 711px nos dois cards a
  1440px, com ~300px de branco no Mercado), e a regra que o mantém honesto é a
  de sempre — reusar, não reproduzir:
  - **`lib/quotation-radar-route.ts`** (puro, unit-testado) só TRADUZ: pega a
    rota como a cotação a nomeia (`quotationRouteParts`, extraída de
    `shipment-dimensions.ts` para as duas leituras compartilharem `originOf` /
    `destinationOf`), aplica a MESMA normalização do Radar
    (`normalizeRadarRoute`, que é o "Brasil" -> porto de chegada) e procura a
    chave na lista que `computePriceRadar` devolveu. Uma segunda construção de
    chave falharia em silêncio justamente no caso mais comum, o da cotação sem
    porto de destino nomeado.
  - **Cotação sem origem devolve `null`, sem hub ilustrativo.** Aquele fallback
    é do EMBARQUE (hash da referência) e uma cotação não tem embarque.
  - **A busca é contra a lista que a tela do Radar EXIBE**, `limit` incluído —
    mesma disciplina do alerta de preço da aba Alertas: o bloco termina em "Ver
    no Radar de Preços", e afirmar tendência de uma rota que a grade de lá não
    mostra entregaria o cliente numa tela sem o que ele acabou de ler.
  - **Rota fora do Radar não esconde o bloco**, e desde 28/08/2026 também não
    para na explicação: ele cai para **as cotações que o cliente já FECHOU
    naquela mesma rota** (`lib/route-quotation-history.ts`, puro e
    unit-testado). O preço que o próprio cliente pagou é a única referência
    honesta que este repositório tem para uma rota que o Radar ignora, e é dado
    real — referência, valor (`best_proposal.total_brl`, o mesmo campo do card
    "Esta cotação" e da Economia) e data de fechamento. Quatro regras:
    - **A rota casa pela MESMA chave normalizada** (`quotationRadarRoute`, sobre
      `quotationRouteParts` + `normalizeRadarRoute`) usada para procurar no
      Radar. Uma segunda forma de comparar rota erraria calada no caso mais
      comum — o destino não nomeado que vira "Brasil" e depois porto de chegada
      — e o bloco diria "sem histórico" para um cliente que tem cinco.
    - **Sem histórico na rota, a frase de ausência fica como estava.** A função
      devolve `null`, não lista vazia: não há o que preencher, e forçar conteúdo
      ali seria inventar referência de preço onde o cliente não tem nenhuma.
    - **Não há tendência, média nem comparação** sobre essas linhas. Duas
      cotações do próprio cliente em meses diferentes não são série de preço de
      mercado; virar seta de tendência seria fabricar a leitura que o Radar
      existe para dar. Por isso o título do bloco muda para "Seu histórico nesta
      rota" neste ramo — "Tendência da rota" com fechamentos embaixo prometeria
      o que as linhas não entregam.
    - **O desenho é o da lista da Evidência** (mesma promessa de leitura, do
      outro lado da tela), com o VALOR à direita no lugar do badge de estado:
      todas as linhas são FECHADA por construção e um badge idêntico em todas
      seria ruído. Corte em `ROUTE_HISTORY_WINDOW = 3`, declarado na frase
      quando existe ("Abaixo, as 3 mais recentes"), nunca em silêncio.
    - **O seed não exercita este ramo sozinho**: só há duas cotações FECHADA
      (COT-2026-0001 e 0004), em rotas diferentes uma da outra e ambas dentro do
      Radar. Quem cobre a lacuna é
      `backend/scripts/topup_route_history_demo.py`, que cria duas FECHADAS em
      Izmir → Santos (a rota da COT-2026-0009, fora do Radar). Depois de rodá-lo,
      a lista aparece na COT-2026-0009 (plural, duas linhas) e nas próprias
      novas, que se enxergam uma à outra (singular).
  - **O desenho é o mesmo**: `components/price-trend.tsx` (`PriceAlertBadge`,
    `PriceTrendLine`, `PRICE_ALERT_CLASS`) saiu de dentro de `radar/page.tsx` e
    agora serve as duas telas. Duas paletas para a mesma classificação fariam
    "Alta significativa" mudar de cor conforme a tela.
  - O grid do par Confiabilidade × Mercado **não mudou** (segue sem
    `items-start`, com `h-full` no Mercado): medido depois, 732px nos dois a
    1280px e 654px a 1920px, sem overflow horizontal de 390 a 1920.
- **O CTA deixa rastro de origem (18/08/2026).** O Radar existe para validar uma
  proposta de produto com dois ou três clientes; validar exige contar "quantas
  cotações saíram daqui?", e até então o clique não deixava marca nenhuma. Agora
  a query leva `origem=radar_precos` (`RADAR_ORIGIN`/`ORIGIN_PARAM`), a Nova
  Cotação a lê com `radarOriginFields` — a outra ponta, pura e testada contra a
  query que o CTA escreve, porque um nome de parâmetro divergindo faria o rastro
  sumir em silêncio — e manda `portal_origin` + `portal_origin_route` no POST.
  Três decisões que não podem afrouxar:
  - **`portal_origin`, não `origin`**: `origin` já é campo de cotação (o local de
    coleta);
  - **a origem é lida SEPARADA do pré-preenchimento**: porto que o formulário não
    conhece deixa o campo em branco, mas o clique continua tendo vindo do Radar e
    continua contando;
  - **é dimensão A MAIS que a tag "portal"**, nunca no lugar dela. O backend
    grava num log próprio (`backend/app/quotation_origin.py`) e o card do Kanban
    do analista acende um ícone de radar AO LADO da tag "Portal"
    (`created_from_radar` em `KanbanCard`) — trocar uma marca pela outra tiraria
    a cotação de todo filtro de portal que a Grazi e a Duda já usam.

### Home (`/portal/home/`) — a landing do portal

Desenho validado com Victor Orsi e Vinicius (Claude Design). Landing pós-login;
`/portal` é um `redirect()` para cá. Revisada em 03/09/2026 para bater com o
mockup aprovado — as três mudanças abaixo são de FIDELIDADE, não de opinião.

**1. A Home é a única tela SEM SIDEBAR.** O bloco navy com abas
(`components/portal-tab-header.tsx`) a SUBSTITUI: `portal/layout.tsx` esconde
`PortalSidebar` quando `pathname === '/portal/home'`, e `portal-header.tsx`
esconde o hamburguer mobile pelo mesmo motivo (ele abriria um overlay vazio). Em
qualquer outra tela do portal a sidebar continua exatamente como estava.
Consequência prática, e ela é aceita: as abas são a única navegação da Home, e
Auditoria e Minhas Preferências só reaparecem quando o cliente sai dela.

**2. A Home mostra UMA ação, não a fila.** `components/urgent-action-card.tsx`,
fundo rosa claro (`bg-primary/5`, a única superfície assim no portal) e botão
primário. A tela tinha a fila inteira e isso derrotava o propósito dela — 18
linhas empilhadas não respondem "o que depende de mim?", adiam a resposta. A fila
continua completa, na Visão Geral, e a linha abaixo do card conta quantas ficaram
("Mais N ações aguardam você — organizadas por módulo na Visão Geral").

- **O "mais urgente" é `collectHomeActions[0]`, e ele É o de prazo mais
  próximo** — aritmética da fila, não sorte de ordenação: só ações de `proposta`
  carregam prazo (a validade da proposta vencedora; nada em `step-insights` data
  um gatilho de embarque) e `proposta` é a categoria de menor peso em
  `KIND_WEIGHT`. Toda ação com prazo precede toda ação sem prazo, e entre elas a
  ordem é por `daysLeft` crescente. Reordenar por prazo daria a mesma lista e
  criaria uma segunda definição de urgência para divergir da primeira; há teste
  travando a propriedade.
- **"Atalhos"** (`components/home-shortcuts.tsx`) são quatro pills NEUTRAS, não
  botões rosa: são navegação, e um segundo rosa disputaria o clique com o card
  acima. O pill "Documentos" é **inerte** — não existe rota de documentos no
  portal (eles vivem dentro do detalhe de cada embarque, sem endpoint agregado).
  Ele aparece porque está no mockup e fica inerte porque a alternativa era mandar
  o cliente para uma tela que não responde o que o rótulo promete; quando a rota
  existir, é só preencher `href`.

**3. O card "Economia Gerada" saiu.** A Home responde "o que precisa de mim
hoje"; economia é pergunta de Inteligência, que já tem duas telas para ela.
`SavingsCard` e `illustrative-kpis` continuam no repositório e em uso lá — o que
saiu foi o consumo nesta tela.

**O farol mudou de LUGAR, não de conta.** As três contagens continuam saindo de
`countBySemaforo` + `SEMAFORO_LABELS` (a mesma fonte do "Visão do todo" da aba
Mapa); o que mudou é que elas são chips no canto superior direito do bloco navy,
via `_shared/semaforo-chips.tsx`. `StatusBeaconCard` e `ActionList` foram
REMOVIDOS, não esvaziados.

**SEM ENDPOINT NOVO E SEM CÁLCULO NOVO.** Tudo sai de `/portal/quotations` e
`/portal/shipments`, as duas chaves SWR que o resto do portal já usa
(deduplicadas, não é fetch a mais):

| Bloco | Fonte reusada | Onde a mesma fonte já aparece |
|---|---|---|
| Farol (chips no navy) | `countBySemaforo` + `SEMAFORO_LABELS` (`types/portal-shipment.ts`) | "Visão do todo" da aba Mapa, e o farol da Visão Geral |
| Sua ação mais urgente | `collectHomeActions` (`home/lib/home-actions.ts`), que RODA a pipeline do detalhe do embarque | faixa de Ação Necessária da timeline, e a coluna 1 da Visão Geral |

A Home é ponto de COMPOSIÇÃO, como `embarques/[id]/page.tsx`: uma leitura de
relógio por render (`now`), compartilhada pela saudação do cabeçalho e pelos
prazos das ações — duas chamadas a `new Date()` cairiam em dias diferentes na
virada da meia-noite e "Expira hoje" discordaria do prazo que a fila ordenou.

#### Cabeçalho navy com abas (`components/portal-tab-header.tsx`)

- **Navy `#2C2D65` (`brand-navy`) emoldura, nunca convida a clicar.** Rosa
  (`primary`) continua sendo a única cor de ação; no cabeçalho ela aparece só no
  filete de 2px da aba ativa, que é o papel de "nav ativa" que a sidebar cumpre
  nas outras telas.
- **O bloco é full-bleed** (margens negativas cancelando o `p-6 md:p-8` de
  `portal/layout.tsx`) porque a aba ativa é pintada com `portal-canvas` e encosta
  na borda de baixo — ela literalmente continua no fundo da página. Com o bloco
  recuado, a aba ativa terminaria no ar e o efeito de aba de browser sumiria.
- **O cabeçalho não conta nada**: `counts` chega pronto.
- **Toda aba tem destino real.** "Documentos" estava no desenho e ficou de fora
  porque não existe tela de documentos no portal. Auditoria e Minhas Preferências
  não entram porque são telas de configuração — a sidebar, que volta assim que o
  cliente sai da Home, é quem as serve.
- **`_shared/semaforo-chips.tsx` é um desenho só** para as duas telas de entrada
  (`variant="navy"` na Home, `light` na Visão Geral). As bolinhas não mudam de
  cor com o fundo: são semáforo, e semáforo não negocia com o plano de fundo.

#### `lib/home-actions.ts` — a fila do que depende do cliente

Puro e unit-testado (`home-actions.test.ts`, 17 checagens). **Não descobre nada:**
roda `buildTimelineSteps` -> `buildShipmentDocuments` -> `pendingClientDocuments`
-> `buildStepInsights`, na mesma ordem da tela de detalhe, e coleta os gatilhos
com `status === 'pendente'`. Uma segunda regra de "o que está pendente"
divergiria da faixa de Ação Necessária na primeira mudança de qualquer uma das
duas, e a Home pediria um documento que o embarque mostra como entregue.

- **Duas fontes, não uma.** O embarque dá `documento` e `booking`; a COTAÇÃO dá
  `proposta` e `dados`, via `PORTAL_CLIENT_ACTION_BUCKETS` — os mesmos dois
  baldes do "X aguardando sua ação" do Funil. O "prazo pra confirmar" do desenho
  só pode vir daí: **nada em `step-insights` data um gatilho**, o embarque não
  tem prazo a cobrar do cliente.
- **`buscando_propostas` NÃO entra na fila** (há teste). Lá a bola está com o
  agente; ele é o rodapé, complemento das ações, não uma sexta linha.
- **`applyLocalDocumentActions` não entra**: aquilo projeta o que o cliente
  clicou na sessão da tela de detalhe, e a Home descreve o que o backend sabe.
- **O prazo viaja como DATA CRUA (`deadline`) + dias (`daysLeft`)**: quem redige
  é o `daysUntil` de `lib/portal-formatters`, o mesmo do card do Funil, para
  "Expira hoje" ser a mesma frase nos dois lugares; `daysLeft` existe só para a
  ordenação ser determinística sem depender do relógio de quem formata.
- **Ordem**: categoria (proposta -> booking -> documento -> dados, por quanto
  cada uma trava se ficar parada), depois prazo mais curto, depois id — o
  desempate por id é só estabilidade entre renders, não significa nada.
- **O corte é declarado.** `HOME_ACTION_LIMIT = 5`, e o retorno traz `total`; a
  tela imprime "Mostrando 5 de 13 pendências" com atalho. Truncar em silêncio
  leria como "é só isso".
- **`REAL_STEPS` entra por argumento** (o módulo roda no runner do Node, que não
  resolve o alias `@/`) — mesmo contrato de `buildTimelineSteps`.
- **Jargão explicado inline**: "booking — a reserva de espaço no navio". `title`
  e `ctaLabel` vêm de `StepAction` sem reescrita; a DESCRIÇÃO de uma linha é da
  Home, porque os textos de `step-insights` são de uma faixa com o embarque em
  volta e estão travados palavra por palavra em `step-insights.test.ts`.

### Visão Geral (`/portal/visao-geral/`) — a Torre de Controle

Página nova, **ao lado** de Início e sem substituir nada. A Home responde "qual é
a próxima coisa que eu faço"; esta responde "o que está aberto, por módulo".

**Cabeçalho BRANCO, sem card escuro em volta.** O bloco navy é da Home, onde
substitui a sidebar; aqui a sidebar está de volta e um segundo bloco de marca
competiria com ela. Título preto, subtítulo "Tudo que precisa da sua ação hoje ·
[data]", farol em chips numa linha — tudo sobre o fundo da página.

**TRÊS SINAIS NA TELA, e só três** (regra dos 5 segundos): farol,
"Aguardando sua ação" e "Precisam de atenção". Nada de KPI, gráfico ou atalho
extra — quem quiser o quarto número tem uma tela para ele.

**O FAROL E AS COLUNAS NÃO SE POPULAM.** O farol é `countBySemaforo`: quantas
operações estão em cada nível de RISCO (verde/laranja/vermelho). As colunas são
quem PRECISA AGIR. São duas perguntas diferentes sobre a mesma carteira — um
embarque verde no farol pode ter documento pendente (o estado dele no GE está
normal, mas a bola está com o cliente), e um laranja pode não exigir nada. Somar
o tamanho das colunas para imprimir no farol daria um número que não responde
nenhuma das duas. **Nunca usar um para popular o outro.**

**IMUTÁVEL**, de propósito: sem toggle, sem ordenação escolhida pelo cliente, sem
personalização. A mesma estrutura para todo cliente é o que faz a Freitas poder
dizer ao telefone "olha a primeira coluna" e acertar.

**SEM ENDPOINT NOVO E SEM CÁLCULO NOVO.** `lib/control-tower.ts` (puro,
unit-testado em `control-tower.test.ts`, 17 checagens) não classifica nada por
conta própria — consome as regras que já existiam:

| Coluna | Fonte reusada |
|---|---|
| Aguardando sua ação | `collectHomeActions` (`home/lib/home-actions.ts`), que já é a união de `PORTAL_CLIENT_ACTION_BUCKETS` (o `needsAction` do Funil) com os `StepAction` `pendente` da timeline |
| Precisam de atenção | `delayRiskFromTracking` -> `computeDelayRisk`, com `attention` ou `delayed` |

- **`collectHomeActions` é novo, `buildHomeActions` não mudou.** O primeiro é a
  fila inteira e ordenada; o segundo é o wrapper que aplica o `HOME_ACTION_LIMIT`.
  O corte é decisão de layout, não parte da regra.
- **`HomeAction` ganhou `module` + `recordId`** (aditivo). A Home lista GATILHOS;
  a Torre lista o REGISTRO, senão um embarque com dois gatilhos ocuparia duas
  linhas da mesma coluna e o corte de três esconderia outro embarque por causa dele.
- **Um item nunca aparece nas duas colunas**, e o desempate é sempre para a
  primeira: se o cliente já tem o que fazer naquele embarque, o risco de prazo é
  contexto da mesma linha, não uma segunda cobrança.
- **Corte de `TOWER_COLUMN_LIMIT = 3` por coluna**, com o resto CONTADO no rodapé
  e link para o módulo. "entre os dois módulos" só é impresso quando os itens
  escondidos vêm mesmo dos dois (`hiddenSpansBothModules`) — a coluna de prazo é
  só de embarque e dizê-lo ali prometeria uma cotação que não está no resto.
- **Ordem = urgência, e é prazo onde existe prazo.** A coluna 1 herda a ordem de
  `collectHomeActions`, que já é "prazo mais próximo primeiro" (ver a seção da
  Home). A coluna 2 não tem prazo nenhum — nenhum embarque cobra data do
  cliente —, então ordena por `deltaDays` decrescente: a carga que escorregou
  mais aparece primeiro. Sem esse critério a ordem seria a do payload, que não
  significa nada.
- **A descrição da linha de prazo é escrita aqui**, e não é `risk.label`
  ("Atraso, +5 dias"): aquele é o texto do chip colado no ETA, dentro do
  embarque. Fora daquele contexto a frase precisa dizer QUEM moveu a data e
  contra o quê. O NÚMERO é o mesmo `deltaDays` que `computeDelayRisk` devolveu.
- **O link do rodapé da coluna 1 leva ao Funil** (a tela do `needsAction` de
  cotação) e à Lista de embarques. A Lista **não tem chip de "ação necessária"**
  hoje (os quatro são Urgentes, Embarcados, Com atraso, Com exceção), então esse
  link abre a Lista inteira; criar o chip é decisão de produto, não de layout. O
  da coluna 2 usa `?filtro=atraso`, que é a MESMA `delayRiskFromTracking` que
  classifica as linhas dela.
- **Sem Aprovação Documental** (só Cotação e Embarque alimentam as colunas),
  **sem selo de proveniência** (filosofia vigente desde o Prompt 15) e **sem dado
  fabricado**: coluna vazia mostra estado vazio em texto, nunca uma linha de
  exemplo para não parecer quebrada.

### Minhas Cotações — Funil, Histórico, Aprovadas e Reprovadas (`/portal/cotacoes/`)

Quatro abas, nesta ordem. **Funil** = cotação em andamento; **Histórico** =
cotação fechada, só leitura. Nenhuma coluna de cotação fechada no kanban, nenhum
número repetido entre topo e colunas.

**Aprovadas** (FECHADA) e **Reprovadas** (DECLINADA + CANCELADO) são **recortes** do
Histórico, não telas novas: renderizam o MESMO `HistoryTab`, com a prop
`outcomes` fixando o escopo. Três regras:

- O Histórico continua mostrando as três situações juntas — as abas focadas são
  atalho, não substituição. Não remova a aba nem o seletor "Situação" dela.
- Numa aba com `outcomes`, o seletor "Situação" **some**. Dois controles capazes
  de discordar deixariam a aba "Aprovadas" mostrar uma cotação cancelada.
- Nada é duplicado: a expansão "Conferência de dados", o `useAuditPreviews` e o
  modal de documentos são os mesmos, então uma mudança de layout de linha cai
  nas três abas de uma vez.
- Os rótulos mudaram em 26/08/2026 ("Fechadas" -> **Aprovadas**, "Negadas" ->
  **Reprovadas**), alinhando com "cotação aprovada" da timeline do embarque. Foi
  troca de COPY: os slugs de deep link (`?tab=fechadas`, `?tab=negadas`), os
  estados (`FECHADA`/`DECLINADA`/`CANCELADO`), filtros e contagens continuam
  iguais. O Kanban do analista (`app/cotacao/`, `app/inbox/`) **não** acompanha:
  lá "Fechada"/"Declinada" seguem sendo o vocabulário da camada interna.
- Na mesma data o vocabulário foi unificado em TODA a Camada 3, não só nas abas:
  o verbo virou **"Reprovar"** (botao, dialogo e toast de
  `cotacao/[id]/components/decline-dialog.tsx`), o estado virou **"Cotação
  reprovada"** (banner, timeline e cabecalho da tabela de propostas) e a
  Inteligência trocou "Recusadas" por "Reprovadas" (donut do Performance e os
  captions de taxa de aprovação das duas telas). A regra para copy nova: o
  cliente vê **aprovar/reprovar**, nunca "recusar" nem "negar". Nomes de código
  (`DECLINADA`, `decline_reason`, `PORTAL_DECLINE_REASONS`, `decline-dialog`)
  continuam em inglês e não acompanham — são contrato com o backend copiado do
  Centrix.

- **Funil** (`components/funnel-tab.tsx`): um único número dominante —
  "X cotações aguardando sua ação" = soma de `PORTAL_CLIENT_ACTION_BUCKETS`
  (`aguardando_aprovacao` + `aguardando_dados`, definido em `types/portal.ts`) —
  com "de N ativas no funil · M já resolvidas no Histórico" em texto secundário.
  As contagens por etapa já estão nas colunas; **não** reintroduza tiles de KPI
  nem cards de atalho por bucket (havia cinco tiles + dois cards dizendo o mesmo
  que o kanban).
  A linha secundária dizia "N no total · N ativas" até 26/08/2026 e os três
  números não declaravam a própria relação. Eles nunca foram três recortes
  independentes: `needsAction` é **subconjunto** de `activeCount` (2 das 3
  colunas), e `data.total` — que é `len(quotations)` no handler, TUDO, sem
  exclusão nenhuma — é `activeCount` **+** o Histórico. O texto passou a nomear
  as duas relações e o total saiu da tela por ser derivável; a composição de cada
  número está documentada no comentário de bloco do próprio `funnel-tab.tsx`,
  que é onde alguém vai procurar. Se um número novo entrar nessa linha, ele
  precisa dizer de que conjunto sai.
  A coluna "Preencher detalhes" (`aguardando_dados`) só renderiza quando tem
  cotação: coluna vazia lê como pendência permanente. O seed do protótipo
  popula as **três** colunas de propósito (`scripts/seed_prototype.py`, q7-q9,
  com asserção no e2e) — sem isso a demo mostrava só duas e a etapa sumia.
- **Histórico** (`components/history-tab.tsx` + `history-item.tsx`): lista, nunca
  kanban — nada aqui se move nem pode ser aprovado/reprovado. Filtra por situação
  e por período de fechamento, ordena por data de fechamento desc.
- **Toolbar** (`components/portal-filters.tsx`): busca só como ícone de lupa
  (`PortalSearchInput`) + `Filtros` num popover compacto (`PortalFiltersMenu`).
  `applyPortalFilters` continua sendo a única implementação do filtro — a busca
  por referência/produto entra nela como `query`.
- **Largura das colunas** (`components/kanban-column.tsx`): elástica
  (`flex-1`, base 0), entre `min-w-80` e `max-w-[34rem]`. O piso é legibilidade
  do card e é ele que devolve a rolagem horizontal do TRILHO (nunca da página)
  em tela estreita; o teto existe porque o card tem linhas em `justify-between`
  que viram vão interno se a coluna esticar sem limite. Medido: **3 × 363px
  preenchendo os 1120px do container a 1440px** e **3 × 523px preenchendo os
  1600px a 1920px** (sem sobra à direita nas duas), e trilho rolando a 1280px com
  as colunas no piso de 320px. Não volte para largura fixa (`w-80`): era ela que
  deixava o vão à direita em tela larga.
- **Labels do kanban** (`PORTAL_BUCKET_LABELS`): "Preencher detalhes",
  "Aguardando agentes", "Escolha sua proposta" — sempre na perspectiva do
  cliente. É o único lugar onde se renomeia etapa; não escreva label solto na
  coluna.
- **Data de fechamento**: `resolveClosedAt(q)` (`lib/portal-state.ts`) —
  `closed_at` (FECHADA) → `declined_at` (DECLINADA) → `updated_at` →
  `created_at`. CANCELADO não grava nenhum dos dois no state machine, daí o
  fallback. Os dois campos foram adicionados ao serializer do portal
  (`shared/portal_helpers.py` no backend).

### Conferência de dados da cotação (aba Histórico) e `/portal/auditoria`

O comparativo **valor cotado × valor de fechamento** com badge de divergência é
conferência da própria cotação, **não** o produto de Auditoria de Frete/Fatura.
Por isso ele mora dentro do item de cotação fechada no Histórico (expansão
"Conferência de dados: sem divergência / divergência encontrada"), junto do envio
de documentação (`components/audit-document-modal.tsx`) e do status da jornada
(`lib/audit-journey.ts`). `AuditResult` vive em `app/portal/_shared/` porque é
compartilhado com `AuditPreviewSection` no detalhe da cotação.

Usa `useAuditPreviews(ids)` (`hooks/use-portal-audit-preview.ts`), fan-out do
**mesmo** endpoint por cotação `GET /portal/quotations/{id}/audit-preview` sobre
cada FECHADA — um GET por id, cada um com `try/catch` para um 409 isolado
(fechada sem proposta vencedora) virar `null` naquele item ("conferência
indisponível") em vez de derrubar o lote. Chave SWR
`['portal-audit-previews', ...ids]` sobre **todas** as fechadas, não as
filtradas, para filtrar não refazer fetch. **Sem endpoint novo:** os números
batem exatamente com o detalhe de cada cotação.

Honestidade: só `quoted_value_brl` é real (proposta aprovada); `valor estimado`,
`diferença` e `divergência` são os campos `mock_*` fabricados deterministicamente
no backend (`app/audit_preview.py`), então a expansão inteira fica na moldura
tracejada com o selo `preview`.

### Auditoria (`/portal/auditoria/`) — três camadas, tela inteira conceitual

Planejado (cotação) × realizado (NF final), depois que o embarque chega. **Não**
traga para cá o comparativo cotado × fechamento da cotação — é outro produto (ver
seção acima).

| Camada | Onde | O que é |
|---|---|---|
| 1 — Conciliação determinística | `components/conciliation-list.tsx` (resumo) → `conciliation-table.tsx` (detalhe) + `lib/conciliation.ts` | Lista compacta por embarque (referência · rota · badge de desfecho · "Ver detalhe") que abre a tabela Item · Planejado · Realizado · Diferença · Bate/Diverge |
| 2 — Árvore de decisão | `evaluateLine` em `lib/conciliation.ts` | `if/else` sobre `DIVERGENCE_THRESHOLD_PCT` (5%, espelha `app/audit_preview.py`) → "Sugerimos contestar" quando a diferença é **para cima**. **Não é IA** |
| 3 — Rascunho de contestação | `components/dispute-draft-modal.tsx` + `lib/dispute-draft.ts` | Para/Assunto/corpo por **template determinístico** (interpolação de string). Editar · Anexar · Enviar |

A tela inteira é conceitual (banner de topo + badge `preview`) por **limitação de
schema**, não por escopo — e é isso que a mantém honesta:

- **Gatilho inexistente**: `EmbarqueState`
  (`shared/database/models/shipment/enums.py`) termina em `embarcado`
  (=partida). Não há estado de chegada confirmada nem data de chegada
  (`Processo.datas` fica NULL), então o card "Quando a auditoria dispara" mostra
  **0 embarques elegíveis** com badge `pending`. Não apelide `embarcado` de
  chegada.
- **Realizado inexistente**: não há model de NF/fatura/invoice no schema.

Por isso os embarques da tabela são **exemplos fictícios** (`CONCILIATION_EXAMPLES`,
prefixo `EXEMPLO-`), nunca a referência de um embarque real do cliente com
números fabricados pendurados. Quando o Tracking marcar a chegada e a NF final
entrar no schema, muda só a **fonte** das linhas — conciliação, árvore de decisão
e template seguem válidos.

Os cinco exemplos existem para cobrir **todos** os desfechos de `evaluateLine`,
não para encher a tela: fechamento limpo (0002), diferença real abaixo do limite
(0004 → "Bate" apesar de ≠ 0), divergência para baixo (0005 → "Diverge" **sem**
botão de contestar) e divergência para cima (0001, 0003 → "Sugerimos contestar").
Ao mexer nos números, mantenha os quatro casos representados — sem 0004 e 0005 a
tela não mostra a diferença entre "diferente" e "contestável".

O modal **não envia** nada (não há destinatário nem serviço de contestação): o
botão Enviar encerra dizendo exatamente isso, e anexo fica local. Não troque por
uma confirmação que sugira envio.

**"Causas mais comuns de divergência"** (`components/divergence-causes-block.tsx`
+ `computeDivergenceCauses` em `lib/conciliation.ts`, unit-testada) abre a
Camada 1, acima da lista. Responde o que a lista não responde: a lista diz QUAIS
embarques divergiram, a barra diz O QUE costuma divergir — a diferença entre
conferir um fechamento e negociar a próxima cotação. Três regras:

- **Denominador = linhas divergentes, não embarques.** As fatias somam 100% e as
  barras são comparáveis entre si. Contar embarques faria um embarque com três
  itens divergentes valer o mesmo que um com um só.
- **A função não conhece os itens.** Nada nela cita "Frete/THC/Prazo" nem
  `CONCILIATION_EXAMPLES`: recebe os exemplos por argumento e reusa
  `evaluateLine`. Quando a fonte virar NF final, troca-se o argumento e item novo
  ("Sobrestadia") entra sozinho no ranking.
- **Selo `preview`, não `pending`**, e a nota de rodapé explica: o cálculo é real,
  o volume é ilustrativo, porque roda sobre os exemplos EXEMPLO-. Mesma categoria
  do que ela resume — vira `real` junto com a lista, sem tocar no cálculo.

A Camada 1 é **resumo → detalhe**, o mesmo padrão de Meus Embarques > Lista: a
lista compacta responde "algum embarque divergiu?" e o "Ver detalhe" abre a
tabela item a item de UM embarque. As cinco tabelas já ficaram abertas ao mesmo
tempo e a leitura de desfecho sumia atrás de ~20 linhas de item — não volte
àquilo. O badge de desfecho é `components/divergence-badge.tsx`, **um só**
componente para a lista e o cabeçalho do detalhe: dois desenhos independentes
poderiam discordar sobre a mesma contagem. Nada disso muda o status conceitual —
banner "Conceitual" e selos `preview` seguem intactos.

### Minhas Preferências (`/portal/preferencias/`) — três abas

A área de conta do portal, e desde 26/08/2026 o único item de configuração da
sidebar. Três abas, no padrão de `inteligencia/layout.tsx` (faixa de links
`border-b`, item ativo por `pathname === href`) — **não invente um terceiro
padrão de navegação**:

| Aba | Rota | Arquivo |
|---|---|---|
| Perfil e notificações | `/portal/preferencias` | `preferencias/page.tsx` |
| Meus Exportadores | `/portal/preferencias/exportadores` | `preferencias/exportadores/page.tsx` |
| Meus Agentes | `/portal/preferencias/agentes` | `preferencias/agentes/page.tsx` |

- **As duas últimas eram itens de primeiro nível da sidebar** e desceram para cá
  porque são telas de CADASTRO/CONFIGURAÇÃO — no nível de cima se misturavam com
  as operacionais. Nada do conteúdo mudou na mudança: cada página continua com o
  próprio `PagePortalHeader`, como as abas de Inteligência fazem.
- **As rotas antigas continuam existindo como redirect** (`portal/exportadores/`
  e `portal/agentes/` viraram `page.tsx` de uma linha com `redirect()`, mesmo
  padrão de `inteligencia/page.tsx`). São para links diretos e favoritos; não as
  remova sem saber que ninguém mais chega por ali.
- **Exportador e agente são papéis distintos** e ficam lado a lado de propósito:
  o exportador fabrica e embarca a carga, o agente move o frete. Foi por
  confundir os dois que o dashboard de Inteligência deixou de se chamar
  "Fornecedores".

`preferencias/exportadores/page.tsx` — os exportadores que o próprio cliente
cadastra (`useMyExporters()`), disponíveis para vincular numa nova cotação. É a
única tela de cadastro de verdade do portal: agente o cliente só seleciona.

`preferencias/agentes/page.tsx` — os agentes que a Freitas pré-aprovou, via `useMyAgents()`
(`hooks/use-portal-agents.ts` → `GET /portal/agents`). Três regras:

- **O cliente não cadastra agente**, seleciona entre os pré-aprovados. O CTA
  "Solicitar novo agente" (`preferencias/agentes/components/request-agent-modal.tsx`)
  é PEDIDO: não existe fila de avaliação neste repo, então o botão de envio
  encerra dizendo que nada foi enviado — mesmo contrato do `dispute-draft-modal`
  da Auditoria.
- **O toggle ativo/pausado não é decorativo**: `setAgentActive` grava em
  `PUT /portal/preferences` e o backend (`app/agent_pause.py`) tira o agente
  pausado da montagem da RFQ. Vale para as **próximas** cotações — RFQ já
  montada não perde a seleção que o cliente fez antes.
- **O indicador de plano mostra o número real de ativos e só o LIMITE leva o
  selo** `pending`: `plan_limit`/`plan_name` vêm sempre nulos porque não há
  modelo de planos no schema. Não faça fallback para uma constante ("10", "Plano
  Free") — seria o único número inventado da tela.

`preferencias/page.tsx` — dois blocos com estatutos diferentes, e a tela mostra
isso:

- **Notificações** (sem selo, real): as mesmas quatro chaves da aba Alertas,
  lidas de `_shared/alert-type-preferences.ts`. Esse módulo é a **única**
  implementação da leitura/escrita da preferência; as duas telas o usam, porque
  duas cópias divergiriam no primeiro tipo novo de alerta e o cliente veria um
  switch ligado numa tela e desligado na outra. Continua em localStorage: o feed
  é montado no frontend e não há disparo de e-mail/push por trás.
- **Perfil de operação (DNA)** (moldura tracejada + selo `preview` no bloco
  inteiro): as escolhas são gravadas de verdade (migração 094), mas ainda não
  realimentam a cotação. É a **única** vez no portal em que `preview` não marca
  número fabricado — marca um bloco funcional cujo efeito a jusante não existe.
  O parágrafo do bloco é quem sustenta o selo; não o apague ao mexer no layout.
  Contatos internos, acordos comerciais e restrições contratuais **não** entram
  aqui (o backend nem aceita esses campos).
- "Agentes bloqueados" é a **mesma lista** do toggle de Meus Agentes (uma coluna
  só) e por isso leva selo `real` próprio dentro do bloco `preview`: bloquear
  ali tem efeito imediato na RFQ, e não pode parecer ensaio.

`preferencias/lib/operation-options.ts` guarda as opções de porto e incoterm.
São listas de **conveniência**, não catálogo — o backend grava texto livre e não
valida contra elas. Acrescentar item é seguro; remover um que algum cliente já
salvou some com o valor da tela (o dado continua no banco).

## Quotation field utilities — `utils/quotation-fields.ts`

All shared logic for quotation field handling lives in `utils/quotation-fields.ts`. **Do not duplicate any of this in component or page files.**

| Export | Purpose |
|--------|---------|
| `quotationToFieldValues(q)` | Converts a `Quotation` API response to the flat `QuotationFieldValues` shape used by the form and grid. Single source of truth — both `nova-cotacao/page.tsx` and `[id]/page.tsx` import from here. |
| `toDatetimeLocal(iso)` | Converts an ISO datetime string to `datetime-local` input format. |
| `boolStr(v)` | Converts a nullable boolean to `''` / `'true'` / `'false'` (Select-compatible). |
| `getFieldVisibility(ctx)` | Returns all conditional-display flags for quotation fields based on `modal`, `tipo_embarque`, `carga_perigosa`, `incluir_entrega_destino_final`, and temperature values. |

### `getFieldVisibility` — invariant

**Every component that conditionally shows or hides a quotation field must derive that flag from `getFieldVisibility`.** Never compute visibility conditions inline in a component.

```typescript
// correct
const { isMaritime, showPorto, showTemperatura, ... } = getFieldVisibility(values);

// wrong — duplicates logic, will drift from the other component
const isMaritime = values.modal === 'MARITIMO';
```

The function accepts a `FieldVisibilityContext` (only the fields relevant to visibility — no need to pass the full `QuotationFieldValues`). It handles both string and boolean forms of `incluir_entrega_destino_final` so the same function works from the form (react-hook-form) and from the grid (`QuotationFieldValues`).

**Adding a new conditional field:** add the flag to `getFieldVisibility` and `FieldVisibility`, then use it in the relevant components. No inline condition in the component.

### `ExtractionResultsGrid` — shared between `nova-cotacao` and `[id]`

`app/cotacao/nova-cotacao/components/extraction-results-grid.tsx` is the single grid component used in both pages. It accepts:

- `values: QuotationFieldValues` — editable flat state
- `onChange` — field update handler
- `readOnly?` — disables all inputs (used in `[id]` when state is locked)
- `confidenceScores?` — AI extraction confidence per field
- `quotation?: Quotation` — pass the full quotation object to display equipment and volume line items

Always pass `quotation={...}` when rendering the grid so equipment/volume tables appear. The `Quotation` type includes `equipments?: QuotationEquipment[]` and `volumes?: QuotationVolume[]`, populated by both `GET /quotations/{id}` and `POST /quotations`.

## Forms

- Use react-hook-form with zod resolver for all forms with validation.
- Define zod schema adjacent to the form component.
- For simple forms without complex validation, controlled state with `useState` is acceptable.

## Environment variables

| Variable | Usage |
|----------|-------|
| `NEXT_PUBLIC_API` | AWS API Gateway base URL (used by `base_api`) |

No other env vars exist. All runtime config flows through this single variable.

## Code standards

- All code, comments, and commit messages in **English**.
- No emojis anywhere in the codebase.
- Comments only when logic is non-obvious — prefer self-documenting names.
- All imports at the **top of the file**, never mid-component.
- Explicit error handling in every mutation — no silent failures, no bare `catch {}`.
- Single-responsibility hooks; hooks fetch and mutate, components render.
- DRY: reuse existing hooks and helpers before adding new ones. Check `hooks/` before writing a new fetcher.
