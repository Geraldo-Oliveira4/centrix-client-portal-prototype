import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  AIRPORTS_DEPARTURE_OPTIONS,
  AIRPORTS_DESTINATION_OPTIONS,
} from '../../../constants/airports.ts';
import {
  PORTS_DEPARTURE_OPTIONS,
  PORTS_DESTINATION_OPTIONS,
} from '../../../constants/ports.ts';
import { PORTAL_HOME_CARD_THEME } from '../home/lib/home-layout.ts';
import {
  EMPTY_ONBOARDING,
  FIRST_STEPS,
  PERSONA_OPTIONS,
  ROUTE_DESTINATIONS as DESTS,
  ROUTE_ORIGINS as ORIGS,
  MAX_TOUR_STEPS,
  TOUR_STEPS,
  WELCOME_FORM_OPTION,
  welcomeQuotationHref,
  arcPath,
  contactIssue,
  firstStepsCompact,
  firstStepsProgress,
  nextFirstStep,
  orderCardsForProfile,
  parseFirstSteps,
  parseOnboarding,
  projectPlace,
  routeExample,
  routeIssue,
  routeLabel,
  themesForProfile,
  visibleTourSteps,
  tourStepLabel,
  INTEL_PRACTICE_HREF,
  FIRST_STEPS_DONE_BY_ACTION,
} from './onboarding.ts';

test('mini tour: 4 paradas — menu, Central, Performance (antes da Ajuda) e Ajuda', () => {
  assert.equal(MAX_TOUR_STEPS, 4);
  assert.ok(TOUR_STEPS.length <= MAX_TOUR_STEPS);
  assert.deepEqual(
    TOUR_STEPS.map((s) => s.id),
    ['menu', 'central', 'performance', 'suporte'],
  );
  assert.ok(TOUR_STEPS.every((s) => s.target));
  const perf = TOUR_STEPS.find((s) => s.id === 'performance')!;
  assert.equal(perf.target, '[data-tour="menu"] a[href^="/portal/inteligencia"]');
  assert.equal(perf.cta?.label, 'Ver na prática');
  assert.equal(perf.cta?.href, INTEL_PRACTICE_HREF);
  assert.match(perf.cta!.href, /visao=minha-operacao/);
  assert.match(perf.cta!.href, /guia=1/);
  // Dado, não veredito: nada de score.
  assert.doesNotMatch(perf.body, /score|nota|\/100/i);
});

test('numeração do tour: "1 de 4" ... "4 de 4"; sem Inteligência, "1 de 3"', () => {
  const all = visibleTourSteps({});
  assert.deepEqual(all.map((_, i) => tourStepLabel(i, all.length)), ['1 de 4', '2 de 4', '3 de 4', '4 de 4']);
  const off = visibleTourSteps({ inteligencia: false });
  assert.deepEqual(off.map((s) => s.id), ['menu', 'central', 'suporte']);
  assert.equal(tourStepLabel(off.length - 1, off.length), '3 de 3');
  // A última parada continua sendo a Ajuda, nos dois casos.
  assert.equal(all.at(-1)?.id, 'suporte');
  // Embarques e cotação desligados não tiram parada nenhuma.
  assert.equal(visibleTourSteps({ embarques: false, cotacao: false }).length, 4);
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

test('primeiros passos: cinco itens, progresso e ids desconhecidos descartados', () => {
  assert.equal(FIRST_STEPS.length, 5);
  assert.deepEqual(
    FIRST_STEPS.map((s) => s.id),
    ['cotacao', 'alertas', 'inteligencia', 'visao', 'colega'],
  );
  assert.deepEqual(
    FIRST_STEPS.map((s) => s.label).slice(2, 4),
    ['Ver sua Inteligência', 'Salvar uma visão'],
  );
  // Só o convite fecha pelo próprio card; os outros, pela ação na tela.
  assert.deepEqual(
    FIRST_STEPS.filter((s) => !FIRST_STEPS_DONE_BY_ACTION.includes(s.id)).map((s) => s.id),
    ['colega'],
  );
  const st = parseFirstSteps(
    JSON.stringify({ done: ['cotacao', 'cotacao', 'outro'], dismissed: false }),
  );
  assert.deepEqual(st.done, ['cotacao']);
  assert.deepEqual(firstStepsProgress(st), {
    done: 1,
    total: 5,
    complete: false,
  });
  assert.equal(
    firstStepsProgress({
      done: ['cotacao', 'alertas', 'colega'],
      dismissed: false,
      justDone: null,
    }).complete,
    false,
  );
  assert.deepEqual(
    firstStepsProgress({
      done: ['cotacao', 'alertas', 'inteligencia', 'visao', 'colega'],
      dismissed: false,
      justDone: null,
    }),
    { done: 5, total: 5, complete: true },
  );
  assert.deepEqual(parseFirstSteps('lixo'), {
    done: [],
    dismissed: false,
    justDone: null,
  });
});

test('cotar esta rota: todo ponto do mapa existe nas listas do formulário', () => {
  const has = (list: { value: string }[], v: string) =>
    list.some((o) => o.value === v);
  for (const p of ORIGS) {
    const v = WELCOME_FORM_OPTION[p.code];
    assert.ok(v, p.code);
    assert.ok(
      has(
        p.modal === 'AEREO'
          ? AIRPORTS_DEPARTURE_OPTIONS
          : PORTS_DEPARTURE_OPTIONS,
        v,
      ),
      v,
    );
  }
  for (const p of DESTS) {
    const v = WELCOME_FORM_OPTION[p.code];
    assert.ok(v, p.code);
    assert.ok(
      has(
        p.modal === 'AEREO'
          ? AIRPORTS_DESTINATION_OPTIONS
          : PORTS_DESTINATION_OPTIONS,
        v,
      ),
      v,
    );
  }
});

test('cotar esta rota: o link leva modal, origem, destino e a fonte', () => {
  const sea = new URL(
    welcomeQuotationHref({
      origin: 'CNSHA',
      destination: 'BRSSZ',
      modal: 'MARITIMO',
    }),
    'http://x',
  );
  assert.equal(sea.pathname, '/portal/nova-cotacao');
  assert.equal(sea.searchParams.get('modal'), 'MARITIMO');
  assert.equal(
    sea.searchParams.get('porto_embarque'),
    'Shanghai, China (CNSHA)',
  );
  assert.equal(sea.searchParams.get('porto_destino'), 'Santos, Brazil (BRSSZ)');
  assert.equal(sea.searchParams.get('fonte'), 'boas_vindas');
  const air = new URL(
    welcomeQuotationHref({ origin: 'FRA', destination: 'GRU', modal: 'AEREO' }),
    'http://x',
  );
  assert.equal(
    air.searchParams.get('aeroporto_embarque'),
    '(FRA) Frankfurt am Main, DE',
  );
  assert.equal(
    air.searchParams.get('aeroporto_destino'),
    '(GRU) São Paulo, BR',
  );
  assert.equal(air.searchParams.get('porto_embarque'), null);
});

test('primeiros passos: próximo passo, barra fina faltando 1 de 5 e comemoração pendente', () => {
  const none = parseFirstSteps(null);
  assert.equal(nextFirstStep(none)?.id, 'cotacao');
  assert.equal(firstStepsCompact(none), false);
  const one = parseFirstSteps(
    JSON.stringify({ done: ['cotacao'], justDone: 'cotacao' }),
  );
  assert.equal(one.justDone, 'cotacao');
  assert.equal(nextFirstStep(one)?.id, 'alertas');
  const two = parseFirstSteps(
    JSON.stringify({ done: ['cotacao', 'colega'], justDone: 'alertas' }),
  );
  assert.equal(
    two.justDone,
    null,
    'justDone precisa estar entre os concluídos',
  );
  assert.equal(firstStepsCompact(two), false);
  assert.equal(nextFirstStep(two)?.id, 'alertas');
  const four = parseFirstSteps(
    JSON.stringify({ done: ['cotacao', 'alertas', 'inteligencia', 'colega'] }),
  );
  assert.equal(firstStepsCompact(four), true);
  assert.equal(nextFirstStep(four)?.id, 'visao');
  assert.equal(
    nextFirstStep(
      parseFirstSteps(
        JSON.stringify({ done: ['cotacao', 'alertas', 'inteligencia', 'visao', 'colega'] }),
      ),
    ),
    null,
  );
});
