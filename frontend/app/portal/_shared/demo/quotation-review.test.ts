// Unit test da maquina de estados da Cotacao V2. Mesmo runner dos outros libs:
//
//     npm run test:unit
//
// O QUE ERRA EM SILENCIO AQUI, e por isso e testado:
//
//   1. O historico sumindo no reenvio. RQ-5 diz que a cotacao devolvida volta a
//      revisao "com o historico preservado" — e o jeito natural de limpar o
//      motivo da devolucao e recriar a entrada, que leva o historico junto.
//   2. O contador de "aguardando sua acao" incluindo as etapas que a FREITAS
//      esta segurando. O cliente nao pode agir sobre `entry_review`; conta-lo
//      seria cobrar dele uma acao que a tela nao oferece.
//   3. O merge deixando passar proposta nao liberada. E a regra do RQ-17, e no
//      protótipo ela existe SO aqui — nao ha API que a sustente.
//   4. Cotacao SEM overlay mudando de comportamento. E o que mantem a Onda 0
//      intacta; se o merge mexer nela, o fluxo atual quebra com a flag
//      desligada.
//   5. A autorresposta recontando do zero a cada reload, por cronometrar a
//      montagem em vez do `stageEnteredAt`.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  V2_AUTO_ADVANCE_STAGES,
  V2_CLIENT_ACTION_STAGES,
  V2_STAGE_COLUMN,
  V2_STAGE_DESCRIPTIONS,
  V2_STAGE_LABELS,
  applyAutoAdvance,
  approveEntry,
  approveQuotation,
  autoAdvanceTarget,
  countV2ClientActions,
  createReview,
  mergeQuotationV2,
  msUntilAutoAdvance,
  normalizeQuotationReviewStore,
  parseQuotationReviewStore,
  quotationIdsAtStage,
  quotesArrived,
  releaseProposals,
  resetToDraft,
  resubmit,
  returnToClient,
  submitToFreitas,
  type QuotationReview,
  type QuotationReviewStore,
  type V2Stage,
} from './quotation-review.ts';

const T0 = '2026-09-24T10:00:00.000Z';
const T1 = '2026-09-24T11:00:00.000Z';
const T2 = '2026-09-24T12:00:00.000Z';
const T3 = '2026-09-24T13:00:00.000Z';
const T4 = '2026-09-24T14:00:00.000Z';

const quotation = (proposalIds: string[]) => ({
  id: 'q1',
  reference: 'COT-2026-0001',
  proposals: proposalIds.map((id) => ({ id })),
});

test('toda etapa tem rotulo, descricao e coluna', () => {
  const stages = Object.keys(V2_STAGE_COLUMN) as V2Stage[];
  assert.equal(stages.length, 7);
  for (const stage of stages) {
    assert.ok(V2_STAGE_LABELS[stage]?.length, `${stage} sem rotulo`);
    assert.ok(V2_STAGE_DESCRIPTIONS[stage]?.length, `${stage} sem descricao`);
  }
});

test('as duas revisoes dividem o selo e se distinguem pela frase', () => {
  assert.equal(V2_STAGE_LABELS.entry_review, V2_STAGE_LABELS.exit_review);
  assert.notEqual(
    V2_STAGE_DESCRIPTIONS.entry_review,
    V2_STAGE_DESCRIPTIONS.exit_review,
  );
  // O texto da revisao de saida e o que o portal ja usa para esse estado.
  assert.equal(
    V2_STAGE_DESCRIPTIONS.exit_review,
    'A comparação ainda não está liberada',
  );
});

test('revisao nunca vira coluna: as etapas do funil cabem nas tres de hoje', () => {
  assert.deepEqual(
    Array.from(new Set(Object.values(V2_STAGE_COLUMN)))
      .filter((column) => column != null)
      .sort(),
    ['aguardando_aprovacao', 'aguardando_dados', 'buscando_propostas'],
  );
  // `approved` NAO tem coluna: o funil e trabalho em curso, e uma cotacao
  // aprovada saiu dele — ela vive na aba "Aprovadas", como qualquer cotacao
  // que o backend fechou.
  assert.equal(V2_STAGE_COLUMN.approved, null);
  assert.equal(V2_STAGE_COLUMN.entry_review, 'buscando_propostas');
  assert.equal(V2_STAGE_COLUMN.exit_review, 'buscando_propostas');
  assert.equal(V2_STAGE_COLUMN.returned, 'aguardando_dados');
  assert.equal(V2_STAGE_COLUMN.released, 'aguardando_aprovacao');
});

test('o caminho feliz: rascunho -> revisao -> agentes -> revisao -> liberada', () => {
  let r = createReview(T0);
  assert.equal(r.stage, 'draft');

  r = submitToFreitas(r, T1);
  assert.equal(r.stage, 'entry_review');
  assert.equal(r.stageEnteredAt, T1);

  r = approveEntry(r, T2);
  assert.equal(r.stage, 'awaiting_quotes');

  r = quotesArrived(r, T3);
  assert.equal(r.stage, 'exit_review');

  r = releaseProposals(r, ['p1', 'p2'], T4);
  assert.equal(r.stage, 'released');
  assert.deepEqual(r.releasedProposalIds, ['p1', 'p2']);
  assert.deepEqual(
    r.history.map((e) => e.kind),
    ['submitted', 'entry_approved', 'quotes_arrived', 'proposals_released'],
  );
});

test('devolver grava o motivo e volta para "Preencher detalhes"', () => {
  const r = returnToClient(
    submitToFreitas(createReview(T0), T1),
    '  Peso divergente da invoice  ',
    T2,
  );
  assert.equal(r.stage, 'returned');
  assert.equal(r.returnReason, 'Peso divergente da invoice');
  assert.equal(V2_STAGE_COLUMN[r.stage], 'aguardando_dados');
  assert.equal(r.history.at(-1)?.reason, 'Peso divergente da invoice');
});

test('devolucao sem motivo nao acontece — o motivo e obrigatorio', () => {
  const before = submitToFreitas(createReview(T0), T1);
  assert.deepEqual(returnToClient(before, '   ', T2), before);
  assert.deepEqual(returnToClient(before, '', T2), before);
});

test('o reenvio preserva o historico e limpa so o motivo (RQ-5)', () => {
  let r = submitToFreitas(createReview(T0), T1);
  r = returnToClient(r, 'Falta packing list', T2);
  r = resubmit(r, T3);

  assert.equal(r.stage, 'entry_review');
  assert.equal(r.returnReason, undefined);
  assert.deepEqual(
    r.history.map((e) => e.kind),
    ['submitted', 'returned', 'resubmitted'],
  );
  // O motivo continua legivel no historico, que e o que "preservado" quer dizer.
  assert.equal(r.history[1].reason, 'Falta packing list');
});

test('enviar de uma devolvida ja registra reenvio, nao um primeiro envio', () => {
  let r = submitToFreitas(createReview(T0), T1);
  r = returnToClient(r, 'NCM incompatível com a descrição', T2);
  r = submitToFreitas(r, T3);
  assert.equal(r.history.at(-1)?.kind, 'resubmitted');
});

test('duas devolucoes seguidas empilham no historico', () => {
  let r = submitToFreitas(createReview(T0), T1);
  r = returnToClient(r, 'Primeiro motivo', T2);
  r = resubmit(r, T3);
  r = returnToClient(r, 'Segundo motivo', T4);
  assert.equal(r.returnReason, 'Segundo motivo');
  assert.equal(r.history.filter((e) => e.kind === 'returned').length, 2);
});

test('liberar nada nao libera: a comparacao nao abre vazia', () => {
  const before = quotesArrived(
    approveEntry(submitToFreitas(createReview(T0), T1), T2),
    T3,
  );
  assert.deepEqual(releaseProposals(before, [], T4), before);
  assert.deepEqual(releaseProposals(before, ['', ''], T4), before);
});

test('ids repetidos viram um so — a contagem do aviso bate com as linhas', () => {
  const r = releaseProposals(createReview(T0), ['p1', 'p1', 'p2'], T1);
  assert.deepEqual(r.releasedProposalIds, ['p1', 'p2']);
  assert.equal(r.history.at(-1)?.releasedCount, 2);
});

test('o reset volta ao rascunho, larga a liberacao e guarda o historico', () => {
  let r = releaseProposals(createReview(T0), ['p1'], T1);
  r = resetToDraft(r, T2);
  assert.equal(r.stage, 'draft');
  assert.equal(r.releasedProposalIds, undefined);
  assert.equal(r.returnReason, undefined);
  assert.equal(r.history.at(-1)?.kind, 'reset');
  assert.ok(r.history.length > 1);
});

// ---------------------------------------------------------------------------
// merge
// ---------------------------------------------------------------------------

test('SEM overlay nada muda — e o que mantem a Onda 0 intacta', () => {
  const q = quotation(['p1', 'p2', 'p3']);
  const merged = mergeQuotationV2(q, null);
  assert.equal(merged.review, null);
  assert.equal(merged.stage, null);
  assert.equal(merged.column, null);
  assert.equal(merged.proposalsFiltered, false);
  assert.equal(merged.returnReason, null);
  // A MESMA lista, nao uma copia filtrada.
  assert.equal(merged.visibleProposals, q.proposals);
});

test('so as propostas liberadas aparecem (RQ-17)', () => {
  const q = quotation(['p1', 'p2', 'p3']);
  const review = releaseProposals(createReview(T0), ['p1', 'p3'], T1);
  const merged = mergeQuotationV2(q, review);
  assert.deepEqual(
    merged.visibleProposals.map((p) => p.id),
    ['p1', 'p3'],
  );
  assert.equal(merged.proposalsFiltered, true);
  assert.equal(merged.column, 'aguardando_aprovacao');
});

test('antes da liberacao NENHUMA proposta e visivel, mesmo existindo', () => {
  const q = quotation(['p1', 'p2']);
  for (const review of [
    createReview(T0),
    submitToFreitas(createReview(T0), T1),
    quotesArrived(approveEntry(submitToFreitas(createReview(T0), T1), T2), T3),
  ]) {
    const merged = mergeQuotationV2(q, review);
    assert.deepEqual(merged.visibleProposals, [], review.stage);
    assert.equal(merged.proposalsFiltered, true, review.stage);
  }
});

test('liberar TODAS nao conta como filtrado', () => {
  const merged = mergeQuotationV2(
    quotation(['p1', 'p2']),
    releaseProposals(createReview(T0), ['p1', 'p2'], T1),
  );
  assert.equal(merged.proposalsFiltered, false);
});

test('proposta liberada que sumiu do payload nao inventa linha', () => {
  const merged = mergeQuotationV2(
    quotation(['p1']),
    releaseProposals(createReview(T0), ['p1', 'p9'], T1),
  );
  assert.deepEqual(
    merged.visibleProposals.map((p) => p.id),
    ['p1'],
  );
});

test('cotacao sem propostas no payload nao estoura o merge', () => {
  const merged = mergeQuotationV2({ id: 'q1' }, createReview(T0));
  assert.deepEqual(merged.visibleProposals, []);
});

// ---------------------------------------------------------------------------
// contador (RQ-6)
// ---------------------------------------------------------------------------

test('o contador conta SO rascunho, devolvida e liberada', () => {
  assert.deepEqual(V2_CLIENT_ACTION_STAGES, ['draft', 'returned', 'released']);
  const store: QuotationReviewStore = {
    a: createReview(T0),
    b: returnToClient(submitToFreitas(createReview(T0), T1), 'motivo', T2),
    c: releaseProposals(createReview(T0), ['p1'], T1),
    d: submitToFreitas(createReview(T0), T1),
    e: approveEntry(submitToFreitas(createReview(T0), T1), T2),
    f: quotesArrived(approveEntry(submitToFreitas(createReview(T0), T1), T2), T3),
  };
  assert.equal(countV2ClientActions(store), 3);
});

test('as tres etapas que a Freitas segura NAO contam', () => {
  for (const stage of V2_AUTO_ADVANCE_STAGES) {
    assert.equal(
      V2_CLIENT_ACTION_STAGES.includes(stage),
      false,
      `${stage} nao pode contar como acao do cliente`,
    );
  }
});

test('store vazio conta zero', () => {
  assert.equal(countV2ClientActions({}), 0);
});

test('quotationIdsAtStage lista so a etapa pedida', () => {
  const store: QuotationReviewStore = {
    a: submitToFreitas(createReview(T0), T1),
    b: submitToFreitas(createReview(T0), T1),
    c: createReview(T0),
  };
  assert.deepEqual(quotationIdsAtStage(store, 'entry_review').sort(), ['a', 'b']);
  assert.deepEqual(quotationIdsAtStage(store, 'released'), []);
});

// ---------------------------------------------------------------------------
// autorresposta
// ---------------------------------------------------------------------------

const at = (iso: string) => Date.parse(iso);

test('o tempo restante sai do stageEnteredAt, nao de um cronometro', () => {
  const r = submitToFreitas(createReview(T0), '2026-09-24T10:00:00.000Z');
  // 8s de atraso, 3s ja decorridos.
  assert.equal(
    msUntilAutoAdvance(r, 8, at('2026-09-24T10:00:03.000Z')),
    5000,
  );
  // Reload cinco segundos depois: ainda 0, nao 8s de novo.
  assert.equal(msUntilAutoAdvance(r, 8, at('2026-09-24T10:00:09.000Z')), 0);
});

test('etapa que nao avanca sozinha devolve null', () => {
  for (const r of [
    createReview(T0),
    returnToClient(submitToFreitas(createReview(T0), T1), 'motivo', T2),
    releaseProposals(createReview(T0), ['p1'], T1),
  ]) {
    assert.equal(msUntilAutoAdvance(r, 8, at(T4)), null, r.stage);
  }
});

test('data de entrada no futuro espera o atraso inteiro, nao dispara na hora', () => {
  const r = submitToFreitas(createReview(T0), '2026-09-24T10:00:10.000Z');
  assert.equal(
    msUntilAutoAdvance(r, 8, at('2026-09-24T10:00:00.000Z')),
    8000,
  );
});

test('data de entrada ilegivel vence agora, em vez de travar a etapa', () => {
  const r: QuotationReview = {
    ...submitToFreitas(createReview(T0), T1),
    stageEnteredAt: 'nao e uma data',
  };
  assert.equal(msUntilAutoAdvance(r, 8, at(T4)), 0);
});

test('a autorresposta anda revisao -> agentes -> revisao -> liberada, e para', () => {
  assert.equal(autoAdvanceTarget('entry_review'), 'awaiting_quotes');
  assert.equal(autoAdvanceTarget('awaiting_quotes'), 'exit_review');
  assert.equal(autoAdvanceTarget('exit_review'), 'released');
  assert.equal(autoAdvanceTarget('released'), null);
  assert.equal(autoAdvanceTarget('draft'), null);
  // Devolver NUNCA e automatico.
  assert.equal(autoAdvanceTarget('returned'), null);
});

test('applyAutoAdvance aplica um passo por vez', () => {
  let r = submitToFreitas(createReview(T0), T1);
  r = applyAutoAdvance(r, ['p1'], T2);
  assert.equal(r.stage, 'awaiting_quotes');
  r = applyAutoAdvance(r, ['p1'], T3);
  assert.equal(r.stage, 'exit_review');
  r = applyAutoAdvance(r, ['p1', 'p2'], T4);
  assert.equal(r.stage, 'released');
  assert.deepEqual(r.releasedProposalIds, ['p1', 'p2']);
});

test('sem propostas, a autorresposta FICA na revisao de saida', () => {
  const before = quotesArrived(
    approveEntry(submitToFreitas(createReview(T0), T1), T2),
    T3,
  );
  const after = applyAutoAdvance(before, [], T4);
  assert.equal(after.stage, 'exit_review');
  assert.deepEqual(after, before);
});

// ---------------------------------------------------------------------------
// leitura do disco
// ---------------------------------------------------------------------------

test('ausente ou corrompido vira "nenhum overlay", que e o estado seguro', () => {
  assert.deepEqual(parseQuotationReviewStore(null), {});
  assert.deepEqual(parseQuotationReviewStore('{nao e json'), {});
  assert.deepEqual(parseQuotationReviewStore('[]'), {});
  assert.deepEqual(parseQuotationReviewStore('"texto"'), {});
});

test('entrada com etapa desconhecida e DESCARTADA, nao consertada', () => {
  const store = normalizeQuotationReviewStore({
    boa: { stage: 'entry_review', stageEnteredAt: T1, history: [] },
    ruim: { stage: 'review', stageEnteredAt: T1, history: [] },
    lixo: 42,
  });
  assert.deepEqual(Object.keys(store), ['boa']);
});

test('historico com evento malformado perde o evento, nao a entrada', () => {
  const store = normalizeQuotationReviewStore({
    q: {
      stage: 'returned',
      stageEnteredAt: T2,
      returnReason: 'motivo',
      history: [{ kind: 'submitted', at: T1 }, null, { at: T2 }, 'texto'],
    },
  });
  assert.equal(store.q.history.length, 1);
  assert.equal(store.q.returnReason, 'motivo');
});

test('o que foi gravado sobrevive ao ciclo completo', () => {
  const store: QuotationReviewStore = {
    q1: releaseProposals(
      quotesArrived(approveEntry(submitToFreitas(createReview(T0), T1), T2), T3),
      ['p1', 'p2'],
      T4,
    ),
  };
  assert.deepEqual(parseQuotationReviewStore(JSON.stringify(store)), store);
});

// ---------------------------------------------------------------------------
// aprovacao simulada (RQ-18)
// ---------------------------------------------------------------------------

const releasedReview = () =>
  releaseProposals(
    quotesArrived(approveEntry(submitToFreitas(createReview(T0), T1), T2), T3),
    ['p1', 'p2'],
    T4,
  );

test('aprovar leva de "liberada" a "aprovada" e guarda a proposta escolhida', () => {
  const r = approveQuotation(releasedReview(), 'p1', '2026-09-24T15:00:00.000Z');
  assert.equal(r.stage, 'approved');
  assert.equal(r.approvedProposalId, 'p1');
  assert.equal(r.history.at(-1)?.kind, 'approved');
  assert.equal(r.history.at(-1)?.proposalId, 'p1');
});

test('so uma cotacao LIBERADA pode ser aprovada', () => {
  for (const before of [
    createReview(T0),
    submitToFreitas(createReview(T0), T1),
    quotesArrived(approveEntry(submitToFreitas(createReview(T0), T1), T2), T3),
  ]) {
    assert.deepEqual(approveQuotation(before, 'p1', T4), before, before.stage);
  }
});

test('aprovar sem proposta nao faz nada', () => {
  const before = releasedReview();
  assert.deepEqual(approveQuotation(before, '', T4), before);
});

test('aprovar duas vezes nao empilha', () => {
  const once = approveQuotation(releasedReview(), 'p1', T4);
  assert.deepEqual(approveQuotation(once, 'p2', T4), once);
});

test('a cotacao aprovada CONTINUA mostrando as propostas liberadas', () => {
  // O cliente precisa reabrir a comparacao e rever o que escolheu.
  const merged = mergeQuotationV2(
    quotation(['p1', 'p2', 'p3']),
    approveQuotation(releasedReview(), 'p1', T4),
  );
  assert.deepEqual(
    merged.visibleProposals.map((p) => p.id),
    ['p1', 'p2'],
  );
  assert.equal(merged.column, null, 'aprovada sai do funil');
});

test('o reset larga a proposta aprovada junto com a liberacao', () => {
  const r = resetToDraft(approveQuotation(releasedReview(), 'p1', T4), T4);
  assert.equal(r.stage, 'draft');
  assert.equal(r.approvedProposalId, undefined);
  assert.equal(r.releasedProposalIds, undefined);
});

test('a aprovacao sobrevive ao ciclo de disco', () => {
  const store: QuotationReviewStore = {
    q1: approveQuotation(releasedReview(), 'p1', T4),
  };
  assert.deepEqual(parseQuotationReviewStore(JSON.stringify(store)), store);
});

test('aprovada NAO conta como "aguardando sua acao"', () => {
  // A bola nao esta mais com o cliente: ele ja decidiu.
  assert.equal(
    countV2ClientActions({ q1: approveQuotation(releasedReview(), 'p1', T4) }),
    0,
  );
});
