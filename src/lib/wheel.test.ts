import { test } from 'node:test';
import assert from 'node:assert/strict';
import { offset, pose, step } from './wheel.ts';

test('offset: el camino más corto alrededor del carrusel', () => {
  assert.deepEqual([0, 1, 2].map((i) => offset(i, 0, 3)), [0, 1, -1]); // con 3, la del frente y una a cada lado
  assert.deepEqual([0, 1, 2].map((i) => offset(i, 2, 3)), [1, -1, 0]);
});

test('pose: la del frente derecha y encima; las de los lados giradas hacia adentro, atrás y más tenues', () => {
  const [l, c, r] = [2, 0, 1].map((i) => pose(i, 0, 3));
  assert.deepEqual([c.x, c.rotate, c.scale, c.opacity], [0, -0, 1, 1]);
  assert.ok(l.x < 0 && l.rotate > 0 && r.x > 0 && r.rotate < 0);
  assert.ok(c.zIndex > l.zIndex && l.zIndex === r.zIndex && l.z < 0);
});

test('step: ← → dan la vuelta', () => {
  assert.deepEqual([step(2, 1, 3), step(0, -1, 3)], [0, 2]);
});
