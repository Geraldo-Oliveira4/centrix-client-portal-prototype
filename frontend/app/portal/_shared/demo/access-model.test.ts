import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_MODULE_FLAGS, flagsForWave } from './feature-flags.ts';
import {
  INVITE_MAIN_PATH,
  allowedInviteActions,
  appendLog,
  applyInviteAction,
  applyWaveToCompany,
  effectiveInviteStatus,
  filterCompanies,
  filterLog,
  isException,
  newContact,
  parseAccessState,
  previewWave,
  resolveCompanyFlags,
  seedAccessState,
  seedWithWaves,
  setCompanyModule,
  type AccessCompany,
} from './access-model.ts';

const NOW = new Date('2026-10-01T12:00:00.000Z');
const later = (days: number) => new Date(NOW.getTime() + days * 86400000);

test('caminho principal: não convidado -> enviado -> cadastrado -> ativo', () => {
  let c = newContact('c1', 'Pessoa', 'pessoa@empresa.example');
  const path = [c.status];
  for (const action of ['enviar', 'simular_cadastro', 'simular_primeiro_acesso'] as const) {
    const r = applyInviteAction(c, action, NOW);
    assert.equal(r.ok, true);
    c = r.contact;
    path.push(c.status);
  }
  assert.deepEqual(path, INVITE_MAIN_PATH);
  assert.equal(c.activeSince, NOW.toISOString());
});

test('convite vence sozinho em 7 dias e vira Expirado; reenviar renova', () => {
  const sent = applyInviteAction(newContact('c', 'P', 'p@e.example'), 'enviar', NOW).contact;
  assert.equal(effectiveInviteStatus(sent, later(6)), 'convite_enviado');
  assert.equal(effectiveInviteStatus(sent, later(7)), 'expirado');
  assert.ok(!allowedInviteActions(sent, later(8)).includes('simular_cadastro'));
  const again = applyInviteAction(sent, 'reenviar', later(8));
  assert.equal(again.from, 'expirado');
  assert.equal(effectiveInviteStatus(again.contact, later(9)), 'convite_enviado');
});

test('revogar volta para não convidado e limpa as datas', () => {
  const sent = applyInviteAction(newContact('c', 'P', 'p@e.example'), 'enviar', NOW).contact;
  const r = applyInviteAction(sent, 'revogar', NOW);
  assert.equal(r.contact.status, 'nao_convidado');
  assert.equal(r.contact.invitedAt, null);
});

test('bloqueio é lateral: devolve ao status anterior, mas convite vencido não revive', () => {
  const active = { ...newContact('c', 'P', 'p@e.example'), status: 'ativo' as const };
  const blocked = applyInviteAction(active, 'bloquear', NOW).contact;
  assert.equal(blocked.status, 'bloqueado');
  assert.deepEqual(allowedInviteActions(blocked, NOW), ['desbloquear']);
  assert.equal(applyInviteAction(blocked, 'desbloquear', NOW).contact.status, 'ativo');
  const expired = applyInviteAction(
    applyInviteAction(newContact('d', 'P', 'q@e.example'), 'enviar', NOW).contact,
    'simular_expiracao',
    NOW,
  ).contact;
  assert.equal(effectiveInviteStatus(expired, NOW), 'expirado');
  const back = applyInviteAction(applyInviteAction(expired, 'bloquear', NOW).contact, 'desbloquear', NOW);
  assert.equal(back.contact.status, 'nao_convidado');
});

test('ação fora de hora é recusada com motivo, sem mudar nada', () => {
  const c = newContact('c', 'P', 'p@e.example');
  const r = applyInviteAction(c, 'simular_primeiro_acesso', NOW);
  assert.equal(r.ok, false);
  assert.match(r.error ?? '', /Não convidado/);
  assert.equal(r.contact, c);
});

const company = (exceptions = {}): AccessCompany => ({
  id: 'e1',
  name: 'Empresa',
  cnpj: '',
  kind: 'freitas',
  wave: null,
  demo: false,
  responsibleId: null,
  contacts: [],
  exceptions,
});

test('flags: padrão global + exceção por empresa; exceção igual ao padrão não conta', () => {
  const global = { ...DEFAULT_MODULE_FLAGS, radar: false };
  const c = company({ radar: true, auditoria: true });
  assert.equal(resolveCompanyFlags(global, c).radar, true);
  assert.equal(isException(global, c, 'radar'), true);
  assert.equal(isException(global, c, 'auditoria'), false);
  const back = setCompanyModule(c, global, 'radar', false);
  assert.equal('radar' in back.exceptions, false);
});

test('onda aplicada a uma empresa reproduz exatamente a onda, sobre qualquer padrão', () => {
  for (const global of [DEFAULT_MODULE_FLAGS, flagsForWave('onda0')]) {
    const c = applyWaveToCompany(company(), global, 1);
    assert.deepEqual(resolveCompanyFlags(global, c), flagsForWave('onda1'));
    assert.equal(c.wave, 1);
  }
});

test('prévia da onda em lote diz quantas empresas e quais módulos mudam', () => {
  const global = DEFAULT_MODULE_FLAGS;
  const companies = [company(), { ...company(), id: 'e2' }, { ...company(), id: 'e3' }];
  const p = previewWave(companies, ['e1', 'e2'], global, 1);
  assert.equal(p.companies, 2);
  assert.equal(p.changing, 2);
  assert.deepEqual(p.turnOn, []);
  assert.deepEqual(p.turnOff, ['embarques', 'embarqueViaPo', 'inteligencia', 'radar', 'auditoria']);
  const again = previewWave([applyWaveToCompany(company(), global, 1)], ['e1'], global, 1);
  assert.equal(again.changing, 0);
});

test('registro: mais recente primeiro e filtro por empresa', () => {
  let s = seedAccessState();
  s = appendLog(s, { at: '2026-10-01T10:00:00Z', companyId: 'a', companyName: 'A', what: 'x', from: '1', to: '2' });
  s = appendLog(s, { at: '2026-10-01T11:00:00Z', companyId: 'b', companyName: 'B', what: 'y', from: '1', to: '2' });
  s = appendLog(s, { at: '2026-10-01T11:00:00Z', companyId: 'a', companyName: 'A', what: 'z', from: '1', to: '2' });
  assert.deepEqual(filterLog(s.log, null).map((e) => e.what), ['z', 'y', 'x']);
  assert.deepEqual(filterLog(s.log, 'a').map((e) => e.what), ['z', 'x']);
  assert.equal(s.log[0].actor, 'Analista Freitas (simulado)');
});

test('seed: dados fictícios em domínio .example, nenhum e-mail repetido', () => {
  const s = seedWithWaves(DEFAULT_MODULE_FLAGS);
  const emails = s.companies.flatMap((c) => c.contacts.map((ct) => ct.email));
  assert.ok(emails.every((e) => e.endsWith('.example')));
  assert.equal(new Set(emails).size, emails.length);
  assert.ok(s.companies.some((c) => c.kind === 'saas'));
  assert.ok(s.companies.some((c) => c.demo));
  const horizonte = s.companies.find((c) => c.id === 'emp-horizonte')!;
  assert.deepEqual(resolveCompanyFlags(DEFAULT_MODULE_FLAGS, horizonte), flagsForWave('onda1'));
});

test('store: ida e volta preserva tudo; lixo vira null', () => {
  const s = seedWithWaves(DEFAULT_MODULE_FLAGS);
  assert.deepEqual(parseAccessState(JSON.stringify(s)), s);
  assert.equal(parseAccessState('{"schema":2}'), null);
  assert.equal(parseAccessState('nao-json'), null);
});

test('filtro de empresas por onda, status efetivo do convite e demonstração', () => {
  const s = seedWithWaves(DEFAULT_MODULE_FLAGS);
  const ids = (f: Parameters<typeof filterCompanies>[1]) => filterCompanies(s.companies, f, NOW).map((c) => c.id);
  assert.deepEqual(ids({ wave: 1, status: null, demo: null }), ['emp-horizonte']);
  assert.deepEqual(ids({ wave: null, status: 'expirado', demo: null }), ['emp-horizonte']);
  assert.deepEqual(ids({ wave: null, status: 'bloqueado', demo: null }), ['emp-valeverde']);
  assert.deepEqual(ids({ wave: null, status: null, demo: 'only' }), ['emp-demo']);
  assert.equal(ids({ wave: null, status: null, demo: 'hide' }).includes('emp-demo'), false);
  assert.deepEqual(ids({ wave: 'none', status: null, demo: null }), []);
});
