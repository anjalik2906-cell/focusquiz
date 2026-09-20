import test from 'node:test';
import assert from 'node:assert/strict';
import { SessionEngine } from './engine.js';
import { makeConfig } from './config.js';

function make(demo = false) {
  let t = 1_000_000;
  const engine = new SessionEngine({
    chunks: ['alpha alpha alpha', 'beta beta beta', 'gamma gamma gamma'],
    cfg: makeConfig(demo),
    goalMs: 60000,
    clock: () => t
  });
  const triggers = [];
  engine.setTriggerHandler((q) => triggers.push(q));
  return { engine, triggers, advance: (ms) => (t += ms) };
}

test('a 20s absence is a distraction that triggers a recall quiz on the chunk being read', () => {
  const { engine, triggers, advance } = make();
  engine.setCurrent(1);
  engine.leave();
  advance(20000);
  engine.comeBack();
  assert.equal(engine.distractions, 1);
  assert.equal(engine.chunks[1].distractions, 1);
  assert.equal(triggers.length, 1);
  assert.equal(triggers[0].idx, 1);
  assert.equal(triggers[0].tier, 'recall');
  assert.equal(engine.segments.length, 1);
});

test('an absence past the long threshold asks a concept question', () => {
  const { engine, triggers, advance } = make();
  engine.leave();
  advance(130000);
  engine.comeBack();
  assert.equal(triggers[0].tier, 'concept');
});

test('sub-300ms flicker is ignored', () => {
  const { engine, triggers, advance } = make();
  engine.leave();
  advance(100);
  engine.comeBack();
  assert.equal(engine.distractions, 0);
  assert.equal(triggers.length, 0);
  assert.equal(engine.segments.length, 0);
});

test('three short switches inside the window flag fragmented attention', () => {
  const { engine, triggers, advance } = make();
  for (let i = 0; i < 3; i++) {
    engine.leave();
    advance(2000);
    engine.comeBack();
    advance(3000);
    if (i < 2) assert.equal(triggers.length, 0);
  }
  assert.equal(engine.fragmented, 1);
  assert.equal(engine.distractions, 0);
  assert.equal(triggers.length, 1);
});

test('short switches spread wider than the window do not count', () => {
  const { engine, triggers, advance } = make();
  for (let i = 0; i < 3; i++) {
    engine.leave();
    advance(2000);
    engine.comeBack();
    advance(40000);
  }
  assert.equal(engine.fragmented, 0);
  assert.equal(triggers.length, 0);
});

test('only one quiz is open at a time', () => {
  const { engine, triggers, advance } = make();
  for (let i = 0; i < 2; i++) {
    engine.leave();
    advance(20000);
    engine.comeBack();
  }
  assert.equal(engine.distractions, 2);
  assert.equal(triggers.length, 1);
  engine.closeQuiz();
  engine.leave();
  advance(20000);
  engine.comeBack();
  assert.equal(triggers.length, 2);
});

test('going idle triggers a quiz once, activity clears idle', () => {
  const { engine, triggers, advance } = make();
  advance(61000);
  engine.tick();
  assert.equal(engine.idleEvents, 1);
  assert.equal(triggers.length, 1);
  advance(1000);
  engine.tick();
  assert.equal(engine.idleEvents, 1);
  assert.equal(engine.getSnapshot().status, 'idle');
  engine.activity();
  assert.equal(engine.getSnapshot().status, 'focused');
});

test('dwell time accrues on the current chunk only while active', () => {
  const { engine, advance } = make();
  engine.setCurrent(2);
  for (let i = 0; i < 5; i++) {
    advance(1000);
    engine.activity();
    engine.tick();
  }
  assert.equal(engine.chunks[2].dwell, 5);
  assert.equal(engine.chunks[0].dwell, 0);
});

test('wrong answers are re-quizzed after half the delay; right re-quiz answers leave the queue', () => {
  const { engine, triggers, advance } = make();
  engine.grade(0, false, false);
  assert.equal(engine.queue.length, 1);
  assert.equal(engine.queue[0].dueAt - engine.clock(), engine.cfg.requizMs / 2);
  advance(engine.cfg.requizMs / 2 + 1);
  engine.activity();
  engine.tick();
  assert.equal(triggers.length, 1);
  assert.equal(triggers[0].isRequiz, true);
  assert.equal(triggers[0].label, 'Quick review');
  engine.grade(0, true, true);
  assert.equal(engine.queue.length, 0);
});

test('simulated absences advance the session clock and are counted', () => {
  const { engine, triggers } = make(true);
  engine.simulateAway(engine.cfg.distractMs + 2000);
  assert.equal(engine.distractions, 1);
  assert.equal(triggers.length, 1);
  const s = engine.end();
  assert.equal(s.totalMs, 5000);
  assert.equal(s.awayMs, 5000);
});

test('summary flags chunks to revisit and reports first distraction', () => {
  const { engine, advance } = make();
  advance(30000);
  engine.setCurrent(1);
  engine.leave();
  advance(20000);
  engine.comeBack();
  engine.grade(1, false, false);
  engine.closeQuiz();
  advance(10000);
  const s = engine.end();
  assert.deepEqual(s.revisit, [1]);
  assert.equal(s.firstDistractionMs, 30000);
  assert.equal(s.distractions, 1);
  assert.ok(s.focusScore < 100);
  assert.ok(s.insights.length > 0);
});
