// Unit test das flags por modulo. Mesmo runner dos outros libs:
//
//     npm run test:unit
//
// O QUE ERRA EM SILENCIO AQUI, e por isso e testado:
//
//   1. O padrao deixar de ser "tudo ligado". O protótipo publicado tem de
//      continuar se comportando como hoje; uma camada de flags que chega
//      desligando tela e indistinguivel, para quem abre o link, de regressao.
//   2. Uma onda deixar de ser cumulativa. Onda que tira um modulo que o cliente
//      ja tinha e rollback, nao liberacao.
//   3. `/portal/embarques/novo` cair no modulo errado. Ele compartilha prefixo
//      com a lista de embarques, e a jornada via PO tem flag propria — com o
//      casamento pelo primeiro prefixo, a Onda 2 abriria a jornada junto com a
//      lista e o Prompt 3 nao teria como demonstrar as duas separadas.
//   4. Rota desconhecida virar rota bloqueada. Toda tela que alguem esquecer de
//      registrar sairia do ar de uma vez.
//   5. Um modulo novo (Prompt 2 ou 3) nascer DESLIGADO num navegador que ja tem
//      um objeto gravado, por ausencia da chave.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_MODULE_FLAGS,
  PORTAL_MODULES,
  PORTAL_MODULE_DESCRIPTIONS,
  PORTAL_MODULE_LABELS,
  PORTAL_WAVE_PRESETS,
  flagsForWave,
  isRouteReleased,
  matchingWave,
  moduleForRoute,
  normalizeModuleFlags,
  parseModuleFlags,
  type PortalModule,
} from './feature-flags.ts';

test('o padrao e tudo ligado, para todo modulo que existe', () => {
  for (const module of PORTAL_MODULES) {
    assert.equal(
      DEFAULT_MODULE_FLAGS[module],
      true,
      `${module} deveria nascer liberado`,
    );
  }
});

test('todo modulo tem rotulo e descricao — o painel nao mostra chave crua', () => {
  for (const module of PORTAL_MODULES) {
    assert.ok(PORTAL_MODULE_LABELS[module]?.length, `${module} sem rotulo`);
    assert.ok(
      PORTAL_MODULE_DESCRIPTIONS[module]?.length,
      `${module} sem descricao`,
    );
  }
});

test('Onda 0 libera so a cotacao', () => {
  assert.deepEqual(flagsForWave('onda0'), {
    cotacao: true,
    cotacaoV2: false,
    embarques: false,
    embarqueViaPo: false,
    inteligencia: false,
    radar: false,
    auditoria: false,
  });
});

test('Onda 1 acrescenta a Cotacao V2 e nao tira nada', () => {
  assert.deepEqual(flagsForWave('onda1'), {
    cotacao: true,
    cotacaoV2: true,
    embarques: false,
    embarqueViaPo: false,
    inteligencia: false,
    radar: false,
    auditoria: false,
  });
});

test('Onda 2 acrescenta embarques e a abertura via PO', () => {
  assert.deepEqual(flagsForWave('onda2'), {
    cotacao: true,
    cotacaoV2: true,
    embarques: true,
    embarqueViaPo: true,
    inteligencia: false,
    radar: false,
    auditoria: false,
  });
});

test('Onda 3 acrescenta Inteligencia, Radar e Auditoria', () => {
  assert.deepEqual(flagsForWave('onda3'), {
    cotacao: true,
    cotacaoV2: true,
    embarques: true,
    embarqueViaPo: true,
    inteligencia: true,
    radar: true,
    auditoria: true,
  });
});

test('"Tudo liberado" e igual ao padrao', () => {
  assert.deepEqual(flagsForWave('tudo'), DEFAULT_MODULE_FLAGS);
});

test('as ondas sao cumulativas: nenhuma tira o que a anterior deu', () => {
  const order = ['onda0', 'onda1', 'onda2', 'onda3', 'tudo'] as const;
  for (let i = 1; i < order.length; i += 1) {
    const previous = flagsForWave(order[i - 1]);
    const current = flagsForWave(order[i]);
    for (const module of PORTAL_MODULES) {
      if (previous[module]) {
        assert.equal(
          current[module],
          true,
          `${order[i]} tirou ${module}, que ${order[i - 1]} ja tinha dado`,
        );
      }
    }
  }
});

test('toda onda declarada produz um preset que reproduz as mesmas flags', () => {
  for (const wave of PORTAL_WAVE_PRESETS) {
    const id = matchingWave(flagsForWave(wave.id));
    assert.ok(id, `${wave.id} nao foi reconhecida`);
    assert.deepEqual(flagsForWave(id as typeof wave.id), flagsForWave(wave.id));
  }
});

test('com tudo ligado o preset aceso e "Tudo liberado", nao a ultima onda', () => {
  // "Onda 3" e "Tudo liberado" descrevem o mesmo conjunto hoje. Acender a onda
  // diria a quem apresenta que ele esta numa onda, quando esta olhando o portal
  // como ele e publicado.
  assert.equal(matchingWave(DEFAULT_MODULE_FLAGS), 'tudo');
});

test('um conjunto que nao e onda nenhuma nao finge ser', () => {
  assert.equal(
    matchingWave({
      ...DEFAULT_MODULE_FLAGS,
      cotacao: false,
      auditoria: true,
    }),
    null,
  );
});

test('mapa rota -> modulo, incluindo as sub-rotas', () => {
  const cases: [string, PortalModule | null][] = [
    ['/portal/cotacoes', 'cotacao'],
    ['/portal/cotacoes?tab=fechadas', null],
    ['/portal/cotacao/abc-123', 'cotacao'],
    ['/portal/nova-cotacao', 'cotacao'],
    // Fechamento direto so existe com a revisao de entrada da V2.
    ['/portal/nova-cotacao/fechamento-direto', 'cotacaoV2'],
    ['/portal/embarques', 'embarques'],
    ['/portal/embarques/EMB-1', 'embarques'],
    ['/portal/inteligencia', 'inteligencia'],
    ['/portal/inteligencia/performance', 'inteligencia'],
    // A aba Radar da Inteligencia e do modulo Inteligencia; o Radar do menu
    // mora em `/portal/radar`. Duas telas que so dividem uma palavra.
    ['/portal/inteligencia/radar', 'inteligencia'],
    ['/portal/radar', 'radar'],
    ['/portal/auditoria', 'auditoria'],
  ];
  for (const [pathname, expected] of cases) {
    assert.equal(moduleForRoute(pathname), expected, pathname);
  }
});

test('o prefixo mais especifico ganha: /portal/embarques/novo e via PO', () => {
  assert.equal(moduleForRoute('/portal/embarques/novo'), 'embarqueViaPo');
  assert.equal(moduleForRoute('/portal/embarques/novo/passo-2'), 'embarqueViaPo');
  assert.equal(moduleForRoute('/portal/embarques/novato'), 'embarques');
});

test('rota desconhecida nao pertence a modulo nenhum e fica liberada', () => {
  const nenhum = flagsForWave('onda0');
  for (const pathname of [
    '/portal/home',
    '/portal/visao-geral',
    '/portal/preferencias/agentes',
    '/portal/login',
    '/portal/tela-que-ainda-nao-existe',
    '/',
  ]) {
    assert.equal(moduleForRoute(pathname), null, pathname);
    assert.equal(isRouteReleased(pathname, nenhum), true, pathname);
  }
});

test('isRouteReleased segue a flag do modulo da rota', () => {
  const onda0 = flagsForWave('onda0');
  assert.equal(isRouteReleased('/portal/cotacoes', onda0), true);
  assert.equal(isRouteReleased('/portal/embarques', onda0), false);
  assert.equal(isRouteReleased('/portal/embarques/EMB-1', onda0), false);
  assert.equal(isRouteReleased('/portal/auditoria', onda0), false);
  assert.equal(isRouteReleased('/portal/auditoria', flagsForWave('onda3')), true);
});

test('JSON corrompido ou ausente cai no padrao — o portal inteiro liberado', () => {
  assert.deepEqual(parseModuleFlags(null), DEFAULT_MODULE_FLAGS);
  assert.deepEqual(parseModuleFlags('{nao e json'), DEFAULT_MODULE_FLAGS);
  assert.deepEqual(parseModuleFlags('"uma string"'), DEFAULT_MODULE_FLAGS);
  assert.deepEqual(parseModuleFlags('[1,2,3]'), DEFAULT_MODULE_FLAGS);
  assert.deepEqual(parseModuleFlags('null'), DEFAULT_MODULE_FLAGS);
});

test('modulo ausente do objeto gravado nasce no padrao, nao desligado', () => {
  // O caso real: um navegador que gravou as flags antes de o Prompt 2 existir.
  assert.deepEqual(parseModuleFlags('{"cotacao":false}'), {
    ...DEFAULT_MODULE_FLAGS,
    cotacao: false,
  });
});

test('campo de tipo errado nao contamina os outros', () => {
  assert.deepEqual(
    normalizeModuleFlags({ cotacao: 'sim', radar: false, lixo: 1 }),
    { ...DEFAULT_MODULE_FLAGS, radar: false },
  );
});

test('o que foi gravado sobrevive ao ciclo completo', () => {
  const flags = flagsForWave('onda2');
  assert.deepEqual(parseModuleFlags(JSON.stringify(flags)), flags);
});
