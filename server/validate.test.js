import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate } from './validate.js';

const fila = { fecha: '2026-11-05', modelo: 'SA029400', estacion: 'FT', entradas: 5, primer_pase: 4, primera_falla: 1, segundo_pase: 1 };

test('validate acepta un resumen correcto y rechaza lo demás', () => {
  assert.deepEqual(validate({ archivo: 'tcqs.csv', filas: [fila] }).filas, [fila]);
  assert.match(validate(null).error, /Se esperaba/);
  assert.match(validate({ archivo: 'x', filas: [] }).error, /Entre 1/);
  assert.match(validate({ archivo: 'x', filas: [{ ...fila, fecha: '2026-13-45' }] }).error, /Fila 1/);
  assert.match(validate({ archivo: 'x', filas: [{ ...fila, entradas: -1 }] }).error, /Fila 1/);
  assert.match(validate({ archivo: 'x', filas: [{ ...fila, modelo: "x'; drop table yield_resumen;--".repeat(4) }] }).error, /Fila 1/);
  assert.match(validate({ archivo: 'x', filas: [{ ...fila, entradas: 9 }] }).error, /Fila 1/); // entradas ≠ 1er pase + 1ra falla
});
