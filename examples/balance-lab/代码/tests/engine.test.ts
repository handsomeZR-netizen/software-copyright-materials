import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, createSession, finishSession } from '../server/engine.ts';
import type { Action, Session } from '../shared/types.ts';

function run(actions: Action[], initial = createSession()) {
  return actions.reduce((s, action) => applyAction(s, action), initial);
}
const prepared: Action[] = [
  { type: 'check' },
  { type: 'rider', value: 0 },
  { type: 'nut', value: 0 },
  { type: 'object', side: 'left' },
];
const weighed: Action[] = [
  ...prepared,
  { type: 'addWeight', mass: 200, side: 'right' },
  { type: 'addWeight', mass: 100, side: 'right' },
  { type: 'addWeight', mass: 50, side: 'right' },
  { type: 'rider', value: 24 },
];
test('normal eight-stage exercise reaches 100 using exact integer arithmetic', () => {
  const s = run([...weighed, { type: 'read', value: 374 }, { type: 'tidy' }]);
  assert.equal(s.score, 100);
  assert.equal(s.reading, 374);
  assert.equal(s.events.filter((e) => e.violation).length, 0);
  assert.equal(s.objectSide, 'box');
  assert.deepEqual(s.weights, []);
  assert.equal(s.rider, 0);
  assert.equal(finishSession(s).status, 'finished');
});
test('checks latch without duplicate score and fresh sessions reset everything', () => {
  const s = run([{ type: 'check' }, { type: 'check' }]);
  assert.equal(s.score, 10);
  assert.equal(s.events.length, 2);
  assert.equal(createSession().score, 0);
  assert.equal(createSession().events.length, 0);
});
test('unzeroed, uncalibrated and reversed placement generate event violations', () => {
  for (const actions of [
    [{ type: 'nut', value: 0 }],
    [{ type: 'object', side: 'left' }],
    [...prepared, { type: 'object', side: 'right' }],
  ] as Action[][])
    assert.equal(run(actions).events.at(-1)?.violation, true);
});
test('hand placement cannot be redeemed by switching tool; remove and re-add corrects', () => {
  let s = run([
    ...prepared,
    { type: 'tool', value: 'hand' },
    { type: 'addWeight', mass: 200, side: 'right' },
    { type: 'tool', value: 'tweezers' },
    { type: 'addWeight', mass: 100, side: 'right' },
    { type: 'addWeight', mass: 50, side: 'right' },
    { type: 'rider', value: 24 },
  ]);
  assert.equal(s.steps[5].passed, false);
  s = run(
    [
      { type: 'removeWeight', index: 2 },
      { type: 'removeWeight', index: 1 },
      { type: 'removeWeight', index: 0 },
      { type: 'addWeight', mass: 200, side: 'right' },
      { type: 'addWeight', mass: 100, side: 'right' },
      { type: 'addWeight', mass: 50, side: 'right' },
      { type: 'rider', value: 24 },
    ],
    s,
  );
  assert.equal(s.steps[5].passed, true);
});
test('overheavy trial can be removed before selecting a smaller weight', () => {
  const s = run([
    ...prepared,
    { type: 'addWeight', mass: 500, side: 'right' },
    { type: 'removeWeight', index: 0 },
    ...weighed.slice(4),
  ]);
  assert.equal(s.balanced, true);
  assert.equal(s.steps[5].passed, true);
});
test('increasing weights are logged and cannot complete micro adjustment', () => {
  const s = run([
    ...prepared,
    { type: 'addWeight', mass: 50, side: 'right' },
    { type: 'addWeight', mass: 100, side: 'right' },
    { type: 'addWeight', mass: 200, side: 'right' },
    { type: 'rider', value: 24 },
  ]);
  assert.equal(s.balanced, true);
  assert.equal(s.steps[5].passed, false);
  assert.equal(s.events.filter((e) => e.violation).length, 2);
});
test('incorrect, premature, or subsequently unbalanced readings never pass', () => {
  const balanced = run(weighed);
  assert.equal(run([{ type: 'read', value: 373 }], balanced).steps[6].passed, false);
  assert.equal(
    run(
      [
        { type: 'rider', value: 25 },
        { type: 'read', value: 374 },
      ],
      balanced,
    ).steps[6].passed,
    false,
  );
  assert.equal(run([{ type: 'read', value: 374 }]).steps[6].passed, false);
});
test('nut adjustment under load invalidates calibration even when set back to zero', () => {
  let s = run([
    ...weighed,
    { type: 'nut', value: 1 },
    { type: 'nut', value: 0 },
    { type: 'read', value: 374 },
  ]);
  assert.equal(s.calibrated, false);
  assert.equal(s.steps[6].passed, false);
  s = run(
    [
      { type: 'object', side: 'box' },
      { type: 'removeWeight', index: 2 },
      { type: 'removeWeight', index: 1 },
      { type: 'removeWeight', index: 0 },
      { type: 'rider', value: 0 },
      { type: 'nut', value: 0 },
    ],
    s,
  );
  assert.equal(s.calibrated, true);
});
test('finished records immutable and partial completion can be archived', () => {
  const s = finishSession(run(prepared));
  assert.equal(s.score, 50);
  assert.throws(() => applyAction(s, { type: 'tidy' }));
  assert.deepEqual(finishSession(s), s);
});
test('invalid action values and missing/duplicate weights rejected without mutation', () => {
  const s = run(prepared);
  const saved = structuredClone(s);
  for (const action of [
    { type: 'rider', value: 2.5 },
    { type: 'nut', value: 6 },
    { type: 'addWeight', mass: 30, side: 'right' },
    { type: 'removeWeight', index: 0 },
    { type: 'noSuchAction' },
  ])
    assert.throws(() => applyAction(s, action as Action));
  assert.deepEqual(s, saved);
  const once = run([{ type: 'addWeight', mass: 200, side: 'right' }], s);
  assert.throws(() =>
    applyAction(once, { type: 'addWeight', mass: 200, side: 'right' }),
  );
});
