import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate } from './validate.js';

const fila = { fecha: '2026-11-05', modelo: 'SA029400', estacion: 'FT', entradas: 5, primer_pase: 4, primera_falla: 1, segundo_pase: 1 };

test('validate acepta un resumen correcto y rechaza lo demás', () => {
  const ok = { archivo: 'tcqs.csv', sesion: 's1', usuario: 'Usuario de prueba' };
  assert.deepEqual(validate({ ...ok, filas: [fila] }).filas, [fila]);
  assert.match(validate(null).error, /Se esperaba/);
  assert.match(validate({ ...ok, filas: [] }).error, /Entre 1/);
  assert.match(validate({ ...ok, filas: [{ ...fila, fecha: '2026-13-45' }] }).error, /Fila 1/);
  assert.match(validate({ ...ok, filas: [{ ...fila, entradas: -1 }] }).error, /Fila 1/);
  assert.match(validate({ ...ok, filas: [{ ...fila, modelo: "x'; drop table yield_resumen;--".repeat(4) }] }).error, /Fila 1/);
  assert.match(validate({ ...ok, filas: [{ ...fila, entradas: 9 }] }).error, /Fila 1/); // entradas ≠ 1er pase + 1ra falla
  // congruencia: opcional, objeto chico
  assert.equal(validate({ ...ok, filas: [fila] }).congruencia, null);
  assert.deepEqual(validate({ ...ok, filas: [fila], congruencia: { filas: 1 } }).congruencia, { filas: 1 });
  assert.match(validate({ ...ok, filas: [fila], congruencia: [1] }).error, /Congruencia/);
  assert.match(validate({ ...ok, filas: [fila], congruencia: { x: 'a'.repeat(17000) } }).error, /Congruencia/);
});
