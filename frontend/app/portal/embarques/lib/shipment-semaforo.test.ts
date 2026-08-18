// Unit test da régua dupla de "situação". Mesmo runner dos outros libs:
//
//     npm run test:unit
//
// POR QUE ESTE ARQUIVO EXISTE
// ---------------------------
// A aba Mapa mostra, lado a lado, o chip "Com atraso" e o card "Visão do todo".
// Em 18/08/2026 eles diziam 5 e 1, os dois usando a palavra "atraso" — e a
// primeira leitura de quem valida a tela é "um dos dois está errado".
//
// Nenhum dos dois está: são réguas diferentes sobre fontes diferentes (deslize
// de ETA da companhia x estado do embarque no GE), e a justificativa completa
// está em `SEMAFORO_LABELS`, em types/portal-shipment.ts. A decisão foi MANTER
// as duas contagens e separar o vocabulário. Este teste trava as duas metades
// dessa decisão, que são invisíveis em revisão de código:
//
//   1. as réguas continuam independentes (contar a mesma coisa nas duas seria a
//      "unificação" que decidimos NÃO fazer, e ela apagaria casos reais);
//   2. o vocabulário continua separado — nenhum rótulo do semáforo volta a
//      falar em atraso, que é o que criou a confusão.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ESTADO_SEMAFORO,
  SEMAFORO_LABELS,
  countBySemaforo,
} from '../../../../types/portal-shipment.ts';
import { countShipmentFilters, filterShipments } from './shipment-filters.ts';

const COMPLETE = (firstEta, currentEta) => ({
  first_eta: firstEta,
  current_eta: currentEta,
  eta_is_actual: null,
  data_status: 'COMPLETE',
  last_milestone: null,
  last_milestone_at: null,
  is_mock: true,
});

const shipment = (id, overrides = {}) => ({
  id,
  referencia: `EMB-2026-${id}`,
  estado: 'embarcado',
  carga_urgente: false,
  tracking: null,
  ...overrides,
});

// A carteira que produz a divergência da tela: quatro embarques em curso normal
// (semáforo verde) dos quais três estão deslizando no ETA, e um adiado pela
// Freitas cuja companhia reportou chegada no prazo.
const ATRASADOS = [
  shipment('0001', { tracking: COMPLETE('2026-08-20T00:00:00Z', '2026-08-22T00:00:00Z') }),
  shipment('0002', { tracking: COMPLETE('2026-08-20T00:00:00Z', '2026-08-28T00:00:00Z') }),
  shipment('0003', { tracking: COMPLETE('2026-08-10T00:00:00Z', '2026-08-14T00:00:00Z') }),
];
const POSTERGADO_NO_PRAZO = shipment('0004', {
  estado: 'postergado',
  tracking: COMPLETE('2026-08-20T00:00:00Z', '2026-08-20T00:00:00Z'),
});
const CARTEIRA = [...ATRASADOS, POSTERGADO_NO_PRAZO];

test('as duas réguas medem coisas diferentes, e é por isso que os números diferem', () => {
  const comAtraso = filterShipments(CARTEIRA, 'atraso');
  const semaforo = countBySemaforo(CARTEIRA);

  // O chip conta deslize de ETA: os três, nenhum deles postergado.
  assert.equal(comAtraso.length, 3);
  // O card conta estado do GE: só o postergado sai do verde.
  assert.equal(semaforo.warning, 1);
  assert.equal(semaforo.success, 3);

  // E os conjuntos não se sobrepõem nesta carteira: o embarque laranja do card
  // NÃO está no chip, e nenhum embarque do chip é laranja. É a prova de que
  // unificar as duas contagens perderia informação em vez de "corrigir" um
  // número — o adiado sumiria do card, ou os três sumiriam do chip.
  assert.equal(comAtraso.includes(POSTERGADO_NO_PRAZO), false);
  comAtraso.forEach((s) =>
    assert.equal(ESTADO_SEMAFORO[s.estado], 'success', `${s.id} deveria ser verde`),
  );
});

test('nenhum rótulo do semáforo fala em atraso — a palavra é do chip', () => {
  Object.entries(SEMAFORO_LABELS).forEach(([tone, label]) => {
    assert.equal(
      /atras/i.test(label),
      false,
      `o rótulo "${label}" (${tone}) reintroduz a colisão de vocabulário`,
    );
  });

  // E o chip continua sendo o único a usá-la.
  const chip = countShipmentFilters(CARTEIRA, ['atraso'])[0];
  assert.match(chip.label, /atraso/i);
});

test('"Reprogramado" só é verdade enquanto postergado for o único estado laranja', () => {
  const laranjas = Object.entries(ESTADO_SEMAFORO)
    .filter(([, tone]) => tone === 'warning')
    .map(([estado]) => estado);
  // Um estado laranja novo que não seja reprogramação exige um rótulo novo:
  // "Reprogramado" passaria a nomear errado metade do que conta.
  assert.deepEqual(laranjas, ['postergado']);
  assert.equal(SEMAFORO_LABELS.warning, 'Reprogramado');
});
