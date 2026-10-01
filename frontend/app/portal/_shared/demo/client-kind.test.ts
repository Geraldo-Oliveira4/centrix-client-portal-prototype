import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  allowsAutoFill,
  directCloseSources,
  poSources,
  quotationSources,
  shipmentSources,
} from './client-kind.ts';

test('só o Cliente Freitas recebe preenchimento automático', () => {
  assert.equal(allowsAutoFill('freitas'), true);
  assert.equal(allowsAutoFill('saas'), false);
});

test('SaaS puro: nenhuma tela diz que algo foi preenchido pela Freitas', () => {
  for (const sources of [quotationSources, directCloseSources, poSources, shipmentSources]) {
    assert.ok(sources('saas').every((line) => line.source !== 'freitas'), sources.name);
  }
});

test('SaaS puro: anexos e documentos ficam aguardando conferência', () => {
  for (const sources of [quotationSources, poSources, shipmentSources]) {
    assert.ok(sources('saas').some((line) => line.source === 'aguardando'), sources.name);
  }
});

test('rastreamento continua sincronizado nos dois tipos: vem do armador, não da Freitas', () => {
  for (const kind of ['freitas', 'saas'] as const) {
    assert.ok(shipmentSources(kind).some((line) => line.source === 'sincronizado'));
  }
});
