import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  EMPTY_ONBOARDING,
  TOUR_STEPS,
  contactIssue,
  parseOnboarding,
  routeIssue,
  routeLabel,
  visibleTourSteps,
} from './onboarding.ts';

test('o tour tem de 5 a 6 passos e termina no suporte', () => {
  assert.ok(TOUR_STEPS.length >= 5 && TOUR_STEPS.length <= 6);
  assert.equal(TOUR_STEPS.at(-1)?.id, 'suporte');
});

test('módulo desligado tira o passo do tour', () => {
  const steps = visibleTourSteps({ embarques: false, inteligencia: false });
  assert.deepEqual(
    steps.map((s) => s.id),
    ['boas-vindas', 'central', 'cotacoes', 'suporte'],
  );
});

test('rota exige origem e destino do mesmo modal, sem repetição', () => {
  assert.match(routeIssue({}, []) ?? '', /origem e o destino/);
  assert.match(
    routeIssue({ origin: 'FRA', destination: 'BRSSZ' }, []) ?? '',
    /Guarulhos/,
  );
  assert.match(
    routeIssue({ origin: 'CNSHA', destination: 'GRU' }, []) ?? '',
    /porto/,
  );
  const existing = [
    { origin: 'CNSHA', destination: 'BRSSZ', modal: 'MARITIMO' as const },
  ];
  assert.match(
    routeIssue({ origin: 'CNSHA', destination: 'BRSSZ' }, existing) ?? '',
    /já está/,
  );
  assert.equal(
    routeIssue({ origin: 'CNNGB', destination: 'BRITJ' }, existing),
    null,
  );
  assert.equal(routeLabel(existing[0]), 'Shanghai → Santos · Marítimo');
});

test('contato precisa de nome e e-mail válido', () => {
  assert.match(contactIssue({ email: 'a@b.co' }) ?? '', /nome/);
  assert.match(
    contactIssue({ name: 'Ana', email: 'ana' }) ?? '',
    /e-mail válido/,
  );
  assert.equal(
    contactIssue({ name: 'Ana', email: 'ana@exemplo.com.br' }),
    null,
  );
});

test('estado gravado inválido é descartado, não consertado', () => {
  assert.deepEqual(parseOnboarding(null), EMPTY_ONBOARDING);
  assert.deepEqual(parseOnboarding('{quebrado'), EMPTY_ONBOARDING);
  const parsed = parseOnboarding(
    JSON.stringify({
      tourDone: true,
      setupDone: 'sim',
      routes: [
        { origin: 'CNSHA', destination: 'BRSSZ', modal: 'MARITIMO' },
        { origin: 'XXX', destination: 'BRSSZ', modal: 'MARITIMO' },
      ],
      events: ['propostas', 'inventado'],
      contacts: [{ name: 'Ana', email: 'ana@exemplo.com.br' }, { name: 1 }],
    }),
  );
  assert.equal(parsed.tourDone, true);
  assert.equal(parsed.setupDone, false);
  assert.equal(parsed.routes.length, 1);
  assert.deepEqual(parsed.events, ['propostas']);
  assert.equal(parsed.contacts.length, 1);
});
