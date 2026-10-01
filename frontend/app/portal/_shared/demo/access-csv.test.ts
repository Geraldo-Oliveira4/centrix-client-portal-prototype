import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_MODULE_FLAGS, flagsForWave } from './feature-flags.ts';
import {
  applyWaveToCompany,
  resolveCompanyFlags,
  seedWithWaves,
  type AccessCompany,
  type WaveNumber,
} from './access-model.ts';
import {
  CSV_TEMPLATE_FULL,
  CSV_TEMPLATE_SHORT,
  csvErrorReport,
  importAccessCsv,
  parseAccessCsv,
} from './access-csv.ts';

const state = () => seedWithWaves(DEFAULT_MODULE_FLAGS);
const wave = (c: AccessCompany, w: WaveNumber) =>
  applyWaveToCompany(c, DEFAULT_MODULE_FLAGS, w);

test('os dois modelos são válidos e reconhecidos pelo formato', () => {
  const full = parseAccessCsv(CSV_TEMPLATE_FULL, state());
  assert.equal(full.format, 'completo');
  assert.ok(
    full.rows.every((r) => r.ok),
    csvErrorReport(full.rows),
  );
  const short = parseAccessCsv(CSV_TEMPLATE_SHORT, state());
  assert.equal(short.format, 'curto');
  assert.ok(short.rows.every((r) => r.ok));
});

test('ponto e vírgula, BOM e aspas com vírgula dentro', () => {
  const csv =
    '﻿cliente;e-mail;nome\n"Empresa, Filial Sul";x@filial.example;"Nome ""Apelido"""';
  const r = parseAccessCsv(csv, state());
  assert.equal(r.rows[0].ok, true);
  assert.equal(r.rows[0].data.company, 'Empresa, Filial Sul');
  assert.equal(r.rows[0].data.name, 'Nome "Apelido"');
});

test('cada erro de linha é dito, sem parar no primeiro', () => {
  const csv = [
    'empresa,tipo_cliente,onda,nome,email',
    'A,Cliente Freitas,1,Ok,ok@a.example',
    ',Cliente Freitas,1,Sem empresa,s@a.example',
    'A,Outro tipo,9,Errado,invalido',
    'A,SaaS puro,0,Repetido,ok@a.example',
    'A,SaaS puro,0,Existente,ana.souza@aurora-metal.example',
    'A,SaaS puro,0,Demo,demo@cliente.local',
  ].join('\n');
  const r = parseAccessCsv(csv, state());
  assert.deepEqual(
    r.rows.map((x) => x.ok),
    [true, false, false, false, false, false],
  );
  assert.match(r.rows[1].errors.join(' '), /Empresa vazia/);
  assert.equal(r.rows[2].errors.length, 3);
  assert.match(
    r.rows[3].errors.join(' '),
    /repetido no arquivo \(já na linha 2\)/,
  );
  assert.match(r.rows[4].errors.join(' '), /já cadastrado/);
  assert.match(r.rows[5].errors.join(' '), /já cadastrado/);
  assert.match(csvErrorReport(r.rows), /^Linha 3: Empresa vazia\./);
});

test('cabeçalho sem as colunas mínimas recusa o arquivo inteiro', () => {
  const r = parseAccessCsv('foo,bar\n1,2', state());
  assert.ok(r.fileError);
  assert.equal(r.rows.length, 0);
});

test('importar leva só as válidas, agrupa por empresa e aplica a onda à empresa nova', () => {
  const s = state();
  const r = parseAccessCsv(CSV_TEMPLATE_FULL + '\nX,,,Sem email,', s);
  const out = importAccessCsv(s, r.rows, '2026-10-01T12:00:00Z', wave);
  assert.equal(out.createdCompanies, 2);
  assert.equal(out.addedContacts, 3);
  assert.equal(out.skipped, 1);
  const exemplo = out.state.companies.find(
    (c) => c.name === 'Indústria Exemplo Ltda.',
  )!;
  assert.equal(exemplo.contacts.length, 2);
  assert.equal(
    exemplo.contacts.every((c) => c.status === 'nao_convidado'),
    true,
  );
  assert.equal(exemplo.responsibleId, exemplo.contacts[0].id);
  assert.deepEqual(
    resolveCompanyFlags(DEFAULT_MODULE_FLAGS, exemplo),
    flagsForWave('onda1'),
  );
  assert.equal(
    out.state.companies.find((c) => c.name === 'Comércio Modelo ME')!.kind,
    'saas',
  );
  assert.ok(out.state.log.length >= 5);
  assert.equal(s.companies.length, 4, 'o estado original não muda');
});

test('importar para empresa existente acrescenta contato e não muda a onda dela', () => {
  const s = state();
  const csv =
    'cliente,e-mail,nome,onda\nMETALÚRGICA AURORA LTDA.,nova@aurora-metal.example,Nova Pessoa,0';
  const out = importAccessCsv(
    s,
    parseAccessCsv(csv, s).rows,
    '2026-10-01T12:00:00Z',
    wave,
  );
  assert.equal(out.createdCompanies, 0);
  const aurora = out.state.companies.find((c) => c.id === 'emp-aurora')!;
  assert.equal(aurora.contacts.length, 4);
  assert.equal(aurora.wave, 2);
  assert.equal(aurora.responsibleId, 'ct-aurora-1');
});
