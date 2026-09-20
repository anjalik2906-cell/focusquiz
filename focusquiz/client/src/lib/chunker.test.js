import test from 'node:test';
import assert from 'node:assert/strict';
import { chunkText } from './chunker.js';
import { SAMPLE_TEXT } from './sample.js';

test('splits on blank lines', () => {
  assert.equal(chunkText(SAMPLE_TEXT).length, 5);
});

test('falls back to three sentences per chunk for one big paragraph', () => {
  const blob = 'One. Two. Three. Four. Five. Six. Seven.';
  const chunks = chunkText(blob);
  assert.deepEqual(chunks, ['One. Two. Three.', 'Four. Five. Six.', 'Seven.']);
});

test('drops empty chunks', () => {
  assert.deepEqual(chunkText('a a a\n\n\n\nb b b\n\n   \n\nc c c'), ['a a a', 'b b b', 'c c c']);
});
