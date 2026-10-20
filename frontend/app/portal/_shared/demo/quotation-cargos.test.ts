import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { FormSnapshot } from './quotation-form-snapshot.ts';
import { evaluateHardblocks, parseAmount } from './quotation-hardblocks.ts';
import {
  cargoCountSummary,
  cargoField,
  cargoPayload,
  combinedProductLabel,
  countVolumes,
  emptyCargo,
  extraCargoLines,
  hardblocksWithCargos,
  type ExtraCargo,
} from './quotation-cargos.ts';

/** A complete maritime FCA quotation: passes every item (same as the hardblocks test). */
function complete(patch: FormSnapshot = {}): FormSnapshot {
  return {
    tipo_cotacao: 'REAL',
    service_type: 'IMPORTACAO',
    modal: 'MARITIMO',
    incoterm: 'FCA',
    price_or_performance: 'PRECO',
    origin: 'Rua Ficticia 100, Busan',
    porto_embarque: 'Busan, South Korea (KRPUS)',
    porto_destino: ['Santos, Brazil (BRSSZ)'],
    agente_define_porto_destino: 'false',
    product: 'Pecas de reposicao',
    carga_perigosa: 'NAO',
    stackability: 'true',
    carga_tombavel: 'false',
    carga_refrigerada: 'false',
    client_reference: 'PO-DEMO-0001',
    ...patch,
  };
}

function filledCargo(patch: Partial<ExtraCargo> = {}): ExtraCargo {
  return {
    ...emptyCargo('c2'),
    product: 'Rolamentos ficticios',
    carga_perigosa: 'NAO',
    stackability: 'true',
    carga_tombavel: 'false',
    ...patch,
  };
}

function report(snapshot: FormSnapshot, cargos: ExtraCargo[]) {
  return hardblocksWithCargos(
    evaluateHardblocks(snapshot),
    snapshot,
    cargos,
    evaluateHardblocks,
  );
}

test('without extra cargos the report is untouched (no "(Carga 1)" label)', () => {
  const snapshot = complete({ product: '' });
  const plain = evaluateHardblocks(snapshot);
  assert.deepEqual(report(snapshot, []), plain);
  assert.equal(plain.blocks[0].label, 'Produto');
});

test('a blank second cargo counts its own items, labelled and anchored per cargo', () => {
  const r = report(complete(), [emptyCargo('c2')]);
  const labels = r.blocks.map((b) => b.label);
  assert.deepEqual(labels, [
    'Produto (Carga 2)',
    'Carga perigosa (Carga 2)',
    'Empilhável (Carga 2)',
    'Tombável (Carga 2)',
  ]);
  assert.deepEqual(
    r.blocks.map((b) => b.field),
    [
      cargoField(2, 'product'),
      cargoField(2, 'carga_perigosa'),
      cargoField(2, 'stackability'),
      cargoField(2, 'carga_tombavel'),
    ],
  );
});

test('cargo 1 items get "(Carga 1)" once there is a second cargo; shipment items do not', () => {
  const r = report(complete({ product: '', incoterm: '' }), [filledCargo()]);
  const labels = r.blocks.map((b) => b.label);
  assert.ok(labels.includes('Produto (Carga 1)'));
  assert.ok(labels.includes('Incoterm'));
  assert.ok(!labels.some((l) => l.includes('(Carga 2)')));
});

test('extra cargo items sit after cargo 1 and before the PO, in form order', () => {
  const r = report(complete({ product: '', client_reference: '' }), [
    emptyCargo('c2'),
    filledCargo({ id: 'c3', product: '' }),
  ]);
  const labels = r.blocks.map((b) => b.label);
  assert.equal(labels[0], 'Produto (Carga 1)');
  assert.equal(labels[labels.length - 1], 'Sua referência (PO)');
  assert.ok(labels.indexOf('Produto (Carga 2)') < labels.indexOf('Produto (Carga 3)'));
  assert.equal(r.blocks.length, 1 + 4 + 1 + 1);
});

test('incoterm rules apply to every cargo: CIF asks the value of each one', () => {
  const r = report(complete({ incoterm: 'CIF', declared_value: '1000' }), [filledCargo()]);
  assert.deepEqual(
    r.blocks.map((b) => [b.label, b.field]),
    [['Valor da carga (Carga 2)', cargoField(2, 'declared_value')]],
  );
});

test('dangerous "Sim" without class and refrigerated without temperature block per cargo', () => {
  const r = report(complete(), [
    filledCargo({ carga_perigosa: '', perigosa_declarada: true, refrigerada: true }),
  ]);
  const labels = r.blocks.map((b) => b.label);
  assert.ok(labels.includes('Carga perigosa (Carga 2)'));
  assert.ok(labels.includes('UN (Carga 2)'));
  assert.ok(labels.includes('Temperatura mínima (Carga 2)'));
});

test('a complete extra cargo adds nothing', () => {
  assert.equal(report(complete(), [filledCargo()]).blocks.length, 0);
});

test('summaries', () => {
  assert.equal(cargoCountSummary(1, 2), '1 carga · 2 volumes');
  assert.equal(cargoCountSummary(3, 5), '3 cargas · 5 volumes');
  assert.equal(cargoCountSummary(2, 0), '2 cargas · sem volumes');
  assert.equal(cargoCountSummary(2, null, 1), '2 cargas · 1 equipamento');
  assert.equal(countVolumes([{ quantity: 3 }, { quantity: 0 }]), 4);
  assert.equal(combinedProductLabel(['Pecas']), 'Pecas');
  assert.equal(combinedProductLabel(['Pecas', 'Rolamentos']), 'Pecas + 1 outra carga');
  assert.equal(combinedProductLabel(['', 'A', 'B']), 'Carga sem descrição + 2 outras cargas');
  assert.deepEqual(
    extraCargoLines([filledCargo({ volumes: [{ quantity: 2 }], declared_value: '4.000', declared_value_currency: 'USD' })]),
    ['Carga 2: Rolamentos ficticios · 2 volumes · USD 4.000'],
  );
});

test('cargo payload carries only what was answered, with parsed numbers', () => {
  const payload = cargoPayload(
    filledCargo({ declared_value: '12.500,00', refrigerada: true, temperatura_min: '-18', volumes: [{ quantity: 1 }] }),
    parseAmount,
  );
  assert.deepEqual(payload, {
    product: 'Rolamentos ficticios',
    volumes: [{ quantity: 1 }],
    carga_perigosa: 'NAO',
    stackability: true,
    carga_tombavel: false,
    temperatura_min: -18,
    declared_value: 12500,
    declared_value_currency: 'BRL',
  });
});
