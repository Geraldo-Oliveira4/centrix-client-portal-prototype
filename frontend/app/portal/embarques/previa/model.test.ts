import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createShipment,
  arrivalState,
  cargoTotals,
  markRead,
  submitDocument,
  approveBooking,
  journeyGuidance,
} from './model.ts';

test('aprovar booking transfere a orientação ao agente sem confirmar coleta ou partida', () => {
  const q = createShipment('booking');
  assert.equal(journeyGuidance(q).action, 'Revisar booking');
  const next = approveBooking(q);
  assert.equal(journeyGuidance(next).alertId, null);
  assert.match(journeyGuidance(next).instruction, /agente.*confirmar/);
  assert.equal(next.stage, q.stage);
});
test('orientação acompanha envio documental, ausência de fonte e chegada sem inferir descarga', () => {
  const q = createShipment('transito');
  assert.equal(journeyGuidance(q).alertId, 'doc-origin');
  assert.equal(
    journeyGuidance(submitDocument(q, 'origin', 'demo.pdf')).alertId,
    null,
  );
  assert.equal(
    journeyGuidance(createShipment('sem-dados')).phase,
    'Aguardando informações',
  );
  assert.match(
    journeyGuidance(createShipment('chegada')).summary,
    /Descarga.*não confirmadas/,
  );
  assert.match(journeyGuidance(createShipment('vencida')).next, /atualização/);
});

test('previsão vencida sem revisão não é baixo risco nem chegada confirmada', () => {
  const q = createShipment('vencida');
  assert.equal(q.firstEta, q.eta);
  assert.equal(arrivalState(q).tone, 'warning');
  assert.match(arrivalState(q).note, /aguardando confirmação/);
  assert.equal(q.actual, false);
});
test('chegada realizada tem precedência sobre previsão vencida', () => {
  assert.equal(arrivalState(createShipment('chegada')).tone, 'success');
  assert.match(
    arrivalState(createShipment('chegada')).note,
    /Entrega.*não informada/,
  );
});
test('sem cobertura não afirma normalidade', () => {
  const q = createShipment('sem-dados');
  assert.equal(q.eta, null);
  assert.equal(q.items.length, 0);
  assert.match(arrivalState(q).note, /Aguardando.*fonte/);
});
test('mercadorias somam alocação do embarque, preservando moedas e cobertura parcial', () => {
  const q = createShipment('parcial');
  const totals = cargoTotals(q.items);
  assert.deepEqual(totals, [
    { currency: 'USD', value: 49200, known: 3, lines: 3 },
    { currency: 'EUR', value: 600, known: 1, lines: 2 },
  ]);
  assert.equal(q.items.filter((i) => i.part === 'MTR-220-4P').length, 2);
  assert.notEqual(q.items[0].quantity, q.items[0].ordered);
});
test('ler ocorrência não resolve nem altera outras ocorrências', () => {
  const q = createShipment('transito');
  const next = markRead(q, 'doc-origin');
  assert.equal(next.alerts[0].read, true);
  assert.equal(next.alerts[0].state, 'Aberta');
  assert.equal(next.alerts[1].read, false);
  assert.equal(q.alerts[0].read, false);
});
test('envio resolve só a pendência de envio e coloca documento em análise', () => {
  const next = submitDocument(
    createShipment('transito'),
    'origin',
    'certificado-demo.pdf',
  );
  assert.equal(next.documents[0].state, 'Em análise');
  assert.equal(next.alerts[0].state, 'Resolvida');
  assert.equal(next.alerts[1].state, 'Em acompanhamento');
  assert.match(next.events[0].detail, /sem transferência/);
  assert.equal(submitDocument(next, 'origin', 'reenvio.pdf'), next);
});
test('envio sem arquivo ou em documento inexistente não gera sucesso', () => {
  const q = createShipment('transito');
  assert.equal(submitDocument(q, 'origin', ''), q);
  assert.equal(submitDocument(q, 'missing', 'demo.pdf'), q);
});
test('aprovar booking preserva a etapa; repetir não duplica histórico', () => {
  const q = createShipment('booking');
  const next = approveBooking(q);
  assert.equal(next.stage, q.stage);
  assert.equal(next.alerts[0].state, 'Resolvida');
  assert.equal(
    next.documents.find((d) => d.id === 'booking')?.state,
    'Aprovado',
  );
  assert.equal(approveBooking(next), next);
});
