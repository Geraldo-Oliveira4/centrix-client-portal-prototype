// Unit test da contagem regressiva do indicador-chave do topo. Mesmo runner
// dos outros libs:
//
//     npm run test:unit
//
// Existe porque este é o único número da tela que um comprador lê sem
// interpretar nada ("faltam 25 dias"): errar o sinal ou o arredondamento não
// lança exceção, só imprime com confiança uma data que não confere com a
// timeline logo abaixo.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  arrivalCountdownFromTracking,
  arrivalNote,
  arrivalTone,
  computeArrivalCountdown,
} from './arrival-countdown.ts';
import { computeDelayRisk } from './delay-risk.ts';

const NOW = new Date('2026-08-18T09:00:00Z');

const countdown = (overrides = {}) =>
  computeArrivalCountdown({
    currentEta: '2026-09-12T00:00:00Z',
    now: NOW,
    ...overrides,
  });

test('chegada futura conta os dias que faltam', () => {
  const c = countdown();
  assert.equal(c.status, 'scheduled');
  assert.equal(c.days, 25);
  assert.equal(c.headline, 'faltam 25 dias');
  assert.equal(c.title, 'Chegada prevista');
});

test('singular no penultimo dia', () => {
  const c = countdown({ currentEta: '2026-08-19T00:00:00Z' });
  assert.equal(c.days, 1);
  assert.equal(c.headline, 'falta 1 dia');
});

test('a hora do dia nao vira meio dia de contagem', () => {
  // 09:00 de hoje contra 23:00 de hoje continua sendo "chega hoje".
  const c = countdown({ currentEta: '2026-08-18T23:00:00Z' });
  assert.equal(c.days, 0);
  assert.equal(c.status, 'today');
  assert.equal(c.headline, 'chega hoje');
});

test('chegada confirmada no passado diz que chegou, e ha quantos dias', () => {
  const c = countdown({ currentEta: '2026-08-15T00:00:00Z', etaIsActual: true });
  assert.equal(c.status, 'arrived');
  assert.equal(c.title, 'Chegada confirmada');
  assert.equal(c.headline, 'chegou há 3 dias');
});

test('previsao vencida sem confirmacao NAO afirma que chegou', () => {
  const c = countdown({ currentEta: '2026-08-15T00:00:00Z' });
  assert.equal(c.status, 'overdue');
  assert.equal(c.headline, 'previsão vencida há 3 dias');
  assert.equal(c.confirmed, false);
});

test('IsActual sobre data futura nao pode dizer "confirmada"', () => {
  // Fonte se contradizendo (aparece no dado ilustrativo do topup_full): o flag
  // diz chegada real, o calendario diz que ela ainda nao aconteceu.
  const c = countdown({ currentEta: '2026-08-27T00:00:00Z', etaIsActual: true });
  assert.equal(c.status, 'scheduled');
  assert.equal(c.title, 'Chegada prevista');
  assert.equal(c.headline, 'faltam 9 dias');
  assert.equal(c.confirmed, true);
});

test('sem ETA nao existe contagem — o componente nao tem numero para imprimir', () => {
  const c = countdown({ currentEta: null, firstEta: null });
  assert.equal(c.status, 'unknown');
  assert.equal(c.iso, null);
  assert.equal(c.days, null);
  assert.equal(c.headline, 'Sem previsão da companhia');
});

test('a primeira previsao serve de reserva quando so ela existe', () => {
  const c = countdown({ currentEta: null, firstEta: '2026-08-28T00:00:00Z' });
  assert.equal(c.status, 'scheduled');
  assert.equal(c.days, 10);
});

test('o atalho do payload le exatamente os campos de tracking', () => {
  const c = arrivalCountdownFromTracking(
    {
      first_eta: '2026-09-01T00:00:00Z',
      current_eta: '2026-09-12T00:00:00Z',
      eta_is_actual: false,
    },
    NOW,
  );
  assert.equal(c.days, 25);
  assert.equal(arrivalCountdownFromTracking(null, NOW).status, 'unknown');
});

// --- Cor -------------------------------------------------------------------

const risk = (first, current, extra = {}) =>
  computeDelayRisk({ firstEta: first, currentEta: current, ...extra });

test('a cor segue o semaforo do atraso onde ha aritmetica', () => {
  const c = countdown();
  assert.equal(arrivalTone(c, risk('2026-09-12', '2026-09-12')), 'success');
  assert.equal(arrivalTone(c, risk('2026-09-10', '2026-09-12')), 'warning');
  assert.equal(arrivalTone(c, risk('2026-09-05', '2026-09-12')), 'danger');
});

test('sem as duas previsoes a cor e neutra, nunca semaforo', () => {
  // Qualidade de dado nao e saude do embarque — mesma regra do
  // IncompleteDataBadge.
  const c = countdown();
  assert.equal(arrivalTone(c, risk(null, null)), 'neutral');
  assert.equal(
    arrivalTone(c, risk(null, null, { dataStatus: 'INCOMPLETE' })),
    'neutral',
  );
});

test('chegada confirmada fecha em verde mesmo tendo atrasado', () => {
  const c = countdown({ currentEta: '2026-08-15T00:00:00Z', etaIsActual: true });
  assert.equal(arrivalTone(c, risk('2026-08-05', '2026-08-15')), 'success');
});

test('previsao vencida sem confirmacao e atencao, nao sucesso', () => {
  const c = countdown({ currentEta: '2026-08-15T00:00:00Z' });
  assert.equal(arrivalTone(c, risk('2026-08-15', '2026-08-15')), 'warning');
});

// --- Frase de apoio --------------------------------------------------------

test('a frase carrega o mesmo delta do badge de atraso removido', () => {
  assert.equal(
    arrivalNote(risk('2026-09-05', '2026-09-12')),
    'Postergada 7 dias sobre a primeira previsão da companhia.',
  );
  assert.equal(
    arrivalNote(risk('2026-09-11', '2026-09-12')),
    'Postergada 1 dia sobre a primeira previsão da companhia.',
  );
});

test('a frase distingue mantida, antecipada e ausencia de fonte', () => {
  assert.match(arrivalNote(risk('2026-09-12', '2026-09-12')), /mantém a mesma previsão/);
  assert.equal(
    arrivalNote(risk('2026-09-12', '2026-09-10')),
    'Antecipada 2 dias sobre a primeira previsão da companhia.',
  );
  assert.match(arrivalNote(risk(null, null)), /ainda não publicou previsão/);
  assert.match(
    arrivalNote(risk(null, null, { dataStatus: 'INCOMPLETE' })),
    /não reportou as duas previsões/,
  );
});
