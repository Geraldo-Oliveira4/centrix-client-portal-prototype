import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PORTAL_HOME_CARD_THEME } from '../home/lib/home-layout.ts';
import {
  EMPTY_ONBOARDING,
  FIRST_STEPS,
  PERSONA_OPTIONS,
  ROUTE_DESTINATIONS as DESTS,
  ROUTE_ORIGINS as ORIGS,
  TOUR_STEPS,
  arcPath,
  contactIssue,
  firstStepsProgress,
  orderCardsForProfile,
  parseFirstSteps,
  parseOnboarding,
  projectPlace,
  routeExample,
  routeIssue,
  routeLabel,
  themesForProfile,
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

// ---- boas-vindas "uau" (Prompt 4) ----

test('a prioridade vem primeiro; o papel ordena o resto', () => {
  assert.deepEqual(themesForProfile('financeiro', ''), ['custos', 'acao']);
  assert.deepEqual(themesForProfile('financeiro', 'visibilidade'), [
    'mapa',
    'custos',
    'acao',
  ]);
  assert.deepEqual(themesForProfile('comex', 'custo'), [
    'custos',
    'acao',
    'mapa',
  ]);
  assert.deepEqual(themesForProfile('gestor', 'prazo'), [
    'acao',
    'mapa',
    'custos',
  ]);
  assert.deepEqual(themesForProfile('', ''), ['acao', 'mapa', 'custos']);
  for (const p of PERSONA_OPTIONS)
    assert.ok(themesForProfile(p.id, '').length >= 2);
});

test('ordem dos cards segue o papel, sem perder card nenhum', () => {
  const cards = [
    'acao_urgente',
    'mapa_embarques',
    'economia',
    'tendencia_preco',
  ] as const;
  const gestor = orderCardsForProfile(
    [...cards],
    PORTAL_HOME_CARD_THEME,
    'gestor',
    '',
  );
  assert.deepEqual(gestor, [
    'mapa_embarques',
    'economia',
    'tendencia_preco',
    'acao_urgente',
  ]);
  assert.deepEqual(
    orderCardsForProfile([...cards], PORTAL_HOME_CARD_THEME, '', ''),
    [...cards],
  );
});

test('toda rota válida da lista curta tem coordenada e exemplo do seed', () => {
  for (const o of ORIGS)
    for (const d of DESTS) {
      if (routeIssue({ origin: o.code, destination: d.code }, [])) continue;
      assert.ok(
        projectPlace(o.code) && projectPlace(d.code),
        `${o.code}>${d.code} sem coordenada`,
      );
      assert.ok(
        routeExample({ origin: o.code, destination: d.code }),
        `${o.code}>${d.code} sem exemplo`,
      );
    }
  const a = projectPlace('CNSHA')!;
  const b = projectPlace('BRSSZ')!;
  assert.match(
    arcPath(a, b),
    /^M [\d.]+ [\d.]+ Q [\d.]+ [\d.-]+ [\d.]+ [\d.]+$/,
  );
});

test('estado das boas-vindas: respostas e etapa retomável; lixo é descartado', () => {
  const s = parseOnboarding(
    JSON.stringify({
      persona: 'compras',
      priority: 'prazo',
      wizardStep: 2,
      revealPending: true,
    }),
  );
  assert.equal(s.persona, 'compras');
  assert.equal(s.wizardStep, 2);
  assert.equal(s.revealPending, true);
  const bad = parseOnboarding(
    JSON.stringify({ persona: 'ceo', priority: 'x', wizardStep: 99 }),
  );
  assert.equal(bad.persona, '');
  assert.equal(bad.wizardStep, 0);
});

test('primeiros passos: três itens, progresso e ids desconhecidos descartados', () => {
  assert.equal(FIRST_STEPS.length, 3);
  const st = parseFirstSteps(
    JSON.stringify({ done: ['cotacao', 'cotacao', 'outro'], dismissed: false }),
  );
  assert.deepEqual(st.done, ['cotacao']);
  assert.deepEqual(firstStepsProgress(st), {
    done: 1,
    total: 3,
    complete: false,
  });
  assert.equal(
    firstStepsProgress({
      done: ['cotacao', 'alertas', 'colega'],
      dismissed: false,
    }).complete,
    true,
  );
  assert.deepEqual(parseFirstSteps('lixo'), { done: [], dismissed: false });
});
