import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  FIRST_STEPS,
  FIRST_STEPS_DONE_BY_ACTION,
  nextFirstStep,
  type FirstStepsState,
} from './onboarding.ts';

test('every first step has a short description', () => {
  for (const step of FIRST_STEPS) {
    assert.ok(step.description.trim().length > 0, step.id);
    assert.ok(step.description.length <= 80, `${step.id} description too long`);
  }
});

test('every first step has its own action: a destination or the inline invite', () => {
  for (const step of FIRST_STEPS) {
    if (step.href) assert.match(step.href, /^\/portal\//);
    else assert.equal(step.id, 'colega');
  }
});

test('steps with a destination close by the action there, never by the click', () => {
  for (const step of FIRST_STEPS) {
    if (step.href) assert.ok(FIRST_STEPS_DONE_BY_ACTION.includes(step.id), step.id);
  }
});

test('a later step done first does not block or reorder the others', () => {
  const state: FirstStepsState = { done: ['colega', 'visao'], dismissed: false, justDone: null };
  assert.equal(nextFirstStep(state)?.id, 'cotacao');
});
