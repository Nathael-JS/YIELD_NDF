import { test } from 'node:test';
import assert from 'node:assert/strict';
import { binCounts, niceRange, niceStep } from './chart.ts';

test('niceStep redondea a 1, 2, 2.5, 5, 10', () => {
  assert.equal(niceStep(0.7), 1);
  assert.equal(niceStep(18), 20);
  assert.equal(niceStep(23), 25);
  assert.equal(niceStep(420), 500);
  assert.equal(niceStep(0), 1);
});

test('niceRange cubre el rango con pasos limpios', () => {
  assert.deepEqual(niceRange(0, 42), { lo: 0, hi: 50, step: 10, n: 5 });
  const r = niceRange(5, 5);
  assert.ok(r.hi > r.lo);
});

test('binCounts no pierde valores, incluido el máximo en un borde', () => {
  const vals = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const r = binCounts(vals, 5);
  assert.equal(r.counts.reduce((a, b) => a + b, 0), vals.length);
  assert.equal(r.lo, 0);
});
