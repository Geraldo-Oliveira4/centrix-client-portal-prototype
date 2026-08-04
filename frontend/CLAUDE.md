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

**Colour** — actions and links stay on the brand pink (`--primary`). The semantic
palette is for STATE only and never for actions:

| Token | Hex | Meaning |
|---|---|---|
| `portal-success` | `#00B050` | done / approved |
| `portal-warning` | `#FF9500` | waiting / attention |
| `portal-danger` | `#FF3B30` | critical / divergent |
| `portal-info` | `#2E5CFF` | in progress, nothing required from the client |
| `portal-neutral` | `#8E8E93` | secondary metadata |

State→colour maps live next to their type (`ESTADO_BADGE_CLASS` /
`ESTADO_ACCENT_CLASS` in `types/portal-shipment.ts`) so the badge, the summary
tile and the progress steps cannot drift apart.

**Shared components on a portal surface** — do not fork them. `RecommendationView`
takes `variant="portal"`, which swaps only its shell and header for
`.portal-card` + `.portal-h2`; the analyst and public-proposal surfaces keep the
default. Follow that pattern for any other shared component that has to sit on a
portal screen.

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
  native TS stripping; the file is excluded from tsconfig). Components render
  what the function returns — never re-implement the threshold in JSX.
- **The number IS shown** next to the colour, unlike the AI score: this is
  arithmetic over two carrier-published dates, reproducible by the client, not a
  model estimate.
- **Demo data wears the seal.** `tracking.is_mock` (backend migration 092) marks
  a shipment whose tracking was fabricated by
  `backend/scripts/topup_tracking_demo.py` so the prototype can show all three
  visual paths. Every surface that renders a tracking value must check it and
  draw `ProvenanceBadge preview` — today the list card, the detail summary and
  the "Acompanhamento" section do. Never render a tracking value without that
  check, and never seal a value whose `is_mock` is false.
- **Downstream steps move only from `tracking.last_milestone`** (ShipsGo:
  `OCEAN_TRANSIT` | `ARRIVAL` | `DISCHARGE` | `AVAILABLE`). The rule lives in
  `lib/timeline-steps.ts` (`buildTimelineSteps`, unit-tested) — steps before the
  milestone are done, the milestone is the current stage, and nothing past it is
  claimed. `ShipmentTimeline` is presentational over that helper; do not put
  step logic back in the component.
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

**Spacing** — 8px grid: `gap-1` (4) / `gap-2` (8, default) / `gap-4` (16, between
sections) / `p-6` (24, card padding) / `space-y-8` (32, between page blocks).
Do not introduce `p-3`, `gap-3`, `space-y-5` or other off-grid steps in `/portal`.

**Icons** — outline (lucide), `h-5 w-5` (20px), always paired with a label.

> Class names composed in `types/` are only picked up because
> `./types/**/*.{ts,tsx}` is in the Tailwind `content` globs. Keep it there.

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
`Scale` → Auditoria).

### Inteligência (`/portal/inteligencia/`)

**Três** dashboards, nada mais: `performance/`, `fornecedores/`, `executivo/`
(tabs em `layout.tsx`). A raiz `/portal/inteligencia` é só um `redirect()` para
`performance` — a antiga aba "Visão geral" **foi fundida** no Performance, porque
"estou indo bem ou não?" só se responde cruzando cotação e embarque na mesma
tela. Não recrie uma quarta aba de visão geral.

`performance/page.tsx` tem três níveis de peso, e só três:

1. **Par dominante**: "Taxa de aprovação" (real) + "On-time rate" (badge
   `pending` — sem ETA/histórico de embarque, nunca um número fabricado).
2. **Apoio** (`StatNumber size="compact"`): Cotações (30 dias), Tempo médio de
   resposta, Embarques (30 dias), Embarques em andamento.
3. **Visualizações** (`performance/components/`): `agent-wins-block`,
   `status-donut-block`, `weekly-volume-chart`, `savings-block`.

Duas regras que mantêm a tela coerente depois da fusão: as duas métricas de
volume usam a **mesma janela de 30 dias** (senão "volume" significa duas coisas
na mesma tela), e o **total histórico de cotações aparece uma única vez**, no
centro do donut — por isso o nível 2 mostra "Cotações (30 dias)", não o total.

`fornecedores/page.tsx` é um **ranking ilustrativo** (painel inteiro na moldura
tracejada + badge `preview`), montado por `lib/supplier-helpers.ts` sobre
`useMyQuotations` — sem endpoint novo. **Real:** nome do agente, quantas
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
e de embarques (por `created_at`), taxa de aprovação (fechadas /
fechadas+recusadas), tempo médio de resposta (`created_at` →
`best_proposal.received_at`), embarques em andamento, cotações vencidas por
agente (vencedor de cada FECHADA), cotações por status.
**Ilustrativo** (badge `preview`, moldura tracejada): "Economia estimada" =
`Σ(fechadas.total_brl) × 0.08`, mesmo fator de benchmark do MarketBlock — não há
base de preços de mercado neste protótipo.

Cada bloco continua auto-fetchando via SWR (deduped por key), embrulhado em
`IntelBlock` (`components/intel-block.tsx`: `.portal-card` para `real`, moldura
tracejada para `preview`, + `ProvenanceBadge` + footnote). Helpers puros em
`lib/intel-helpers.ts` e `lib/performance-helpers.ts`. Mantenha os blocos
presentacionais; lógica nos helpers.

Distribuição dos blocos (o `provenance` de cada um **não muda** com o local):

| Bloco (arquivo) | Onde vive agora | Badge | Real vs Mockado |
|---|---|---|---|
| Decisão (`decision-block.tsx`) | **Coberta** pelo painel "Recomendação por IA" (`recommendation-panel.tsx`) no detalhe da cotação — o bloco não é mais renderizado (arquivo mantido) | `real` | **Real:** recomendação por IA (score determinístico) |
| Confiabilidade (`reliability-block.tsx`) | Detalhe da cotação, painel ao lado das propostas | `preview` | **Real:** nomes dos agentes. **Mock:** scores + média (`seededInt`) |
| Mercado (`market-block.tsx`) | Detalhe da cotação, painel ao lado das propostas | `preview` | **Real:** seu preço médio. **Mock:** benchmark do setor (`avg × 1.08`) |
| Evidência (`evidence-block.tsx`) | Detalhe da cotação, painel ao lado das propostas ("embarques semelhantes") | `real` | **Real:** cards de embarques do histórico. **Mock:** critério de semelhança de rota |
| Risco (`risk-block.tsx`) | Detalhe da cotação, junto da seção Auditoria (só FECHADA) | `preview` | **Real:** sinais de campos reais + refs. **Mock:** a "análise de risco" consolidada |
| Prazo (`deadline-block.tsx`) | **Removido** de `/portal/embarques` (a aba Mapa não tem cards; o "Prazo 87%" não tinha lastro). Arquivo mantido, sem uso — candidato a remoção | `preview` | **Real:** contagem de embarques. **Mock:** % no prazo (constante 87%) |

Ao mexer num bloco, mantenha o `provenance` coerente com o **headline**: se o
número em destaque é fabricado, o bloco é `preview` (mesmo que use nomes/valores
reais em volta) e a footnote deve dizer o que é real e o que é ilustrativo.

### Minhas Cotações — Funil e Histórico (`/portal/cotacoes/`)

Duas abas, uma pergunta cada. **Funil** = cotação em andamento; **Histórico** =
cotação fechada, só leitura. Nenhuma coluna de cotação fechada no kanban, nenhum
número repetido entre topo e colunas.

- **Funil** (`components/funnel-tab.tsx`): um único número dominante —
  "X cotações aguardando sua ação" = soma de `PORTAL_CLIENT_ACTION_BUCKETS`
  (`aguardando_aprovacao` + `aguardando_dados`, definido em `types/portal.ts`) —
  com "N no total · N ativas" em texto secundário. As contagens por etapa já
  estão nas colunas; **não** reintroduza tiles de KPI nem cards de atalho por
  bucket (havia cinco tiles + dois cards dizendo o mesmo que o kanban).
  A coluna "Preencher detalhes" (`aguardando_dados`) só renderiza quando tem
  cotação: coluna vazia lê como pendência permanente. O seed do protótipo
  popula as **três** colunas de propósito (`scripts/seed_prototype.py`, q7-q9,
  com asserção no e2e) — sem isso a demo mostrava só duas e a etapa sumia.
- **Histórico** (`components/history-tab.tsx` + `history-item.tsx`): lista, nunca
  kanban — nada aqui se move nem pode ser aprovado/recusado. Filtra por situação
  e por período de fechamento, ordena por data de fechamento desc.
- **Toolbar** (`components/portal-filters.tsx`): busca só como ícone de lupa
  (`PortalSearchInput`) + `Filtros` num popover compacto (`PortalFiltersMenu`).
  `applyPortalFilters` continua sendo a única implementação do filtro — a busca
  por referência/produto entra nela como `query`.
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
| 1 — Conciliação determinística | `components/conciliation-table.tsx` + `lib/conciliation.ts` | Tabela por embarque: Item · Planejado · Realizado · Diferença · Bate/Diverge |
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
