import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  URGENCY_LABELS,
  isEmphasized,
  mostUrgent,
  summarizeAttention,
  urgencyOf,
  urgencyOfAction,
} from './urgency.ts';

const NOW = new Date(2026, 8, 30, 10, 0); // 30/09/2026 10:00, horário local

const level = (signal: Parameters<typeof urgencyOf>[0]) =>
  urgencyOf(signal, NOW).level;

test('só ação do cliente sobe: o que está com a Freitas é normal', () => {
  assert.equal(
    level({ clientAction: false, deadline: '2026-09-01' }),
    'normal',
  );
});

test('crítico é o que já custa: prazo vencido ou demurrage', () => {
  assert.deepEqual(
    urgencyOf({ clientAction: true, deadline: '2026-09-29' }, NOW),
    {
      level: 'critico',
      reason: 'Prazo vencido',
    },
  );
  assert.equal(
    level({ clientAction: true, deadline: '2026-09-30T09:00:00' }),
    'critico',
  );
  assert.equal(level({ clientAction: false, costRunning: true }), 'critico');
});

test('vence hoje é atenção, não crítico', () => {
  assert.deepEqual(
    urgencyOf({ clientAction: true, deadline: '2026-09-30' }, NOW),
    {
      level: 'atencao',
      reason: 'Vence hoje',
    },
  );
  assert.equal(
    urgencyOf({ clientAction: true, deadline: '2026-09-30T18:00:00' }, NOW)
      .reason,
    'Vence hoje',
  );
});

test('até 3 dias é atenção; depois disso, normal', () => {
  assert.equal(
    urgencyOf({ clientAction: true, deadline: '2026-10-01' }, NOW).reason,
    'Vence amanhã',
  );
  assert.equal(
    urgencyOf({ clientAction: true, deadline: '2026-10-03' }, NOW).reason,
    'Vence em 3 dias',
  );
  assert.equal(level({ clientAction: true, deadline: '2026-10-04' }), 'normal');
});

test('sem prazo: trava a próxima etapa é atenção; o resto é "Pendente com você"', () => {
  assert.equal(level({ clientAction: true, blocksNextStep: true }), 'atencao');
  assert.deepEqual(urgencyOf({ clientAction: true }, NOW), {
    level: 'normal',
    reason: 'Pendente com você',
  });
});

test('booking e dados travam; documento sem prazo não', () => {
  assert.equal(urgencyOfAction({ kind: 'booking' }, NOW).level, 'atencao');
  assert.equal(urgencyOfAction({ kind: 'dados' }, NOW).level, 'atencao');
  assert.equal(urgencyOfAction({ kind: 'documento' }, NOW).level, 'normal');
  assert.equal(
    urgencyOfAction({ kind: 'proposta', deadline: '2026-09-28' }, NOW).level,
    'critico',
  );
});

test('concluído é ok e nunca ganha ênfase', () => {
  assert.equal(
    level({ clientAction: true, done: true, deadline: '2026-09-01' }),
    'ok',
  );
  assert.equal(isEmphasized('ok'), false);
  assert.equal(isEmphasized('normal'), false);
  assert.equal(isEmphasized('atencao'), true);
});

test('o resumo conta só as duas ênfases', () => {
  const list = [
    urgencyOf({ clientAction: true, deadline: '2026-09-01' }, NOW),
    urgencyOf({ clientAction: true, deadline: '2026-09-30' }, NOW),
    urgencyOf({ clientAction: true }, NOW),
    urgencyOf({ clientAction: false }, NOW),
  ];
  assert.deepEqual(summarizeAttention(list), {
    critico: 1,
    atencao: 1,
    total: 2,
  });
  assert.equal(mostUrgent(list)?.level, 'critico');
  assert.equal(mostUrgent([]), null);
});

test('todo nível tem rótulo', () => {
  for (const key of ['critico', 'atencao', 'normal', 'ok'] as const) {
    assert.ok(URGENCY_LABELS[key]);
  }
});

test('por registro vale a ação mais urgente do registro', async () => {
  const { urgencyByRecord } = await import('./urgency.ts');
  const map = urgencyByRecord(
    [
      { recordId: 'ship-1', kind: 'documento' },
      { recordId: 'ship-1', kind: 'booking' },
      { recordId: 'cot-1', kind: 'proposta', deadline: '2026-09-29' },
      { recordId: 'ship-2', kind: 'documento' },
    ],
    NOW,
  );
  assert.equal(map.get('ship-1')?.reason, 'Trava a próxima etapa');
  assert.equal(map.get('cot-1')?.level, 'critico');
  assert.equal(map.get('ship-2')?.level, 'normal');
  assert.equal(map.has('ship-3'), false);
});

test('a fila ordenada pela escala é estável dentro do nível', async () => {
  const { rankByUrgency } = await import('./urgency.ts');
  const ranked = rankByUrgency(
    [
      { id: 'a', kind: 'proposta' as const, deadline: '2026-10-20' },
      { id: 'b', kind: 'documento' as const },
      { id: 'c', kind: 'booking' as const },
      { id: 'd', kind: 'proposta' as const, deadline: '2026-09-29' },
      { id: 'e', kind: 'dados' as const },
    ],
    NOW,
  );
  assert.deepEqual(
    ranked.map((r) => r.action.id),
    ['d', 'c', 'e', 'a', 'b'],
  );
});
