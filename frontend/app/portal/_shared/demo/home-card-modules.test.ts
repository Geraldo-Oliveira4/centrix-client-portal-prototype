// Unit test do recorte de cards da Home por modulo. Mesmo runner:
//
//     npm run test:unit
//
// O QUE ERRA EM SILENCIO AQUI:
//
//   1. A Home desenhando exatamente o que o menu acabou de esconder. Com
//      "Meus Embarques" desligado, o card do mapa continuava plotando a
//      carteira inteira.
//   2. O contrario: esconder um card que NAO e do modulo desligado. "Economia"
//      sai das cotacoes do cliente; apaga-la porque a Inteligencia esta
//      desligada tiraria da tela um numero que ele tem direito de ver.
//   3. Os dois vazios virando um so. "Voce desligou tudo" e "os seus cards nao
//      estao liberados" pedem coisas diferentes do cliente, e so o primeiro tem
//      solucao no modal "Personalizar".

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PORTAL_HOME_CARD_MODULE,
  homeCardsHiddenByModule,
  releasedHomeCards,
} from './home-card-modules.ts';
import { DEFAULT_MODULE_FLAGS, flagsForWave } from './feature-flags.ts';
import {
  PORTAL_HOME_LAYOUT_CARDS,
  PORTAL_HOME_THEMES,
  type PortalHomeCard,
} from '../../home/lib/home-layout.ts';

const ALL_CARDS = PORTAL_HOME_THEMES.flatMap(
  (theme) => PORTAL_HOME_LAYOUT_CARDS[theme],
);

test('todo card da Home esta na tabela — card novo nao passa despercebido', () => {
  for (const card of ALL_CARDS) {
    assert.ok(
      card in PORTAL_HOME_CARD_MODULE,
      `${card} nao foi mapeado a um modulo`,
    );
  }
  assert.equal(Object.keys(PORTAL_HOME_CARD_MODULE).length, ALL_CARDS.length);
});

test('com tudo liberado, nenhum card some', () => {
  assert.deepEqual(releasedHomeCards(ALL_CARDS, DEFAULT_MODULE_FLAGS), ALL_CARDS);
  assert.equal(homeCardsHiddenByModule(ALL_CARDS, DEFAULT_MODULE_FLAGS), 0);
});

test('o mapa some quando Meus Embarques esta desligado', () => {
  const onda1 = flagsForWave('onda1');
  assert.equal(onda1.embarques, false);
  const visible = releasedHomeCards(ALL_CARDS, onda1);
  assert.equal(visible.includes('mapa_embarques'), false);
  assert.equal(homeCardsHiddenByModule(ALL_CARDS, onda1), 1);
});

test('economia e tendencia FICAM com a Inteligencia desligada', () => {
  // Elas sao calculadas das cotacoes e dos embarques do proprio cliente; o que
  // aponta para a Inteligencia e o link de rodape, e quem some e ele.
  const semInteligencia = { ...DEFAULT_MODULE_FLAGS, inteligencia: false, radar: false };
  const visible = releasedHomeCards(ALL_CARDS, semInteligencia);
  assert.ok(visible.includes('economia'));
  assert.ok(visible.includes('tendencia_preco'));
  assert.equal(homeCardsHiddenByModule(ALL_CARDS, semInteligencia), 0);
});

test('"Sua acao mais urgente" nunca some — ele filtra as proprias linhas', () => {
  assert.equal(PORTAL_HOME_CARD_MODULE.acao_urgente, null);
  for (const wave of ['onda0', 'onda1', 'onda2', 'onda3', 'tudo'] as const) {
    assert.ok(
      releasedHomeCards(ALL_CARDS, flagsForWave(wave)).includes('acao_urgente'),
      wave,
    );
  }
});

test('na Onda 0 sobram os cards que nao sao de modulo nenhum', () => {
  const visible = releasedHomeCards(ALL_CARDS, flagsForWave('onda0'));
  assert.deepEqual(visible.sort(), ['acao_urgente', 'economia', 'tendencia_preco']);
});

test('a ordem dos cards e preservada', () => {
  const cards: PortalHomeCard[] = ['economia', 'mapa_embarques', 'acao_urgente'];
  assert.deepEqual(releasedHomeCards(cards, DEFAULT_MODULE_FLAGS), cards);
});

test('lista vazia entra e sai vazia, sem esconder nada', () => {
  assert.deepEqual(releasedHomeCards([], flagsForWave('onda0')), []);
  assert.equal(homeCardsHiddenByModule([], flagsForWave('onda0')), 0);
});

test('so o mapa escolhido + modulo desligado = Home vazia POR MODULO', () => {
  // E o caso que a tela precisa distinguir: o cliente escolheu so o tema
  // "Mapa" e a empresa nao tem Meus Embarques. Mandar ele a "Personalizar"
  // seria mandar procurar um botao que nao liga modulo.
  const soMapa: PortalHomeCard[] = ['mapa_embarques'];
  const onda1 = flagsForWave('onda1');
  assert.deepEqual(releasedHomeCards(soMapa, onda1), []);
  assert.equal(homeCardsHiddenByModule(soMapa, onda1), 1);
});
