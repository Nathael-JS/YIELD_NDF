import { test } from 'node:test';
import assert from 'node:assert/strict';
import { code128 } from './code128.ts';

const bits = (w: number[]) => w.map((n, i) => (i % 2 ? '0' : '1').repeat(n)).join('');

test('code128: inicio B, «A», verificador (104 + 33) % 103 = 34 y fin', () => {
  assert.equal(bits(code128('A')), '11010010000' + '10100011000' + '10001011000' + '1100011101011');
});

test('code128: cada símbolo mide 11 módulos (el fin 13) y no admite acentos', () => {
  const w = code128('PALFX98195');
  assert.equal(w.reduce((a, b) => a + b, 0), 11 * (10 + 2) + 13);
  assert.throws(() => code128('Ñ'));
});
