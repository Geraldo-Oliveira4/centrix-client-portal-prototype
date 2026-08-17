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
takes `variant="portal"`, which swaps only its shell and header for
`.portal-card` + `.portal-h2`; the analyst and public-proposal surfaces keep the
default. Follow that pattern for any other shared component that has to sit on a
portal screen.

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

**Filtros rápidos de Meus Embarques > Lista** (chips acima da lista): predicados
sobre o dado que a Lista já tem — Urgentes (`carga_urgente`), Embarcados
(`estado`), Com atraso (`delayRiskFromTracking`, a mesma função do badge) e Com
exceção (`isExceptionState`). Chip com contagem zero não é renderizado. O chip é
"**Embarcados**", não "Em trânsito": `embarcado` é o estado real do GE e
significa PARTIDA, enquanto "Em trânsito" é o milestone `OCEAN_TRANSIT` do
ShipsGo, que segue "Pendente integração" — um chip com aquele nome selecionaria
embarques cuja própria timeline diz que o trânsito é desconhecido.

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
  draw `ProvenanceBadge preview` — today the list card, the detail summary and
  the "Acompanhamento" section do. Never render a tracking value without that
  check, and never seal a value whose `is_mock` is false.
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

**Aba Alertas — quatro tipos, e o quarto não é como os outros.** O feed é
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
versionada (`portal:shipment-alerts:types:v2`, em
`_shared/alert-type-preferences.ts`) porque uma lista salva antes deste tipo
existir o deixaria desligado sem o cliente saber. Bump de novo se um tipo futuro
não puder herdar opt-out antigo. Esse módulo é a **única** implementação da
preferência: a aba Alertas e Minhas Preferências > Notificações editam a mesma
coisa e o consomem juntas — não releia o localStorage numa terceira tela.

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

- **"Mapa = visão geográfica, sem filtro/busca/card solto" continua valendo.** As
  duas colunas são leitura; nenhuma recorta o mapa. Abaixo de `xl` elas empilham
  (resumo → mapa → eventos), que é o padrão do portal — abas dentro de aba seria
  navegação que nenhuma outra tela usa.
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

### Acompanhamento: eixo HORIZONTAL em três níveis (14/08/2026)

Revisão semanal com Victor Orsi e Vinicius: a timeline vertical mostrava as nove
etapas com o mesmo peso e não respondia "onde meu embarque está agora". O
conteúdo não mudou (os textos descritivos de cada etapa continuam todos lá); a
apresentação passou a ter hierarquia, e são três níveis, nesta ordem:

1. **Ação necessária** — o que depende do CLIENTE, em faixa destacada
   (`portal-warning`), nunca dentro de accordion. É a única coisa da tela que
   ele pode mudar.
2. **Etapa atual dominante + próxima etapa secundária**, com risco e
   justificativa por extenso.
3. **O eixo horizontal** com as nove etapas, que rola no eixo x e **abre
   centrado na etapa atual** (`scrollLeft` do trilho, nunca da página). Os véus
   de esmaecimento nas pontas só aparecem quando existe conteúdo escondido
   daquele lado — véu fixo apagava a primeira letra de "Solicitado" num eixo que
   nem rolou.

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
`Scale` → Auditoria). Meus Agentes (`Users`) e Minhas Preferências (`Settings`)
moram lá também, mas **não** são read-only: são as duas únicas telas de conta
que escrevem no backend (ver a seção delas adiante).

Uma nota sobre o `preview` que vale para todo o portal: ele marca **número
fabricado**. A única exceção documentada é o bloco "Perfil de operação" de
Minhas Preferências, onde o selo marca um bloco funcional cujo efeito a jusante
ainda não existe — e a exceção só se sustenta porque o texto do bloco explica
isso. Não abra uma segunda.

### Inteligência (`/portal/inteligencia/`)

**Três** dashboards, nada mais: `performance/`, `agentes/`, `executivo/`
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
e de embarques (por `created_at`), taxa de aprovação (fechadas /
fechadas+recusadas), tempo médio de resposta (`created_at` →
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
| Decisão (`decision-block.tsx`) | **Coberta** pelo painel "Recomendação por IA" (`recommendation-panel.tsx`) no detalhe da cotação — o bloco não é mais renderizado (arquivo mantido) | `real` | **Real:** recomendação por IA (score determinístico) |
| Confiabilidade (`reliability-block.tsx`) | Detalhe da cotação, painel ao lado das propostas | `preview` | **Real:** nomes dos agentes. **Mock:** scores + média (`seededInt`) |
| Mercado (`market-block.tsx`) | Detalhe da cotação, painel ao lado das propostas | `preview` | **Real:** seu preço médio. **Mock:** benchmark do setor (`avg × 1.08`) |
| Evidência (`evidence-block.tsx`) | Detalhe da cotação, painel ao lado das propostas ("embarques semelhantes") | `real` | **Real:** cards de embarques do histórico. **Mock:** critério de semelhança de rota |
| Risco (`risk-block.tsx`) | Detalhe da cotação, junto da seção Auditoria (só FECHADA) | `preview` | **Real:** sinais de campos reais + refs. **Mock:** a "análise de risco" consolidada |
| Prazo (`deadline-block.tsx`) | **Removido** de `/portal/embarques` (o "Prazo 87%" não tinha lastro; o resumo da aba Mapa mostra contagem real, não percentual inventado). Arquivo mantido, sem uso — candidato a remoção | `preview` | **Real:** contagem de embarques. **Mock:** % no prazo (constante 87%) |

Ao mexer num bloco, mantenha o `provenance` coerente com o **headline**: se o
número em destaque é fabricado, o bloco é `preview` (mesmo que use nomes/valores
reais em volta) e a footnote deve dizer o que é real e o que é ilustrativo.

### Minhas Cotações — Funil, Histórico, Fechadas e Negadas (`/portal/cotacoes/`)

Quatro abas, nesta ordem. **Funil** = cotação em andamento; **Histórico** =
cotação fechada, só leitura. Nenhuma coluna de cotação fechada no kanban, nenhum
número repetido entre topo e colunas.

**Fechadas** (FECHADA) e **Negadas** (DECLINADA + CANCELADO) são **recortes** do
Histórico, não telas novas: renderizam o MESMO `HistoryTab`, com a prop
`outcomes` fixando o escopo. Três regras:

- O Histórico continua mostrando as três situações juntas — as abas focadas são
  atalho, não substituição. Não remova a aba nem o seletor "Situação" dela.
- Numa aba com `outcomes`, o seletor "Situação" **some**. Dois controles capazes
  de discordar deixariam a aba "Fechadas" mostrar uma cotação cancelada.
- Nada é duplicado: a expansão "Conferência de dados", o `useAuditPreviews` e o
  modal de documentos são os mesmos, então uma mudança de layout de linha cai
  nas três abas de uma vez.

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

### Meus Agentes (`/portal/agentes/`) e Minhas Preferências (`/portal/preferencias/`)

Duas telas de conta, ao lado de Meus Exportadores na sidebar. **Exportador e
agente são papéis distintos** e ficam separados de propósito: o exportador
fabrica e embarca a carga, o agente move o frete.

`agentes/page.tsx` — os agentes que a Freitas pré-aprovou, via `useMyAgents()`
(`hooks/use-portal-agents.ts` → `GET /portal/agents`). Três regras:

- **O cliente não cadastra agente**, seleciona entre os pré-aprovados. O CTA
  "Solicitar novo agente" (`components/request-agent-modal.tsx`) é PEDIDO: não
  existe fila de avaliação neste repo, então o botão de envio encerra dizendo
  que nada foi enviado — mesmo contrato do `dispute-draft-modal` da Auditoria.
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
