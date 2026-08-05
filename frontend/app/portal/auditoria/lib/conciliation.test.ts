// Unit test da agregação de causas de divergência. Mesmo runner dos outros:
//
//     npm run test:unit
//
// Existe porque o bloco "Causas mais comuns" é fácil de olhar e achar plausível
// mesmo errado: barras ordenadas com percentuais que somam ~100 parecem certas
// venha o denominador de onde vier. O teste fixa o denominador (linhas
// divergentes, não embarques) e o comportamento em item novo, que é o que
// precisa continuar valendo quando a fonte virar NF final de verdade.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  computeDivergenceCauses,
  CONCILIATION_EXAMPLES,
} from './conciliation.ts';

/** Um exemplo com as linhas informadas; rota/agente não afetam a agregação. */
const example = (reference, lines) => ({
  reference,
  route: 'Origem → Destino',
  agent: 'Agente de exemplo',
  lines,
});

const currency = (item, planned, realized) => ({
  item,
  kind: 'currency',
  planned,
  realized,
});

test('sem divergência nenhuma, o ranking é vazio (não é uma lista de zeros)', () => {
  const causes = computeDivergenceCauses([
    example('E1', [currency('Frete', 1000, 1000), currency('Taxa THC', 500, 500)]),
  ]);
  assert.deepEqual(causes, []);
});

test('conta linhas divergentes, não embarques', () => {
  // Um único embarque com dois itens divergentes precisa contar DOIS, senão o
  // embarque "vale um" e o item mais caro some da leitura.
  const causes = computeDivergenceCauses([
    example('E1', [
      currency('Frete', 1000, 2000), // +100%
      currency('Taxa THC', 500, 1000), // +100%
      currency('Prazo', 1000, 1000), // bate
    ]),
  ]);
  assert.equal(causes.length, 2);
  assert.equal(
    causes.reduce((sum, c) => sum + c.count, 0),
    2,
  );
});

test('as participações somam 100%', () => {
  const causes = computeDivergenceCauses(CONCILIATION_EXAMPLES);
  const total = causes.reduce((sum, c) => sum + c.sharePct, 0);
  assert.ok(Math.abs(total - 100) < 0.5, `somou ${total}`);
});

test('ordena por frequência, com o nome do item desempatando', () => {
  const causes = computeDivergenceCauses([
    example('E1', [currency('Zebra', 100, 200), currency('Alfa', 100, 200)]),
    example('E2', [currency('Prazo', 100, 200)]),
    example('E3', [currency('Prazo', 100, 200)]),
  ]);
  // Prazo lidera com 2; Alfa antes de Zebra no empate em 1.
  assert.deepEqual(
    causes.map((c) => c.item),
    ['Prazo', 'Alfa', 'Zebra'],
  );
});

test('uma diferença abaixo do limite não entra como causa', () => {
  // 2% de variação: diferente de zero, mas dentro do limite de divergência.
  // Se entrasse, o bloco reportaria como problema um fechamento que a tabela de
  // detalhe marca como "Bate".
  const causes = computeDivergenceCauses([
    example('E1', [currency('Frete', 10000, 10200)]),
  ]);
  assert.deepEqual(causes, []);
});

test('divergência para BAIXO também é causa', () => {
  // Veio a menos, não há o que contestar — mas divergiu, e a leitura de "o que
  // costuma sair diferente do combinado" precisa enxergar isso.
  const causes = computeDivergenceCauses([
    example('E1', [currency('Frete', 10000, 8000)]),
  ]);
  assert.equal(causes.length, 1);
  assert.equal(causes[0].item, 'Frete');
});

test('item novo entra sozinho, sem lista fixa de itens', () => {
  // A função não pode conhecer "Frete/THC/Prazo": quando o realizado vier da NF
  // final, itens que ninguém previu aparecem e precisam ser ranqueados.
  const causes = computeDivergenceCauses([
    example('E1', [currency('Sobrestadia', 100, 500)]),
  ]);
  assert.deepEqual(
    causes.map((c) => c.item),
    ['Sobrestadia'],
  );
});

test('os exemplos semeados produzem um ranking com mais de um item', () => {
  // Guarda a demo: se alguém "limpar" os exemplos e sobrar um único desfecho, o
  // bloco vira uma barra só de 100% e deixa de mostrar comparação nenhuma.
  const causes = computeDivergenceCauses(CONCILIATION_EXAMPLES);
  assert.ok(causes.length >= 3, `apenas ${causes.length} causas`);
  assert.ok(causes[0].sharePct >= causes[causes.length - 1].sharePct);
});
