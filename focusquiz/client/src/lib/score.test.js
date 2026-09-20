import test from 'node:test';
import assert from 'node:assert/strict';
import { computeScore } from './score.js';

test('perfect session scores 100', () => {
  const r = computeScore({ totalMs: 60000, awayMs: 0, fragmented: 0, right: 3, wrong: 0 });
  assert.equal(r.score, 100);
  assert.equal(r.accuracy, 1);
});

test('away time, fragmentation and wrong answers pull the score down', () => {
  const r = computeScore({ totalMs: 100000, awayMs: 20000, fragmented: 2, right: 1, wrong: 1 });
  // 100 - 20 - 10 + 10 * 0.5 = 75
  assert.equal(r.score, 75);
  assert.equal(Math.round(r.awayPct), 20);
});

test('score is clamped and accuracy is null with no answers', () => {
  const r = computeScore({ totalMs: 1000, awayMs: 1000, fragmented: 10, right: 0, wrong: 0 });
  assert.equal(r.score, 0);
  assert.equal(r.accuracy, null);
});
