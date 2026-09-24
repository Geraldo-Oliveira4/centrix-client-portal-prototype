// Unit test da jornada "novo embarque a partir do PO". Mesmo runner:
//
//     npm run test:unit
//
// O QUE ERRA EM SILENCIO AQUI:
//
//   1. O historico sumindo no reenvio, como na Cotacao V2. O motivo da
//      devolucao precisa continuar legivel depois de o cliente corrigir.
//   2. O dedup nao normalizar. "po 2026/1183" e "PO-2026-1183" sao o mesmo
//      pedido, e um dedup que so compara texto cru deixa passar o duplicado
//      que ele existe para pegar.
//   3. Salvar rascunho reiniciando o relogio da revisao. O cliente que salva
//      duas vezes enquanto corrige empurraria a autorresposta para sempre.
//   4. Uma referencia de PO colidindo com o seed (EMB-2026-0001..0013).

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  EMPTY_PO_DATA,
  PO_AUTO_ADVANCE_STAGES,
  PO_CLIENT_ACTION_STAGES,
  PO_REFERENCE_BASE,
  PO_STAGE_DESCRIPTIONS,
  PO_STAGE_LABELS,
  applyPoAutoAdvance,
  cancel,
  countPoInReview,
  createDraft,
  findDuplicatePo,
  isPoDraft,
  linkQuotation,
  msUntilPoAutoAdvance,
  nextPoReference,
  normalizePo,
  normalizeShipmentPoStore,
  parseShipmentPoStore,
  poIdsAtStage,
  resubmit,
  returnToClient,
  saveDraft,
  submitToFreitas,
  validate,
  type DuplicateCandidate,
  type PoStage,
  type ShipmentPoStore,
} from './shipment-po-review.ts';

const T0 = '2026-09-24T10:00:00.000Z';
const T1 = '2026-09-24T11:00:00.000Z';
const T2 = '2026-09-24T12:00:00.000Z';
const T3 = '2026-09-24T13:00:00.000Z';

const draft = () => createDraft('EMB-2026-0101', 'po', T0);

test('as quatro etapas tem rotulo e descricao', () => {
  const stages = Object.keys(PO_STAGE_LABELS) as PoStage[];
  assert.equal(stages.length, 4);
  for (const stage of stages) {
    assert.ok(PO_STAGE_LABELS[stage]?.length, `${stage} sem rotulo`);
    assert.ok(PO_STAGE_DESCRIPTIONS[stage]?.length, `${stage} sem descricao`);
  }
});

test('o rascunho nasce vazio e nao aparece na carteira', () => {
  const r = draft();
  assert.equal(r.stage, 'draft');
  assert.equal(isPoDraft(r), true);
  assert.deepEqual(r.data, EMPTY_PO_DATA);
  assert.deepEqual(
    r.history.map((e) => e.kind),
    ['created'],
  );
});

test('o caminho feliz: rascunho -> em analise -> ativo', () => {
  let r = draft();
  r = submitToFreitas(r, T1);
  assert.equal(r.stage, 'awaiting_review');
  assert.equal(r.stageEnteredAt, T1);

  r = validate(r, T2);
  assert.equal(r.stage, 'active');
  assert.deepEqual(
    r.history.map((e) => e.kind),
    ['created', 'submitted', 'validated'],
  );
});

test('salvar rascunho NAO move a etapa nem reinicia o relogio da revisao', () => {
  const sent = submitToFreitas(draft(), T1);
  const saved = saveDraft(sent, { clientRef: 'REF-1' }, T2);
  assert.equal(saved.stage, 'awaiting_review');
  assert.equal(saved.stageEnteredAt, T1, 'o relogio da revisao nao pode andar');
  assert.equal(saved.data.clientRef, 'REF-1');
  assert.equal(saved.history.at(-1)?.kind, 'saved');
});

test('salvar preserva os campos que nao foram tocados', () => {
  const r = saveDraft(
    saveDraft(draft(), { clientRef: 'REF-1', exporter: 'Exp' }, T1),
    { clientRef: 'REF-2' },
    T2,
  );
  assert.equal(r.data.clientRef, 'REF-2');
  assert.equal(r.data.exporter, 'Exp');
});

test('devolver grava motivo E campos a corrigir', () => {
  const r = returnToClient(
    submitToFreitas(draft(), T1),
    '  Peso bruto divergente do PO  ',
    ['grossWeightKg', 'items', 'items'],
    T2,
  );
  assert.equal(r.stage, 'returned');
  assert.equal(r.returnReason, 'Peso bruto divergente do PO');
  assert.deepEqual(r.fieldsToFix, ['grossWeightKg', 'items']);
  assert.deepEqual(r.history.at(-1)?.fields, ['grossWeightKg', 'items']);
});

test('devolucao sem motivo nao acontece', () => {
  const before = submitToFreitas(draft(), T1);
  assert.deepEqual(returnToClient(before, '   ', ['items'], T2), before);
});

test('o reenvio preserva o historico e limpa motivo e campos', () => {
  let r = submitToFreitas(draft(), T1);
  r = returnToClient(r, 'Falta o exportador', ['exporter'], T2);
  r = resubmit(r, T3);

  assert.equal(r.stage, 'awaiting_review');
  assert.equal(r.returnReason, undefined);
  assert.deepEqual(r.fieldsToFix, []);
  assert.deepEqual(
    r.history.map((e) => e.kind),
    ['created', 'submitted', 'returned', 'resubmitted'],
  );
  assert.equal(r.history[2].reason, 'Falta o exportador');
  assert.deepEqual(r.history[2].fields, ['exporter']);
});

test('cancelar volta ao rascunho e some da carteira', () => {
  const r = cancel(submitToFreitas(draft(), T1), T2);
  assert.equal(r.stage, 'draft');
  assert.equal(isPoDraft(r), true);
  assert.equal(r.history.at(-1)?.kind, 'cancelled');
});

test('vincular cotacao guarda o id e registra o evento', () => {
  const r = linkQuotation(validate(submitToFreitas(draft(), T1), T2), 'cot-9', T3);
  assert.equal(r.linkedQuotationId, 'cot-9');
  assert.equal(r.stage, 'active', 'vincular nao muda a etapa');
  assert.equal(r.history.at(-1)?.quotationId, 'cot-9');
});

test('vincular sem id nao faz nada', () => {
  const before = validate(submitToFreitas(draft(), T1), T2);
  assert.deepEqual(linkQuotation(before, '', T3), before);
});

// ---------------------------------------------------------------------------
// dedup (RQ-5)
// ---------------------------------------------------------------------------

test('a normalizacao do PO ignora caixa, acento, espaco e separador', () => {
  const key = normalizePo('PO-2026-1183');
  for (const variant of [
    'po-2026-1183',
    'PO 2026 1183',
    'po 2026/1183',
    '  PO2026.1183 ',
    'Pó-2026-1183',
  ]) {
    assert.equal(normalizePo(variant), key, variant);
  }
});

const CANDIDATES: DuplicateCandidate[] = [
  {
    id: 'ship-1',
    reference: 'EMB-2026-0001',
    route: 'Xangai → Santos',
    createdAt: '2026-09-12',
    stateLabel: 'Em trânsito',
    poNumbers: ['PO-2026-1183'],
  },
  {
    id: 'ship-2',
    reference: 'EMB-2026-0002',
    route: 'Busan → Santos',
    createdAt: '2026-09-10',
    stateLabel: 'Solicitado',
    poNumbers: ['PO-2026-1186', 'PO-2026-1187'],
  },
];

test('acha o embarque existente mesmo com o PO escrito de outro jeito', () => {
  assert.equal(findDuplicatePo('po 2026/1183', CANDIDATES)?.id, 'ship-1');
  assert.equal(findDuplicatePo('PO-2026-1187', CANDIDATES)?.id, 'ship-2');
});

test('PO novo nao acusa duplicado; PO vazio tambem nao', () => {
  assert.equal(findDuplicatePo('PO-2026-9999', CANDIDATES), null);
  assert.equal(findDuplicatePo('', CANDIDATES), null);
  assert.equal(findDuplicatePo('   ', CANDIDATES), null);
});

test('o proprio embarque nao conta como duplicado de si mesmo', () => {
  assert.equal(findDuplicatePo('PO-2026-1183', CANDIDATES, 'ship-1'), null);
});

// ---------------------------------------------------------------------------
// referencias
// ---------------------------------------------------------------------------

test('a primeira referencia de PO comeca fora da faixa do seed', () => {
  assert.ok(PO_REFERENCE_BASE > 13, 'o seed vai ate EMB-2026-0013');
  assert.equal(nextPoReference({}), 'EMB-2026-0101');
});

test('nao colide com o que ja existe, no overlay nem no backend', () => {
  const store: ShipmentPoStore = { a: createDraft('EMB-2026-0101', 'po', T0) };
  assert.equal(nextPoReference(store), 'EMB-2026-0102');
  assert.equal(
    nextPoReference(store, ['EMB-2026-0102', 'EMB-2026-0103']),
    'EMB-2026-0104',
  );
  // Uma referencia do seed nunca e reutilizada.
  assert.equal(nextPoReference({}, ['EMB-2026-0001']), 'EMB-2026-0101');
});

// ---------------------------------------------------------------------------
// contagem e autorresposta
// ---------------------------------------------------------------------------

test('"Em analise" conta em revisao E devolvido, nunca rascunho ou ativo', () => {
  const store: ShipmentPoStore = {
    a: draft(),
    b: submitToFreitas(draft(), T1),
    c: returnToClient(submitToFreitas(draft(), T1), 'motivo', [], T2),
    d: validate(submitToFreitas(draft(), T1), T2),
  };
  assert.equal(countPoInReview(store), 2);
  assert.deepEqual(poIdsAtStage(store, 'draft'), ['a']);
  assert.deepEqual(poIdsAtStage(store, 'active'), ['d']);
});

test('as etapas do cliente e as automaticas nao se cruzam', () => {
  for (const stage of PO_AUTO_ADVANCE_STAGES) {
    assert.equal(PO_CLIENT_ACTION_STAGES.includes(stage), false, stage);
  }
});

test('o tempo restante sai do stageEnteredAt e sobrevive a um reload', () => {
  const r = submitToFreitas(draft(), '2026-09-24T10:00:00.000Z');
  assert.equal(
    msUntilPoAutoAdvance(r, 8, Date.parse('2026-09-24T10:00:03.000Z')),
    5000,
  );
  assert.equal(
    msUntilPoAutoAdvance(r, 8, Date.parse('2026-09-24T10:00:30.000Z')),
    0,
  );
});

test('so "em analise" avanca sozinho; devolvido NUNCA', () => {
  const now = Date.parse(T3);
  assert.equal(msUntilPoAutoAdvance(draft(), 8, now), null);
  assert.equal(
    msUntilPoAutoAdvance(
      returnToClient(submitToFreitas(draft(), T1), 'x', [], T2),
      8,
      now,
    ),
    null,
  );
  assert.equal(
    msUntilPoAutoAdvance(validate(submitToFreitas(draft(), T1), T2), 8, now),
    null,
  );
});

test('data de entrada no futuro espera o atraso inteiro', () => {
  const r = submitToFreitas(draft(), '2026-09-24T10:00:10.000Z');
  assert.equal(
    msUntilPoAutoAdvance(r, 8, Date.parse('2026-09-24T10:00:00.000Z')),
    8000,
  );
});

test('a autorresposta so valida, e para no ativo', () => {
  let r = submitToFreitas(draft(), T1);
  r = applyPoAutoAdvance(r, T2);
  assert.equal(r.stage, 'active');
  const again = applyPoAutoAdvance(r, T3);
  assert.deepEqual(again, r, 'ativo nao avanca mais');
});

// ---------------------------------------------------------------------------
// leitura do disco
// ---------------------------------------------------------------------------

test('ausente ou corrompido vira "nenhum overlay"', () => {
  assert.deepEqual(parseShipmentPoStore(null), {});
  assert.deepEqual(parseShipmentPoStore('{nao e json'), {});
  assert.deepEqual(parseShipmentPoStore('[]'), {});
});

test('entrada com etapa desconhecida ou sem referencia e DESCARTADA', () => {
  const store = normalizeShipmentPoStore({
    boa: { stage: 'awaiting_review', reference: 'EMB-2026-0101', history: [] },
    semRef: { stage: 'draft', history: [] },
    etapaRuim: { stage: 'em_revisao', reference: 'EMB-2026-0102', history: [] },
    lixo: 7,
  });
  assert.deepEqual(Object.keys(store), ['boa']);
});

test('item malformado perde o item, nao a entrada', () => {
  const store = normalizeShipmentPoStore({
    q: {
      stage: 'draft',
      reference: 'EMB-2026-0101',
      history: [],
      data: {
        poNumbers: ['PO-1', 42],
        items: [{ id: 'i1', partNumber: 'A', quantity: 2 }, null, { foo: 1 }],
      },
    },
  });
  assert.deepEqual(store.q.data.poNumbers, ['PO-1']);
  assert.equal(store.q.data.items.length, 1);
  assert.equal(store.q.data.items[0].quantity, 2);
  assert.equal(store.q.data.items[0].unitValue, null);
});

test('o que foi gravado sobrevive ao ciclo completo', () => {
  const store: ShipmentPoStore = {
    s1: linkQuotation(
      validate(
        submitToFreitas(
          saveDraft(
            draft(),
            {
              poNumbers: ['PO-2026-1183'],
              clientRef: 'SENSE-0924',
              items: [
                {
                  id: 'i1',
                  partNumber: 'SP-4410',
                  description: 'Sensor',
                  currency: 'USD',
                  quantity: 200,
                  unitValue: 86,
                  netWeightKg: 520,
                  totalValue: 17200,
                  grossWeightKg: 580,
                },
              ],
            },
            T1,
          ),
          T2,
        ),
        T3,
      ),
      'cot-1',
      T3,
    ),
  };
  assert.deepEqual(parseShipmentPoStore(JSON.stringify(store)), store);
});
