// Unit test da síntese do bloco "Evidência". Mesmo runner dos outros libs:
//
//     npm run test:unit
//
// O que erra em silêncio aqui: a frase e a lista discordarem. Se a conclusão
// contar 5 embarques e a tela mostrar 3, o cliente não consegue conferir a
// afirmação — e uma conclusão que não se confere é pior do que a lista crua que
// ela veio substituir. Por isso `matches` É a amostra analisada, e o teste
// amarra os dois.

import test from 'node:test';
import assert from 'node:assert/strict';

import { EVIDENCE_WINDOW, summarizeEvidence } from './evidence-summary.ts';

const shipment = (id, overrides = {}) => ({
  id,
  referencia: `EMB-2026-${id}`,
  client_reference: null,
  estado: 'embarcado',
  incoterm: null,
  modal: 'MARITIMO',
  tipo_embarque: null,
  tipo_despacho: null,
  carga_urgente: false,
  agente_nome: 'Agente A',
  quotation_id: `q-${id}`,
  created_at: `2026-01-0${id}T00:00:00Z`,
  updated_at: null,
  tracking: null,
  ...overrides,
});

test('sem embarques, não há conclusão nenhuma', () => {
  const s = summarizeEvidence({ shipments: [], modal: 'MARITIMO' });
  assert.equal(s.headline, null);
  assert.equal(s.matches.length, 0);
});

test('prefere agente + modal quando existe, e nomeia o recorte na frase', () => {
  const s = summarizeEvidence({
    shipments: [
      shipment('1', { agente_nome: 'Agente A' }),
      shipment('2', { agente_nome: 'Outro', modal: 'MARITIMO' }),
    ],
    modal: 'MARITIMO',
    agentName: 'Agente A',
    modalLabel: 'Marítimo',
  });
  assert.equal(s.scope, 'agent_modal');
  assert.equal(s.matches.length, 1);
  assert.match(s.headline, /com Agente A em marítimo/);
});

test('cai para o modal quando o agente não tem histórico', () => {
  const s = summarizeEvidence({
    shipments: [shipment('1', { agente_nome: 'Outro' })],
    modal: 'MARITIMO',
    agentName: 'Agente A',
    modalLabel: 'Marítimo',
  });
  assert.equal(s.scope, 'modal');
  assert.match(s.headline, /em marítimo/);
  assert.doesNotMatch(s.headline, /Agente A/);
});

test('cai para "qualquer embarque" quando nem o modal casa, e a frase não promete recorte', () => {
  const s = summarizeEvidence({
    shipments: [shipment('1', { modal: 'AEREO' })],
    modal: 'MARITIMO',
    agentName: 'Agente A',
    modalLabel: 'Marítimo',
  });
  assert.equal(s.scope, 'any');
  assert.equal(s.headline, 'No seu último embarque, não há ocorrência em aberto.');
});

test('o embarque da própria cotação nunca serve de evidência para ela mesma', () => {
  const s = summarizeEvidence({
    shipments: [shipment('1', { quotation_id: 'q-atual' })],
    excludeQuotationId: 'q-atual',
    modal: 'MARITIMO',
  });
  assert.equal(s.matches.length, 0);
  assert.equal(s.headline, null);
});

test('conta as exceções em aberto e concorda com a lista exibida', () => {
  const s = summarizeEvidence({
    shipments: [
      shipment('1', { estado: 'postergado' }),
      shipment('2', { estado: 'booking_divergente' }),
      shipment('3', { estado: 'embarcado' }),
    ],
    modal: 'MARITIMO',
    agentName: 'Agente A',
    modalLabel: 'Marítimo',
  });
  assert.equal(s.matches.length, 3);
  assert.equal(s.exceptions, 2);
  assert.match(s.headline, /^Nos seus últimos 3 embarques com Agente A em marítimo, 2 têm ocorrência em aberto\.$/);
});

test('singular de exceção diz "1 tem", não "1 têm"', () => {
  const s = summarizeEvidence({
    shipments: [shipment('1', { estado: 'postergado' }), shipment('2'), shipment('3')],
    modal: 'MARITIMO',
  });
  assert.equal(s.exceptions, 1);
  assert.match(s.headline, /1 tem ocorrência em aberto\.$/);
});

test('a janela analisada é a janela exibida — nunca conclui sobre mais do que mostra', () => {
  const many = ['1', '2', '3', '4', '5'].map((id) => shipment(id));
  const s = summarizeEvidence({ shipments: many, modal: 'MARITIMO' });
  assert.equal(s.matches.length, EVIDENCE_WINDOW);
  assert.match(s.headline, new RegExp(`últimos ${EVIDENCE_WINDOW} embarques`));
});

test('mais recente primeiro, para "últimos N" ser verdade', () => {
  const s = summarizeEvidence({
    shipments: [
      shipment('1', { created_at: '2026-01-01T00:00:00Z' }),
      shipment('9', { created_at: '2026-09-01T00:00:00Z' }),
      shipment('5', { created_at: '2026-05-01T00:00:00Z' }),
    ],
    modal: 'MARITIMO',
  });
  assert.deepEqual(
    s.matches.map((m) => m.id),
    ['9', '5', '1'],
  );
});
