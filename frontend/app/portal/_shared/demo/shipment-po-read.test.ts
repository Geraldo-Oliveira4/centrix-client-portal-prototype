// Unit test da leitura simulada do PO. Mesmo runner:
//
//     npm run test:unit
//
// O QUE ERRA EM SILENCIO AQUI:
//
//   1. A leitura mudando entre duas execucoes do mesmo arquivo. Numa
//      demonstracao isso le como bug, e o campo em ambar mudaria de lugar no
//      meio da explicacao.
//   2. A falha de leitura perder o anexo. O cliente teria de subir o arquivo de
//      novo, que e exatamente o que a spec manda evitar.
//   3. Nenhum campo abaixo do corte — sem isso a tela de ambar nunca aparece.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PO_READ_FIELDS,
  PO_READ_FIELD_LABELS,
  PO_READ_FIXTURE_NUMBER,
  lowConfidenceFields,
  simulateRead,
} from './shipment-po-read.ts';
import { PO_CONFIDENCE_THRESHOLD } from './shipment-po-review.ts';

test('sao os dez campos da lista do Orsi, todos com rotulo', () => {
  assert.equal(PO_READ_FIELDS.length, 10);
  for (const field of PO_READ_FIELDS) {
    assert.ok(PO_READ_FIELD_LABELS[field]?.length, `${field} sem rotulo`);
  }
});

test('a leitura e DETERMINISTICA: mesmo nome, mesmo resultado', () => {
  const a = simulateRead('PO-2026-1183.pdf');
  const b = simulateRead('PO-2026-1183.pdf');
  assert.deepEqual(a, b);
});

test('a leitura devolve os dez campos com confianca', () => {
  const { confidence } = simulateRead('po.pdf');
  assert.equal(Object.keys(confidence).length, 10);
  for (const field of PO_READ_FIELDS) {
    assert.equal(typeof confidence[field], 'number', field);
  }
});

test('DOIS campos abaixo de 80% — e o ambar tem onde aparecer', () => {
  const { confidence } = simulateRead('po.pdf');
  const low = lowConfidenceFields(confidence);
  assert.equal(low.length, 2);
  for (const field of low) {
    assert.ok(confidence[field] < PO_CONFIDENCE_THRESHOLD, field);
  }
  for (const field of PO_READ_FIELDS) {
    if (!low.includes(field)) {
      assert.ok(confidence[field] >= PO_CONFIDENCE_THRESHOLD, field);
    }
  }
});

test('a leitura preenche o formulario, com itens e PO', () => {
  const { ok, data } = simulateRead('po.pdf');
  assert.equal(ok, true);
  assert.deepEqual(data.poNumbers, [PO_READ_FIXTURE_NUMBER]);
  assert.equal(data.items?.length, 2);
  assert.ok(data.items?.every((item) => item.partNumber.length > 0));
  assert.equal(data.exporter, 'Sense Components Ltd.');
  assert.equal(data.incoterm, 'FOB');
});

test('o PO lido e um que o seed ja usa — o dedup dispara sozinho', () => {
  // `seed_prototype.py` grava PO-2026-1180..1188 nas cotacoes semeadas.
  assert.match(PO_READ_FIXTURE_NUMBER, /^PO-2026-118\d$/);
});

test('FALHA: campos vazios e o anexo guardado', () => {
  const result = simulateRead('rascunho.pdf', { fail: true });
  assert.equal(result.ok, false);
  assert.equal(result.attachmentName, 'rascunho.pdf');
  assert.deepEqual(result.data, {});
  assert.deepEqual(result.confidence, {});
  assert.deepEqual(lowConfidenceFields(result.confidence), []);
});

test('a falha tambem e deterministica', () => {
  assert.deepEqual(
    simulateRead('x.pdf', { fail: true }),
    simulateRead('x.pdf', { fail: true }),
  );
});

test('sem nome de arquivo, o anexo ainda tem um nome', () => {
  assert.equal(simulateRead('').attachmentName, 'PO.pdf');
});

test('a pre-visualizacao destaca as linhas de baixa confianca', () => {
  const { preview } = simulateRead('po.pdf');
  assert.ok(preview.lines.length > 0);
  assert.ok(preview.lines.some((line) => line.lowConfidence));
  assert.ok(preview.title.includes(PO_READ_FIXTURE_NUMBER));
});
