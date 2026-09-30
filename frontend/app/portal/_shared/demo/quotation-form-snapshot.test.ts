import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  diffSnapshots,
  draftPatchFromSnapshot,
  formatSnapshotValue,
  normalizeChanges,
  normalizeSnapshot,
  snapshotFromDraft,
  snapshotFromQuotation,
} from './quotation-form-snapshot.ts';

const draft = {
  values: {
    tipo_cotacao: 'REAL' as const,
    modal: 'MARITIMO' as const,
    incoterm: 'fob',
    price_or_performance: 'PRECO' as const,
    origin: 'Rua Fictícia 100',
    porto_destino: ['Santos, Brazil (BRSSZ)'],
    carga_perigosa: undefined,
    stackability: 'true' as const,
    ncm: '8517.62.77',
    data_prontidao: '2026-10-10',
  },
  equipments: [
    {
      quantity: 1,
      tipo_container: 'HIGH_CUBE_40',
      peso_bruto: 12000,
      peso_unidade: 'KG' as const,
      volume_m3: 60,
    },
  ],
  volumes: [],
  flags: { agenteDefineLocalColeta: false, cargaPerigosaDeclarada: true },
};

test('o snapshot do formulário guarda o que o payload não traz', () => {
  const snap = snapshotFromDraft(draft, 'Exportadora Demo');
  assert.equal(snap.price_or_performance, 'PRECO');
  assert.equal(snap.ncm, '8517.62.77');
  assert.equal(snap.incoterm, 'FOB');
  assert.equal(snap.supplier, 'Exportadora Demo');
  assert.equal(snap.carga_perigosa, 'SIM');
  assert.equal(snap.cargo, '1 item · 12000 kg · 60 m³');
});

test('coleta a critério dos agentes não guarda um endereço residual', () => {
  const snap = snapshotFromDraft({
    ...draft,
    flags: { agenteDefineLocalColeta: true },
  });
  assert.equal(snap.origin, '');
  assert.equal(snap.agente_define_local_coleta, 'true');
});

test('temperatura só entra com a carga refrigerada ligada', () => {
  const values = { ...draft.values, temperatura_min: '-18' };
  assert.equal(snapshotFromDraft({ ...draft, values }).temperatura_min, '');
  assert.equal(
    snapshotFromDraft({ ...draft, values, flags: { showRefrigerada: true } })
      .temperatura_min,
    '-18',
  );
});

test('o snapshot do payload não inventa o que o payload não tem', () => {
  const snap = snapshotFromQuotation({
    modal: 'AEREO',
    stackability: false,
    carga_perigosa: null,
    temperatura_min: -5,
  });
  assert.equal(snap.price_or_performance, '');
  assert.equal(snap.ncm, '');
  assert.equal(snap.stackability, 'false');
  assert.equal(snap.carga_perigosa, '');
  assert.equal(snap.carga_refrigerada, 'true');
});

test('o diff lista só o que mudou, na ordem do formulário', () => {
  const before = snapshotFromDraft(draft);
  const after = snapshotFromDraft({
    ...draft,
    values: { ...draft.values, incoterm: 'CIF', product: 'Placas' },
  });
  assert.deepEqual(diffSnapshots(before, after), [
    { field: 'incoterm', from: 'FOB', to: 'CIF' },
    { field: 'product', from: '', to: 'Placas' },
  ]);
  assert.deepEqual(diffSnapshots(before, before), []);
});

test('o diff não repete a chave "agentes decidam" do campo que ela governa', () => {
  const before = snapshotFromDraft(draft);
  const after = snapshotFromDraft({
    ...draft,
    values: { ...draft.values, porto_destino: [] },
    flags: { ...draft.flags, agenteDefinePortoDestino: true },
  });
  assert.deepEqual(
    diffSnapshots(before, after).map((change) => change.field),
    ['porto_destino'],
  );
});

test('os valores são lidos em português, e vazio nunca é branco', () => {
  assert.equal(formatSnapshotValue('price_or_performance', 'PRECO'), 'Preço');
  assert.equal(formatSnapshotValue('stackability', 'false'), 'Não');
  assert.equal(formatSnapshotValue('carga_perigosa', 'IMO'), 'Sim · IMO');
  assert.equal(formatSnapshotValue('product', ''), 'não informado');
  assert.equal(
    formatSnapshotValue('porto_destino', ['Santos', 'Itajaí']),
    'Santos · Itajaí',
  );
});

test('o snapshot restaura só o que tem valor, e as chaves do formulário', () => {
  const patch = draftPatchFromSnapshot(snapshotFromDraft(draft));
  assert.equal(patch.values.price_or_performance, 'PRECO');
  assert.equal(patch.values.ncm, '8517.62.77');
  assert.equal('endereco_entrega_final' in patch.values, false);
  assert.deepEqual(patch.flags, { cargaPerigosaDeclarada: true });
});

test('dado gravado por outra versão é saneado, não confiado', () => {
  assert.equal(normalizeSnapshot('lixo'), null);
  assert.deepEqual(
    normalizeSnapshot({ incoterm: 'FOB', estranho: 'x', modal: 3 }),
    {
      incoterm: 'FOB',
    },
  );
  assert.deepEqual(
    normalizeChanges([
      { field: 'incoterm', from: 'FOB', to: 'CIF' },
      { field: 'inexistente', from: 'a', to: 'b' },
      { field: 'modal', from: 1, to: 'AEREO' },
    ]),
    [{ field: 'incoterm', from: 'FOB', to: 'CIF' }],
  );
});
