import assert from 'node:assert/strict';
import test from 'node:test';
import { failAt, state } from './LoginScene.ts';

test('escena del login: gris sin probar, naranja solo tras la estación donde falla, verde lo demás', () => {
  assert.equal(state(0, 2), 0);
  assert.deepEqual([1, 2, 3, 4, 5].map((p) => state(p, 2)), [1, 1, 2, 1, 1]); // falla en la 3ra y se recupera en la 4ta
  assert.deepEqual([1, 2, 3].map((p) => state(p, -1)), [1, 1, 1]);
  const fails = Array.from({ length: 160 }, (_, n) => failAt(n % 14, Math.floor(n / 14))).filter((f) => f >= 0);
  assert.ok(fails.length > 30 && fails.length < 70 && fails.every((f) => f < 5));
});
