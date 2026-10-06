import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FLOATING_EDGE_PX,
  FLOATING_GAP_PX,
  FLOATING_HEIGHT_PX,
  barOccupancy,
  compactFloating,
  contentPadding,
  floatingOffset,
  rectFromIframe,
} from './floating-safe-area.ts';

const VH = 900;

test('barra fixa na base ocupa da borda de cima dela até o fim da janela', () => {
  // decisionBar: bottom 14px, 72px de altura.
  assert.equal(barOccupancy({ top: VH - 86, bottom: VH - 14 }, VH), 86);
});

test('barra que não está presa ao rodapé não conta', () => {
  assert.equal(barOccupancy({ top: 200, bottom: 280 }, VH), 0); // no meio da página
  assert.equal(barOccupancy({ top: VH + 10, bottom: VH + 80 }, VH), 0); // fora da tela
  assert.equal(barOccupancy({ top: VH - 50, bottom: VH - 50 }, VH), 0); // sem altura
});

test('sem barra, nada sobe e o conteúdo fica com o padding de sempre', () => {
  assert.equal(floatingOffset([]), 0);
  assert.equal(floatingOffset([0, 0]), 0);
  assert.equal(contentPadding(0), 0);
  assert.equal(compactFloating(0, 390), false);
});

test('com barra, o flutuante sobe acima da mais alta, com folga — nunca a cobre', () => {
  const offset = floatingOffset([86, 40]);
  assert.equal(offset, 86 + FLOATING_GAP_PX - FLOATING_EDGE_PX);
  // Base do botão (borda + offset) fica acima do topo da barra, com a folga.
  const buttonBottom = FLOATING_EDGE_PX + offset;
  assert.ok(buttonBottom >= 86 + FLOATING_GAP_PX);
  // E o conteúdo ganha espaço para a barra + o botão.
  assert.equal(contentPadding(offset), offset + FLOATING_EDGE_PX * 2 + FLOATING_HEIGHT_PX);
});

test('barra alta no celular (botão empilhado): ainda acima dela, e Ajuda só com ícone', () => {
  const occupancy = barOccupancy({ top: VH - 168, bottom: VH - 8 }, VH);
  const offset = floatingOffset([occupancy]);
  assert.ok(FLOATING_EDGE_PX + offset > occupancy);
  assert.equal(compactFloating(offset, 390), true);
  assert.equal(compactFloating(offset, 1440), false);
});

test('rodapé de gaveta dentro de iframe vira coordenada da janela de fora', () => {
  // iframe começa a 170px do topo; a barra está a 660..730 dentro dele.
  const outer = rectFromIframe(170, { top: 660, bottom: 730 });
  assert.deepEqual(outer, { top: 830, bottom: 900 });
  assert.equal(barOccupancy(outer, VH), 70);
  // Iframe terminando 32px acima da base (padding do layout) ainda conta.
  assert.equal(barOccupancy(rectFromIframe(138, { top: 660, bottom: 730 }), VH), 102);
});
