import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { FormSnapshot } from './quotation-form-snapshot.ts';
import {
  evaluateHardblocks,
  hardblockCountLabel,
  parseAmount,
  quotationHardblocks,
} from './quotation-hardblocks.ts';

/** A complete maritime FCA quotation: passes every item. */
function complete(patch: FormSnapshot = {}): FormSnapshot {
  return {
    tipo_cotacao: 'REAL',
    service_type: 'IMPORTACAO',
    modal: 'MARITIMO',
    incoterm: 'FCA',
    price_or_performance: 'PRECO',
    origin: 'Rua Fictícia 100, Busan',
    porto_embarque: 'Busan, South Korea (KRPUS)',
    porto_destino: ['Santos, Brazil (BRSSZ)'],
    agente_define_porto_destino: 'false',
    product: 'Peças de reposição',
    carga_perigosa: 'NAO',
    stackability: 'true',
    carga_tombavel: 'false',
    carga_refrigerada: 'false',
    client_reference: 'PO-DEMO-0001',
    ...patch,
  };
}

const items = (snapshot: FormSnapshot) =>
  evaluateHardblocks(snapshot).blocks.map((block) => block.item);

test('uma cotação completa não tem hardblock', () => {
  assert.deepEqual(items(complete()), []);
});

test('formulário vazio: os dez itens "sempre" bloqueiam, na ordem da tela', () => {
  assert.deepEqual(items({}), [
    'tipo_cotacao',
    'service_type',
    'modal',
    'incoterm',
    'price_or_performance',
    'local_coleta',
    'product',
    'carga_perigosa',
    'stackability',
    'carga_tombavel',
    'client_reference',
  ]);
});

test('carga perigosa não tem resposta padrão: vazio bloqueia, Não libera', () => {
  assert.ok(items(complete({ carga_perigosa: '' })).includes('carga_perigosa'));
  assert.ok(
    !items(complete({ carga_perigosa: 'NAO' })).includes('carga_perigosa'),
  );
});

test('"Sim" sem classificação bloqueia com o motivo da classificação', () => {
  const report = evaluateHardblocks(complete({ carga_perigosa: 'SIM' }));
  const block = report.blocks.find((b) => b.item === 'carga_perigosa');
  assert.match(block?.reason ?? '', /classificação/);
});

test('empilhável e tombável bloqueiam sem resposta, e "Não" é resposta', () => {
  const blocked = items(complete({ stackability: '', carga_tombavel: '' }));
  assert.ok(blocked.includes('stackability'));
  assert.ok(blocked.includes('carga_tombavel'));
  assert.deepEqual(items(complete({ stackability: 'false' })), []);
});

test('local de coleta: obrigatório sempre, exceto FOB', () => {
  assert.ok(items(complete({ origin: '' })).includes('local_coleta'));
  assert.ok(
    !items(complete({ origin: '', incoterm: 'FOB' })).includes('local_coleta'),
  );
});

test('coleta a critério dos agentes não dispensa a coleta fora do FOB', () => {
  const report = evaluateHardblocks(
    complete({ origin: '', agente_define_local_coleta: 'true' }),
  );
  const block = report.blocks.find((b) => b.item === 'local_coleta');
  assert.match(block?.reason ?? '', /Desligue a opção/);
});

test('local de embarque: SÓ para FOB, e no campo do modal', () => {
  assert.ok(
    !items(complete({ porto_embarque: '' })).includes('local_embarque'),
  );
  const fob = evaluateHardblocks(
    complete({ incoterm: 'FOB', porto_embarque: '' }),
  );
  assert.deepEqual(
    fob.blocks.map((b) => [b.item, b.field]),
    [['local_embarque', 'porto_embarque']],
  );
  const air = evaluateHardblocks(
    complete({
      incoterm: 'FOB',
      modal: 'AEREO',
      aeroporto_embarque: '',
      aeroporto_destino: ['GRU'],
    }),
  );
  assert.deepEqual(
    air.blocks.map((b) => b.field),
    ['aeroporto_embarque'],
  );
});

test('local de desembarque: bloqueia vazio, a menos que os agentes decidam', () => {
  assert.ok(
    items(complete({ porto_destino: [] })).includes('local_desembarque'),
  );
  assert.deepEqual(
    items(complete({ porto_destino: [], agente_define_porto_destino: 'true' })),
    [],
  );
});

test('sem modal, embarque e desembarque não bloqueiam em dobro', () => {
  const blocked = items(
    complete({
      modal: '',
      incoterm: 'FOB',
      porto_embarque: '',
      porto_destino: [],
    }),
  );
  assert.ok(blocked.includes('modal'));
  assert.ok(!blocked.includes('local_embarque'));
  assert.ok(!blocked.includes('local_desembarque'));
});

test('endereço de entrega final e NCM: SÓ para DAP e DDP', () => {
  for (const incoterm of ['DAP', 'DDP']) {
    const blocked = items(complete({ incoterm, declared_value: '1000' }));
    assert.deepEqual(blocked, ['endereco_entrega_final', 'ncm'], incoterm);
  }
  for (const incoterm of ['FCA', 'CIF', 'EXW', 'CPT']) {
    const report = evaluateHardblocks(complete({ incoterm }));
    assert.equal(report.applies.deliveryAddress, false, incoterm);
    assert.equal(report.applies.ncm, false, incoterm);
  }
});

test('NCM precisa de 8 dígitos, com ou sem pontos', () => {
  const base = {
    incoterm: 'DDP',
    endereco_entrega_final: 'Av. Demo 1',
    declared_value: '10',
  };
  assert.deepEqual(items(complete({ ...base, ncm: '8517.62.77' })), []);
  assert.deepEqual(items(complete({ ...base, ncm: '8517' })), ['ncm']);
});

test('valor da carga: SÓ para DAP, DDP, CIP e CIF, e maior que zero', () => {
  for (const incoterm of ['CIP', 'CIF']) {
    assert.deepEqual(items(complete({ incoterm })), ['declared_value']);
    assert.deepEqual(
      items(complete({ incoterm, declared_value: '12.500,00' })),
      [],
    );
    assert.deepEqual(items(complete({ incoterm, declared_value: '0' })), [
      'declared_value',
    ]);
  }
  assert.equal(
    evaluateHardblocks(complete({ incoterm: 'FOB' })).applies.declaredValue,
    false,
  );
});

test('UN: SÓ para carga perigosa, no formato de 4 dígitos', () => {
  assert.equal(evaluateHardblocks(complete()).applies.unNumber, false);
  assert.deepEqual(items(complete({ carga_perigosa: 'IMO' })), ['un_number']);
  assert.deepEqual(
    items(complete({ carga_perigosa: 'IMO', un_number: 'UN1263' })),
    [],
  );
  assert.deepEqual(
    items(complete({ carga_perigosa: 'RA', un_number: '2915' })),
    [],
  );
  assert.deepEqual(
    items(complete({ carga_perigosa: 'IMO', un_number: 'UN12' })),
    ['un_number'],
  );
});

test('temperatura mínima: SÓ para carga refrigerada', () => {
  assert.deepEqual(items(complete({ carga_refrigerada: 'true' })), [
    'temperatura_min',
  ]);
  assert.deepEqual(
    items(complete({ carga_refrigerada: 'true', temperatura_min: '-18' })),
    [],
  );
  assert.deepEqual(items(complete({ temperatura_min: '' })), []);
});

test('trocar o incoterm revalida: o mesmo formulário ganha e perde itens', () => {
  const cif = complete({ incoterm: 'CIF' });
  assert.deepEqual(items(cif), ['declared_value']);
  assert.deepEqual(items({ ...cif, incoterm: 'FOB' }), []);
  assert.deepEqual(items({ ...cif, incoterm: 'FOB', porto_embarque: '' }), [
    'local_embarque',
  ]);
});

test('todo motivo diz o que fazer, e nenhum item aparece duas vezes', () => {
  const report = evaluateHardblocks({
    incoterm: 'DDP',
    carga_perigosa: 'SIM',
    carga_refrigerada: 'true',
    modal: 'MARITIMO',
  });
  const seen = new Set<string>();
  for (const block of report.blocks) {
    assert.ok(block.reason.length > 10, block.item);
    assert.ok(!seen.has(block.item), block.item);
    seen.add(block.item);
  }
});

test('parseAmount aceita formato brasileiro e recusa texto', () => {
  assert.equal(parseAmount('12.500,50'), 12500.5);
  assert.equal(parseAmount('12500.5'), 12500.5);
  assert.ok(Number.isNaN(parseAmount('doze mil')));
});

test('o contador concorda em número', () => {
  assert.equal(hardblockCountLabel(1), 'Falta 1 item');
  assert.equal(hardblockCountLabel(4), 'Faltam 4 itens');
});

test('na revisão, o snapshot enviado vale mais que o payload', () => {
  const payload = { modal: 'MARITIMO', incoterm: 'FCA' };
  assert.deepEqual(quotationHardblocks(complete(), payload).blocks, []);
  // Sem snapshot, o que o payload não traz (fator de escolha) bloqueia.
  const items = quotationHardblocks(undefined, payload).blocks.map(
    (b) => b.item,
  );
  assert.ok(items.includes('price_or_performance'));
});
