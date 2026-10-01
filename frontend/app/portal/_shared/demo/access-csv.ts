// Importação de contatos em lote (A1). Puro.
//
// DOIS FORMATOS, um parser. O curto é o da spec 03 (`cliente,e-mail,nome`); o
// completo acrescenta o que o Prompt 3 pediu. O cabeçalho decide: as colunas
// são achadas pelo NOME (com sinônimos), não pela posição, e as extras são
// opcionais. Separador vírgula ou ponto e vírgula (o Excel em português salva
// com ponto e vírgula), BOM e aspas tratados.
//
// A validação é POR LINHA e nunca para no primeiro erro: o relatório mostra
// tudo de uma vez, e a importação leva só as linhas válidas.

import {
  CLIENT_KIND_LABELS,
  WAVE_NUMBERS,
  appendLog,
  emailsInUse,
  newContact,
  normalizeEmail,
  normalizeName,
  type AccessCompany,
  type AccessState,
  type ClientKind,
  type WaveNumber,
} from './access-model.ts';

export const CSV_TEMPLATE_FULL = [
  'empresa,cnpj,tipo_cliente,onda,nome,email,responsavel,demo',
  'Indústria Exemplo Ltda.,00.000.404/0001-04,Cliente Freitas,1,Gabriela Mota,gabriela.mota@industria-exemplo.example,sim,não',
  'Indústria Exemplo Ltda.,00.000.404/0001-04,Cliente Freitas,1,Hugo Reis,hugo.reis@industria-exemplo.example,não,não',
  'Comércio Modelo ME,00.000.505/0001-05,SaaS puro,0,Irene Castro,irene.castro@comercio-modelo.example,sim,não',
].join('\n');

export const CSV_TEMPLATE_SHORT = [
  'cliente,e-mail,nome',
  'Indústria Exemplo Ltda.,joana.alves@industria-exemplo.example,Joana Alves',
].join('\n');

type Column = 'company' | 'cnpj' | 'kind' | 'wave' | 'name' | 'email' | 'responsible' | 'demo';

const HEADER_ALIASES: Record<string, Column> = {
  empresa: 'company',
  cliente: 'company',
  cnpj: 'cnpj',
  cnpj_ficticio: 'cnpj',
  tipo: 'kind',
  tipo_cliente: 'kind',
  'tipo de cliente': 'kind',
  onda: 'wave',
  nome: 'name',
  email: 'email',
  'e-mail': 'email',
  responsavel: 'responsible',
  demo: 'demo',
  interna: 'demo',
};

export interface CsvRowData {
  company: string;
  cnpj: string;
  kind: ClientKind | null;
  wave: WaveNumber | null;
  name: string;
  email: string;
  responsible: boolean;
  demo: boolean;
}

export interface CsvRow {
  /** Linha no arquivo, contando o cabeçalho como 1. */
  line: number;
  raw: string;
  ok: boolean;
  errors: string[];
  data: CsvRowData;
}

export interface CsvParseResult {
  /** Erro do arquivo inteiro (sem cabeçalho reconhecível). Linhas vazias. */
  fileError: string | null;
  format: 'curto' | 'completo' | null;
  rows: CsvRow[];
}

function splitLine(line: string, separator: string): string[] {
  const out: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === separator) {
      out.push(cell);
      cell = '';
    } else cell += ch;
  }
  out.push(cell);
  return out.map((value) => value.trim());
}

const yes = (value: string) => ['sim', 's', 'yes', 'y', 'true', '1', 'x'].includes(normalizeName(value));
const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

function parseKind(value: string): ClientKind | null | 'invalid' {
  const v = normalizeName(value);
  if (!v) return null;
  if (['cliente freitas', 'freitas'].includes(v)) return 'freitas';
  if (['saas puro', 'saas'].includes(v)) return 'saas';
  return 'invalid';
}

export function parseAccessCsv(text: string, state: AccessState): CsvParseResult {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => line.trim() !== '');
  if (headerIndex < 0) return { fileError: 'O arquivo está vazio.', format: null, rows: [] };
  const headerLine = lines[headerIndex];
  const separator = headerLine.split(';').length > headerLine.split(',').length ? ';' : ',';
  const header = splitLine(headerLine, separator).map((cell) => HEADER_ALIASES[normalizeName(cell)] ?? null);
  const missing = (['company', 'email', 'name'] as Column[]).filter((column) => !header.includes(column));
  if (missing.length) {
    return {
      fileError:
        'Cabeçalho não reconhecido. A primeira linha precisa ter ao menos as colunas cliente (ou empresa), e-mail e nome.',
      format: null,
      rows: [],
    };
  }
  const format = header.includes('kind') || header.includes('wave') ? 'completo' : 'curto';
  const inUse = emailsInUse(state.companies);
  const seenInFile = new Map<string, number>();
  const rows: CsvRow[] = [];
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw.trim()) continue;
    const cells = splitLine(raw, separator);
    const get = (column: Column) => {
      const index = header.indexOf(column);
      return index >= 0 ? cells[index] ?? '' : '';
    };
    const errors: string[] = [];
    const company = get('company');
    const email = get('email');
    const name = get('name');
    const kind = parseKind(get('kind'));
    const waveRaw = get('wave');
    const wave = waveRaw === '' ? null : Number(waveRaw);
    if (!company) errors.push('Empresa vazia.');
    if (!name) errors.push('Nome vazio.');
    if (!email) errors.push('E-mail vazio.');
    else if (!EMAIL.test(email)) errors.push(`E-mail inválido: "${email}".`);
    else {
      const key = normalizeEmail(email);
      if (inUse.has(key)) errors.push('E-mail já cadastrado em outra empresa ou login existente.');
      const first = seenInFile.get(key);
      if (first) errors.push(`E-mail repetido no arquivo (já na linha ${first}).`);
      else seenInFile.set(key, i + 1);
    }
    if (kind === 'invalid')
      errors.push(`Tipo de cliente desconhecido: use "${CLIENT_KIND_LABELS.freitas}" ou "${CLIENT_KIND_LABELS.saas}".`);
    if (wave !== null && !WAVE_NUMBERS.includes(wave as WaveNumber))
      errors.push(`Onda fora do intervalo: "${waveRaw}" (use 0 a 3).`);
    rows.push({
      line: i + 1,
      raw,
      ok: errors.length === 0,
      errors,
      data: {
        company,
        cnpj: get('cnpj'),
        kind: kind === 'invalid' ? null : kind,
        wave: wave !== null && WAVE_NUMBERS.includes(wave as WaveNumber) ? (wave as WaveNumber) : null,
        name,
        email,
        responsible: yes(get('responsible')),
        demo: yes(get('demo')),
      },
    });
  }
  return { fileError: rows.length ? null : 'Nenhuma linha de dados depois do cabeçalho.', format, rows };
}

export interface CsvImportResult {
  state: AccessState;
  createdCompanies: number;
  addedContacts: number;
  skipped: number;
}

/**
 * Leva só as linhas válidas. Empresa casa pelo nome normalizado: a mesma
 * empresa em várias linhas vira uma empresa com vários contatos, e uma empresa
 * que já existe ganha os contatos novos sem perder os antigos. Tipo, onda e
 * demonstração só valem para empresa NOVA — reimportar não muda a onda de quem
 * já está no ar (isso é a matriz, com confirmação).
 */
export function importAccessCsv(
  state: AccessState,
  rows: CsvRow[],
  at: string,
  applyWave: (company: AccessCompany, wave: WaveNumber) => AccessCompany,
): CsvImportResult {
  let next: AccessState = { ...state, companies: state.companies.map((c) => ({ ...c, contacts: [...c.contacts] })) };
  let createdCompanies = 0;
  let addedContacts = 0;
  for (const row of rows) {
    if (!row.ok) continue;
    const d = row.data;
    let company = next.companies.find((c) => normalizeName(c.name) === normalizeName(d.company));
    if (!company) {
      next.seq++;
      company = {
        id: `emp-imp-${next.seq}`,
        name: d.company,
        cnpj: d.cnpj,
        kind: d.kind ?? 'freitas',
        wave: null,
        demo: d.demo,
        responsibleId: null,
        contacts: [],
        exceptions: {},
      };
      if (d.wave !== null) company = applyWave(company, d.wave);
      next.companies = [...next.companies, company];
      createdCompanies++;
      next = appendLog(next, {
        at,
        companyId: company.id,
        companyName: company.name,
        what: 'Empresa criada por importação',
        from: '—',
        to: `${CLIENT_KIND_LABELS[company.kind]}${company.wave !== null ? ` · onda ${company.wave}` : ''}${company.demo ? ' · demonstração' : ''}`,
      });
    }
    next.seq++;
    const contact = newContact(`ct-imp-${next.seq}`, d.name, d.email);
    const target = next.companies.find((c) => c.id === company!.id)!;
    target.contacts.push(contact);
    if (d.responsible || !target.responsibleId) target.responsibleId = contact.id;
    addedContacts++;
    next = appendLog(next, {
      at,
      companyId: target.id,
      companyName: target.name,
      what: `Contato importado: ${contact.email}`,
      from: '—',
      to: 'Não convidado',
    });
  }
  return { state: next, createdCompanies, addedContacts, skipped: rows.filter((r) => !r.ok).length };
}

/** Relatório de erros, para copiar e devolver a quem mandou a planilha. */
export function csvErrorReport(rows: CsvRow[]): string {
  return rows
    .filter((row) => !row.ok)
    .map((row) => `Linha ${row.line}: ${row.errors.join(' ')}`)
    .join('\n');
}
