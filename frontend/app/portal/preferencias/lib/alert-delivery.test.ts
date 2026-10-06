import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_ALERT_DELIVERY,
  alertDeliverySummary,
  parseAlertDelivery,
} from './alert-delivery.ts';

test('preferências de alertas: padrão, valores desconhecidos descartados, nunca sem canal', () => {
  assert.deepEqual(parseAlertDelivery(null), DEFAULT_ALERT_DELIVERY);
  assert.deepEqual(parseAlertDelivery('{lixo'), DEFAULT_ALERT_DELIVERY);
  const p = parseAlertDelivery(JSON.stringify({ channels: ['email', 'sms', 'email'], frequency: 'mensal', weeklySummary: false, weeklyDay: 'domingo' }));
  assert.deepEqual(p, { channels: ['email'], frequency: 'imediato', weeklySummary: false, weeklyDay: 'segunda' });
  assert.deepEqual(parseAlertDelivery(JSON.stringify({ channels: [] })).channels, ['portal']);
});

test('frase do resumo diz canal, frequência e o resumo semanal', () => {
  assert.equal(alertDeliverySummary(DEFAULT_ALERT_DELIVERY), 'Alertas na hora, no portal, e um resumo semanal toda segunda.');
  assert.equal(
    alertDeliverySummary({ channels: ['portal', 'email'], frequency: 'diario', weeklySummary: false, weeklyDay: 'sexta' }),
    'Alertas uma vez por dia, no portal e e-mail.',
  );
});
