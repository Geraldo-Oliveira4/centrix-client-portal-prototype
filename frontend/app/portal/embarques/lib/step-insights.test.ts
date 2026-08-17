// Unit test do enriquecimento por etapa. Mesmo runner dos outros libs:
//
//     npm run test:unit
//
// Existe por causa de UMA regra que não falha alto: onde a companhia já
// publicou as duas previsões, o risco da etapa tem de repetir a aritmética do
// badge do topo da tela, não ter opinião própria. Um bug aqui não estoura — ele
// só imprime "risco baixo" embaixo de "Atraso, +5 dias", que é a contradição
// que a tela inteira foi desenhada para não cometer.

import test from 'node:test';
import assert from 'node:assert/strict';

import { delayRiskFromTracking } from './delay-risk.ts';
import { buildStepInsights, STEP_RISK_TONE } from './step-insights.ts';
import { buildTimelineSteps } from './timeline-steps.ts';

const REAL_STEPS = [
  { key: 'solicitado', label: 'Solicitado', description: '' },
  { key: 'aguardando_prontidao', label: 'Aguardando prontidão', description: '' },
  { key: 'coletado', label: 'Coletado', description: '' },
  { key: 'analise_booking', label: 'Em análise de booking', description: '' },
  { key: 'embarcado', label: 'Embarcado', description: '' },
];

const REFERENCIA = 'EMB-2026-0001';

const tracking = (overrides = {}) => ({
  first_eta: null,
  current_eta: null,
  eta_is_actual: null,
  data_status: null,
  last_milestone: null,
  last_milestone_at: null,
  is_mock: true,
  ...overrides,
});

const build = ({ estado = 'embarcado', isException = false, track = null, docs = [] } = {}) => {
  const steps = buildTimelineSteps({
    estado,
    realSteps: REAL_STEPS,
    isException,
    dataStatus: track?.data_status,
    milestone: track?.last_milestone,
    currentEta: track?.current_eta,
    firstEta: track?.first_eta,
  });
  return {
    steps,
    insights: buildStepInsights({
      steps,
      referencia: REFERENCIA,
      estado,
      isException,
      delayRisk: delayRiskFromTracking(track),
      pendingDocuments: docs,
    }),
  };
};

test('etapa concluída não recebe risco — semáforo é sobre o que falta', () => {
  const { steps, insights } = build({ estado: 'embarcado' });
  steps
    .filter((s) => s.status === 'done')
    .forEach((s) => assert.equal(insights[s.key]?.risk, undefined));
  assert.ok(insights.embarcado.risk, 'a etapa atual tem risco');
});

test('atraso confirmado manda nos passos pós-embarque, com o mesmo número do badge', () => {
  const track = tracking({
    data_status: 'COMPLETE',
    first_eta: '2026-08-20T00:00:00Z',
    current_eta: '2026-08-25T00:00:00Z',
    eta_is_actual: true,
    last_milestone: 'DISCHARGE',
  });
  const { insights } = build({ track });
  const risk = insights.liberado.risk;
  assert.equal(risk.level, 'high');
  assert.equal(STEP_RISK_TONE[risk.level], 'danger');
  // 5 = delta de delayRiskFromTracking, não um segundo cálculo daqui.
  assert.equal(delayRiskFromTracking(track).deltaDays, 5);
  assert.match(risk.rationale, /5 dias/);
});

test('atraso confirmado também agrava a etapa operacional em curso', () => {
  // Sem isto, a etapa atual mostrava "Risco baixo" embaixo do badge
  // "Atraso, +7 dias" do topo da mesma tela.
  const { insights } = build({
    estado: 'analise_booking',
    track: tracking({
      data_status: 'COMPLETE',
      first_eta: '2026-08-20T00:00:00Z',
      current_eta: '2026-08-27T00:00:00Z',
    }),
  });
  assert.equal(insights.analise_booking.risk.level, 'high');
  assert.equal(insights.embarcado.risk.level, 'moderate');
  assert.match(insights.embarcado.risk.rationale, /atraso já confirmado/);
});

test('desvio dentro da janela vira atenção, não atraso', () => {
  const { insights } = build({
    track: tracking({
      data_status: 'COMPLETE',
      first_eta: '2026-08-20T00:00:00Z',
      current_eta: '2026-08-21T00:00:00Z',
      last_milestone: 'OCEAN_TRANSIT',
    }),
  });
  assert.equal(insights.chegada.risk.level, 'moderate');
  assert.match(insights.chegada.risk.rationale, /1 dia\b/);
});

test('previsão mantida pela companhia derruba o risco das etapas seguintes', () => {
  const { insights } = build({
    track: tracking({
      data_status: 'COMPLETE',
      first_eta: '2026-08-20T00:00:00Z',
      current_eta: '2026-08-20T00:00:00Z',
      last_milestone: 'OCEAN_TRANSIT',
    }),
  });
  ['chegada', 'descarregado', 'liberado'].forEach((key) => {
    assert.equal(insights[key].risk.level, 'low');
  });
});

test('sem rastreamento, o risco cai no perfil da etapa e é estável', () => {
  const a = build({ estado: 'aguardando_prontidao' }).insights;
  const b = build({ estado: 'aguardando_prontidao' }).insights;
  assert.equal(a.aguardando_prontidao.risk.level, 'moderate');
  assert.equal(a.chegada.risk.rationale, b.chegada.risk.rationale);
  // O percentual citado é histórico da rota, e vem escrito no texto.
  assert.match(a.aguardando_prontidao.risk.rationale, /\d+%/);
});

test('exceção agrava uma casa: nada depois de uma linha congelada é calmo', () => {
  const calm = build({ estado: 'coletado' }).insights;
  const frozen = build({ estado: 'postergado', isException: true }).insights;
  assert.equal(calm.coletado.risk.level, 'low');
  assert.equal(frozen.coletado.risk.level, 'moderate');
  assert.equal(frozen.chegada.risk.level, 'high');
});

test('documento pendente vira gatilho de ação na etapa que ele destrava', () => {
  const { insights } = build({
    estado: 'aguardando_prontidao',
    docs: [
      {
        id: 'd1',
        label: 'Commercial Invoice',
        requiredForStep: 'aguardando_prontidao',
      },
      { id: 'd2', label: 'Packing List', requiredForStep: 'aguardando_prontidao' },
    ],
  });
  const action = insights.aguardando_prontidao.action;
  assert.equal(action.kind, 'documento');
  assert.deepEqual(action.documentIds, ['d1', 'd2']);
  assert.match(action.description, /Commercial Invoice e Packing List/);
  assert.equal(action.ctaLabel, 'Enviar documentos');
});

test('documento cobrado por uma etapa inexistente não inventa etapa', () => {
  const { insights } = build({
    docs: [{ id: 'x', label: 'Qualquer', requiredForStep: 'etapa_que_nao_existe' }],
  });
  assert.equal(insights.etapa_que_nao_existe, undefined);
});

test('booking pede decisão do cliente, e o texto muda quando ele veio divergente', () => {
  const normal = build({ estado: 'analise_booking' }).insights;
  assert.equal(normal.analise_booking.action.kind, 'aprovacao');
  assert.equal(normal.analise_booking.action.ctaLabel, 'Aprovar booking');

  const divergent = build({ estado: 'booking_divergente', isException: true }).insights;
  assert.equal(divergent.analise_booking.action.ctaLabel, 'Revisar booking');
});

test('chegada remarcada leva motivo junto da nova data, e o delta é o real', () => {
  const { insights } = build({
    track: tracking({
      data_status: 'COMPLETE',
      first_eta: '2026-08-20T00:00:00Z',
      current_eta: '2026-08-25T00:00:00Z',
      last_milestone: 'OCEAN_TRANSIT',
    }),
  });
  assert.equal(insights.chegada.scheduleChange.deltaDays, 5);
  assert.ok(insights.chegada.scheduleChange.reason.length > 0);
});

test('postergado avisa na chegada, e sem as duas previsões não há quantos dias', () => {
  const { insights } = build({ estado: 'postergado', isException: true });
  const change = insights.chegada.scheduleChange;
  assert.equal(change.deltaDays, null);
  assert.ok(change.reason.length > 0);
  // Nunca na primeira etapa não concluída: "Solicitado" já aconteceu.
  assert.equal(insights.solicitado.scheduleChange, undefined);
});

test('chegada no prazo não ganha linha de reprogramação', () => {
  const { insights } = build({
    track: tracking({
      data_status: 'COMPLETE',
      first_eta: '2026-08-20T00:00:00Z',
      current_eta: '2026-08-20T00:00:00Z',
      last_milestone: 'OCEAN_TRANSIT',
    }),
  });
  assert.equal(insights.chegada.scheduleChange, undefined);
});
