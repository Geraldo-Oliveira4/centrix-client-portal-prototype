// Gestão de acessos SIMULADA (Prompt 3, 01/10/2026). Puro: roda sob `node --test`.
//
// O QUE ISTO NÃO É. Não é controle de acesso. As empresas, os convites e as
// exceções de módulo moram no `localStorage` deste navegador; nada impede uma
// chamada à API de um módulo "desligado". No produto real a flag fica no
// servidor, por cliente, e o backend recusa a chamada — ver HANDOFF-BACKEND.md.
// Aqui a tela só esconde.
//
// TRÊS PEÇAS, cada uma com uma regra só:
//   - convite: máquina de estados (união da spec 03 com o Prompt 3);
//   - módulos: padrão global (as flags que o painel já edita) + exceção por
//     empresa; "ver como" usa a resolução das duas;
//   - registro: toda mudança vira uma linha, mais recente primeiro.

import {
  PORTAL_MODULES,
  flagsForWave,
  type PortalModule,
  type PortalModuleFlags,
  type PortalWaveId,
} from './feature-flags.ts';

export const ACCESS_STORE_NAME = 'access-management';
export const VIEWING_AS_STORE_NAME = 'viewing-as';

/** Quem o protótipo diz que fez a alteração. Não há login da Freitas aqui. */
export const ACCESS_ACTOR = 'Analista Freitas (simulado)';

/**
 * Logins que já existem fora desta lista de empresas. A unicidade de e-mail é
 * GLOBAL entre os pools de login: um e-mail não pode ser contato de duas
 * empresas, nem repetir o usuário demo do portal ou um analista.
 */
export const RESERVED_LOGIN_EMAILS = [
  'demo@cliente.local',
  'analista@freitas-demo.example',
];

export type ClientKind = 'freitas' | 'saas';

export const CLIENT_KIND_LABELS: Record<ClientKind, string> = {
  freitas: 'Cliente Freitas',
  saas: 'SaaS puro',
};

export type WaveNumber = 0 | 1 | 2 | 3;
export const WAVE_NUMBERS: WaveNumber[] = [0, 1, 2, 3];
export const WAVE_ID: Record<WaveNumber, PortalWaveId> = {
  0: 'onda0',
  1: 'onda1',
  2: 'onda2',
  3: 'onda3',
};

// ---------------------------------------------------------------- convite --

/**
 * Caminho principal + dois estados laterais. A spec 03 tinha "Autorizado ->
 * Convite enviado -> Cadastrado -> Ativo"; o Prompt 3 pediu "Não convidado ->
 * Convite enviado -> Expirado -> Ativo -> Bloqueado". Decisão de 01/10/2026: a
 * UNIÃO — "Cadastrado" (criou a senha, ainda não entrou) fica no caminho, e
 * "Expirado" e "Bloqueado" saem dele de lado.
 */
export type InviteStatus =
  | 'nao_convidado'
  | 'convite_enviado'
  | 'cadastrado'
  | 'ativo'
  | 'expirado'
  | 'bloqueado';

export const INVITE_MAIN_PATH: InviteStatus[] = [
  'nao_convidado',
  'convite_enviado',
  'cadastrado',
  'ativo',
];

export const INVITE_STATUS_LABELS: Record<InviteStatus, string> = {
  nao_convidado: 'Não convidado',
  convite_enviado: 'Convite enviado',
  cadastrado: 'Cadastrado',
  ativo: 'Ativo',
  expirado: 'Expirado',
  bloqueado: 'Bloqueado',
};

/** Validade do convite. Premissa do protótipo, não decisão. */
export const INVITE_TTL_DAYS = 7;

export type InviteAction =
  | 'enviar'
  | 'reenviar'
  | 'revogar'
  | 'simular_cadastro'
  | 'simular_primeiro_acesso'
  | 'simular_expiracao'
  | 'bloquear'
  | 'desbloquear';

export const INVITE_ACTION_LABELS: Record<InviteAction, string> = {
  enviar: 'Enviar convite',
  reenviar: 'Reenviar convite',
  revogar: 'Revogar convite',
  simular_cadastro: 'Simular cadastro',
  simular_primeiro_acesso: 'Simular primeiro acesso',
  simular_expiracao: 'Simular expiração',
  bloquear: 'Bloquear',
  desbloquear: 'Desbloquear',
};

export interface AccessContact {
  id: string;
  name: string;
  email: string;
  status: InviteStatus;
  invitedAt: string | null;
  expiresAt: string | null;
  registeredAt: string | null;
  activeSince: string | null;
  blockedAt: string | null;
  /** Para onde o desbloqueio devolve. */
  statusBeforeBlock: InviteStatus | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** O status que a tela mostra: convite vencido é "Expirado" sem ninguém mexer. */
export function effectiveInviteStatus(
  contact: AccessContact,
  now: Date,
): InviteStatus {
  if (
    contact.status === 'convite_enviado' &&
    contact.expiresAt &&
    new Date(contact.expiresAt).getTime() <= now.getTime()
  ) {
    return 'expirado';
  }
  return contact.status;
}

/** O que dá para fazer a partir do status que a tela mostra. */
export function allowedInviteActions(
  contact: AccessContact,
  now: Date,
): InviteAction[] {
  switch (effectiveInviteStatus(contact, now)) {
    case 'nao_convidado':
      return ['enviar', 'bloquear'];
    case 'convite_enviado':
      return ['reenviar', 'revogar', 'simular_cadastro', 'simular_expiracao', 'bloquear'];
    case 'expirado':
      return ['reenviar', 'revogar', 'bloquear'];
    case 'cadastrado':
      return ['simular_primeiro_acesso', 'bloquear'];
    case 'ativo':
      return ['bloquear'];
    case 'bloqueado':
      return ['desbloquear'];
  }
}

export interface InviteResult {
  ok: boolean;
  contact: AccessContact;
  from: InviteStatus;
  to: InviteStatus;
  error?: string;
}

export function applyInviteAction(
  contact: AccessContact,
  action: InviteAction,
  now: Date,
): InviteResult {
  const from = effectiveInviteStatus(contact, now);
  if (!allowedInviteActions(contact, now).includes(action)) {
    return {
      ok: false,
      contact,
      from,
      to: from,
      error: `"${INVITE_ACTION_LABELS[action]}" não vale para quem está em "${INVITE_STATUS_LABELS[from]}".`,
    };
  }
  const at = now.toISOString();
  const next: AccessContact = { ...contact };
  switch (action) {
    case 'enviar':
    case 'reenviar':
      next.status = 'convite_enviado';
      next.invitedAt = at;
      next.expiresAt = new Date(now.getTime() + INVITE_TTL_DAYS * DAY_MS).toISOString();
      break;
    case 'revogar':
      next.status = 'nao_convidado';
      next.invitedAt = null;
      next.expiresAt = null;
      break;
    case 'simular_cadastro':
      next.status = 'cadastrado';
      next.registeredAt = at;
      break;
    case 'simular_primeiro_acesso':
      next.status = 'ativo';
      next.activeSince = at;
      break;
    case 'simular_expiracao':
      next.status = 'convite_enviado';
      next.expiresAt = new Date(now.getTime() - 1000).toISOString();
      break;
    case 'bloquear':
      next.statusBeforeBlock = from;
      next.status = 'bloqueado';
      next.blockedAt = at;
      break;
    case 'desbloquear':
      // Um convite vencido não volta a valer por ter sido bloqueado no meio.
      next.status =
        contact.statusBeforeBlock === 'expirado' || contact.statusBeforeBlock == null
          ? 'nao_convidado'
          : contact.statusBeforeBlock;
      if (next.status === 'nao_convidado') {
        next.invitedAt = null;
        next.expiresAt = null;
      }
      next.statusBeforeBlock = null;
      next.blockedAt = null;
      break;
  }
  return { ok: true, contact: next, from, to: effectiveInviteStatus(next, now) };
}

// ---------------------------------------------------------------- empresa --

export interface AccessCompany {
  id: string;
  name: string;
  /** Fictício, com formato de CNPJ. Nunca um CNPJ real. */
  cnpj: string;
  kind: ClientKind;
  /** A última onda aplicada à empresa, só para filtro e leitura. */
  wave: WaveNumber | null;
  /** Conta de demonstração ou interna: selo na tela, fora de métrica (RQ-9). */
  demo: boolean;
  responsibleId: string | null;
  contacts: AccessContact[];
  /** Só os módulos que fogem do padrão global. Ausente = herda. */
  exceptions: Partial<PortalModuleFlags>;
}

export interface AccessLogEntry {
  id: string;
  at: string;
  actor: string;
  companyId: string;
  companyName: string;
  what: string;
  from: string;
  to: string;
}

export interface AccessState {
  schema: 1;
  companies: AccessCompany[];
  log: AccessLogEntry[];
  seq: number;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/** Todo e-mail em uso, de todas as empresas e dos logins reservados. */
export function emailsInUse(companies: AccessCompany[]): Set<string> {
  const out = new Set(RESERVED_LOGIN_EMAILS.map(normalizeEmail));
  for (const company of companies)
    for (const contact of company.contacts) out.add(normalizeEmail(contact.email));
  return out;
}

export function newContact(id: string, name: string, email: string): AccessContact {
  return {
    id,
    name: name.trim(),
    email: email.trim(),
    status: 'nao_convidado',
    invitedAt: null,
    expiresAt: null,
    registeredAt: null,
    activeSince: null,
    blockedAt: null,
    statusBeforeBlock: null,
  };
}

/** Status agregado da empresa: o mais avançado dos contatos no caminho principal. */
export function companyAccessSummary(
  company: AccessCompany,
  now: Date,
): Record<InviteStatus, number> {
  const out = Object.fromEntries(
    Object.keys(INVITE_STATUS_LABELS).map((key) => [key, 0]),
  ) as Record<InviteStatus, number>;
  for (const contact of company.contacts) out[effectiveInviteStatus(contact, now)]++;
  return out;
}

export interface CompanyFilter {
  /** 'none' = sem onda aplicada. */
  wave: WaveNumber | 'none' | null;
  /** Empresa com ao menos um contato neste status (o que a tela mostra). */
  status: InviteStatus | null;
  demo: 'only' | 'hide' | null;
}

export const EMPTY_COMPANY_FILTER: CompanyFilter = { wave: null, status: null, demo: null };

export function filterCompanies(
  companies: AccessCompany[],
  filter: CompanyFilter,
  now: Date,
): AccessCompany[] {
  return companies.filter((company) => {
    if (filter.wave === 'none' ? company.wave !== null : filter.wave !== null && company.wave !== filter.wave)
      return false;
    if (filter.status && !company.contacts.some((c) => effectiveInviteStatus(c, now) === filter.status))
      return false;
    if (filter.demo === 'only' && !company.demo) return false;
    if (filter.demo === 'hide' && company.demo) return false;
    return true;
  });
}

// --------------------------------------------------------------- módulos --

export function resolveCompanyFlags(
  global: PortalModuleFlags,
  company: AccessCompany,
): PortalModuleFlags {
  const out = { ...global };
  for (const module of PORTAL_MODULES) {
    const value = company.exceptions[module];
    if (typeof value === 'boolean') out[module] = value;
  }
  return out;
}

/** Exceção que de fato difere do padrão. Igual ao padrão não é exceção. */
export function isException(
  global: PortalModuleFlags,
  company: AccessCompany,
  module: PortalModule,
): boolean {
  const value = company.exceptions[module];
  return typeof value === 'boolean' && value !== global[module];
}

export function setCompanyModule(
  company: AccessCompany,
  global: PortalModuleFlags,
  module: PortalModule,
  released: boolean,
): AccessCompany {
  const exceptions = { ...company.exceptions };
  if (released === global[module]) delete exceptions[module];
  else exceptions[module] = released;
  return { ...company, exceptions };
}

export function clearCompanyModule(
  company: AccessCompany,
  module: PortalModule,
): AccessCompany {
  const exceptions = { ...company.exceptions };
  delete exceptions[module];
  return { ...company, exceptions };
}

/** A onda vira exceções: só os módulos em que ela difere do padrão global. */
export function applyWaveToCompany(
  company: AccessCompany,
  global: PortalModuleFlags,
  wave: WaveNumber,
): AccessCompany {
  const target = flagsForWave(WAVE_ID[wave]);
  const exceptions: Partial<PortalModuleFlags> = {};
  for (const module of PORTAL_MODULES)
    if (target[module] !== global[module]) exceptions[module] = target[module];
  return { ...company, wave, exceptions };
}

export interface WavePreview {
  companies: number;
  /** Quantas empresas mudam de fato. */
  changing: number;
  turnOn: PortalModule[];
  turnOff: PortalModule[];
}

/** O que a confirmação precisa dizer antes de aplicar a onda em lote. */
export function previewWave(
  companies: AccessCompany[],
  ids: string[],
  global: PortalModuleFlags,
  wave: WaveNumber,
): WavePreview {
  const chosen = companies.filter((company) => ids.includes(company.id));
  const turnOn = new Set<PortalModule>();
  const turnOff = new Set<PortalModule>();
  let changing = 0;
  for (const company of chosen) {
    const before = resolveCompanyFlags(global, company);
    const after = resolveCompanyFlags(global, applyWaveToCompany(company, global, wave));
    let changed = false;
    for (const module of PORTAL_MODULES) {
      if (before[module] === after[module]) continue;
      changed = true;
      (after[module] ? turnOn : turnOff).add(module);
    }
    if (changed) changing++;
  }
  const order = (set: Set<PortalModule>) => PORTAL_MODULES.filter((m) => set.has(m));
  return { companies: chosen.length, changing, turnOn: order(turnOn), turnOff: order(turnOff) };
}

// -------------------------------------------------------------- registro --

export function appendLog(
  state: AccessState,
  entry: Omit<AccessLogEntry, 'id' | 'actor'> & { actor?: string },
): AccessState {
  const seq = state.seq + 1;
  return {
    ...state,
    seq,
    log: [{ id: `log-${seq}`, actor: entry.actor ?? ACCESS_ACTOR, ...entry }, ...state.log],
  };
}

export function filterLog(log: AccessLogEntry[], companyId: string | null): AccessLogEntry[] {
  return [...log]
    .filter((entry) => !companyId || entry.companyId === companyId)
    .sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id, 'en', { numeric: true }));
}

export function flagLabel(value: boolean | undefined): string {
  return value === undefined ? 'padrão' : value ? 'ligado' : 'desligado';
}

// ------------------------------------------------------------------ seed --

function contact(
  id: string,
  name: string,
  email: string,
  status: InviteStatus,
  dates: Partial<AccessContact> = {},
): AccessContact {
  return { ...newContact(id, name, email), status, ...dates };
}

/** Empresas e pessoas INVENTADAS, todas em domínio `.example`. */
export function seedAccessState(): AccessState {
  return {
    schema: 1,
    seq: 0,
    log: [],
    companies: [
      {
        id: 'emp-aurora',
        name: 'Metalúrgica Aurora Ltda.',
        cnpj: '00.000.101/0001-01',
        kind: 'freitas',
        wave: 2,
        demo: false,
        responsibleId: 'ct-aurora-1',
        exceptions: {},
        contacts: [
          contact('ct-aurora-1', 'Ana Souza', 'ana.souza@aurora-metal.example', 'ativo', {
            invitedAt: '2026-09-01T12:00:00.000Z',
            expiresAt: '2026-09-08T12:00:00.000Z',
            registeredAt: '2026-09-02T12:00:00.000Z',
            activeSince: '2026-09-02T13:00:00.000Z',
          }),
          contact('ct-aurora-2', 'Bruno Lima', 'bruno.lima@aurora-metal.example', 'convite_enviado', {
            invitedAt: '2026-09-29T12:00:00.000Z',
            expiresAt: '2026-10-06T12:00:00.000Z',
          }),
          contact('ct-aurora-3', 'Carla Nunes', 'carla.nunes@aurora-metal.example', 'nao_convidado'),
        ],
      },
      {
        id: 'emp-horizonte',
        name: 'Têxtil Horizonte S.A.',
        cnpj: '00.000.202/0001-02',
        kind: 'saas',
        wave: 1,
        demo: false,
        responsibleId: 'ct-horizonte-1',
        exceptions: {},
        contacts: [
          contact('ct-horizonte-1', 'Diego Prado', 'diego.prado@horizonte-textil.example', 'cadastrado', {
            invitedAt: '2026-09-20T12:00:00.000Z',
            expiresAt: '2026-09-27T12:00:00.000Z',
            registeredAt: '2026-09-21T12:00:00.000Z',
          }),
          contact('ct-horizonte-2', 'Elisa Rocha', 'elisa.rocha@horizonte-textil.example', 'convite_enviado', {
            invitedAt: '2026-09-10T12:00:00.000Z',
            expiresAt: '2026-09-17T12:00:00.000Z',
          }),
        ],
      },
      {
        id: 'emp-valeverde',
        name: 'Alimentos Vale Verde',
        cnpj: '00.000.303/0001-03',
        kind: 'saas',
        wave: 0,
        demo: false,
        responsibleId: 'ct-valeverde-1',
        exceptions: {},
        contacts: [
          contact('ct-valeverde-1', 'Fábio Teixeira', 'fabio.teixeira@valeverde-alimentos.example', 'bloqueado', {
            invitedAt: '2026-08-10T12:00:00.000Z',
            expiresAt: '2026-08-17T12:00:00.000Z',
            registeredAt: '2026-08-11T12:00:00.000Z',
            activeSince: '2026-08-11T13:00:00.000Z',
            blockedAt: '2026-09-15T12:00:00.000Z',
            statusBeforeBlock: 'ativo',
          }),
        ],
      },
      {
        id: 'emp-demo',
        name: 'Conta Demo Freitas',
        cnpj: '00.000.909/0001-09',
        kind: 'freitas',
        wave: 3,
        demo: true,
        responsibleId: 'ct-demo-1',
        exceptions: {},
        contacts: [
          contact('ct-demo-1', 'Apresentação interna', 'apresentacao@freitas-demo.example', 'ativo', {
            invitedAt: '2026-08-01T12:00:00.000Z',
            expiresAt: '2026-08-08T12:00:00.000Z',
            registeredAt: '2026-08-01T12:30:00.000Z',
            activeSince: '2026-08-01T13:00:00.000Z',
          }),
        ],
      },
    ],
  };
}

/**
 * As exceções da seed são as ondas dela, calculadas contra o padrão de hoje
 * (tudo ligado). Feito na leitura, e não chumbado, para a seed não divergir de
 * `flagsForWave` se uma onda mudar de composição.
 */
export function seedWithWaves(global: PortalModuleFlags): AccessState {
  const state = seedAccessState();
  return {
    ...state,
    companies: state.companies.map((company) =>
      company.wave == null ? company : applyWaveToCompany(company, global, company.wave),
    ),
  };
}

const STATUSES = Object.keys(INVITE_STATUS_LABELS) as InviteStatus[];
const str = (v: unknown): v is string => typeof v === 'string';
const strOrNull = (v: unknown) => (v === null || typeof v === 'string' ? (v as string | null) : null);

/** Lê o store. Estado desconhecido é descartado; ausência vira `null` (seed na tela). */
export function parseAccessState(raw: string | null): AccessState | null {
  if (raw == null) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  const d = data as Record<string, unknown>;
  if (!d || d.schema !== 1 || !Array.isArray(d.companies) || !Array.isArray(d.log)) return null;
  const companies: AccessCompany[] = [];
  for (const value of d.companies as Record<string, unknown>[]) {
    if (!value || !str(value.id) || !str(value.name) || !Array.isArray(value.contacts)) continue;
    const contacts: AccessContact[] = [];
    for (const c of value.contacts as Record<string, unknown>[]) {
      if (!c || !str(c.id) || !str(c.email) || !STATUSES.includes(c.status as InviteStatus)) continue;
      contacts.push({
        id: c.id,
        name: str(c.name) ? c.name : '',
        email: c.email,
        status: c.status as InviteStatus,
        invitedAt: strOrNull(c.invitedAt),
        expiresAt: strOrNull(c.expiresAt),
        registeredAt: strOrNull(c.registeredAt),
        activeSince: strOrNull(c.activeSince),
        blockedAt: strOrNull(c.blockedAt),
        statusBeforeBlock: STATUSES.includes(c.statusBeforeBlock as InviteStatus)
          ? (c.statusBeforeBlock as InviteStatus)
          : null,
      });
    }
    const exceptions: Partial<PortalModuleFlags> = {};
    const rawExceptions = (value.exceptions ?? {}) as Record<string, unknown>;
    for (const module of PORTAL_MODULES)
      if (typeof rawExceptions[module] === 'boolean') exceptions[module] = rawExceptions[module] as boolean;
    companies.push({
      id: value.id,
      name: value.name,
      cnpj: str(value.cnpj) ? value.cnpj : '',
      kind: value.kind === 'saas' ? 'saas' : 'freitas',
      wave: WAVE_NUMBERS.includes(value.wave as WaveNumber) ? (value.wave as WaveNumber) : null,
      demo: value.demo === true,
      responsibleId: str(value.responsibleId) ? value.responsibleId : null,
      contacts,
      exceptions,
    });
  }
  const log = (d.log as Record<string, unknown>[]).filter(
    (e): e is AccessLogEntry & Record<string, unknown> =>
      !!e && str(e.id) && str(e.at) && str(e.companyId) && str(e.what) && str(e.from) && str(e.to),
  ) as AccessLogEntry[];
  return { schema: 1, companies, log, seq: typeof d.seq === 'number' ? d.seq : log.length };
}

export function parseViewingAs(raw: string | null): string | null {
  if (raw == null) return null;
  try {
    const value = JSON.parse(raw);
    return typeof value === 'string' && value ? value : null;
  } catch {
    return null;
  }
}
