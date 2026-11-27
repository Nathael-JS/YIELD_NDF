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

test('validateEntregas: guarda solo los campos conocidos; rechaza DN vacío o piezas inválidas', async () => {
  const { validateEntregas } = await import('./validate.js');
  const v = validateEntregas({ archivo: 'download.xlsx', entregas: [{ dn: '5278000047', so: '2683000058', qty: 36, extra: 'x' }] });
  assert.equal(v.entregas[0].dn, '5278000047'); assert.equal(v.entregas[0].extra, undefined); assert.equal(v.entregas[0].po, '');
  assert.ok(validateEntregas({ archivo: 'a', entregas: [{ dn: '', qty: 1 }] }).error);
  assert.ok(validateEntregas({ archivo: 'a', entregas: [{ dn: '1', qty: -1 }] }).error);
  assert.ok(validateEntregas({ archivo: 'a', entregas: [] }).error);
});

test('validateTarima: Pallet # válido y en mayúsculas, textos acotados, campos desconocidos fuera', async () => {
  const { validateTarima } = await import('./validate.js');
  const v = validateTarima({ tarima: { pallet: ' palfx98195 ', dn: '5276000000', serials: 'A B', hack: 'x' } });
  assert.deepEqual([v.pallet, v.datos.dn, v.datos.serials, v.datos.hack, v.antes], ['PALFX98195', '5276000000', 'A B', undefined, null]);
  assert.ok(validateTarima({ tarima: { pallet: 'X-1' } }).error);
  assert.ok(validateTarima({ tarima: { pallet: 'PALFX1234', dn: 'x'.repeat(500) } }).error);
  assert.ok(validateTarima({}).error);
});

test('validateItems: DN válido, sin precio, piezas acotadas, campos desconocidos fuera', async () => {
  const { validateItems } = await import('./validate.js');
  const v = validateItems({ items: [{ dn: ' 9000000001 ', price: '100', hack: 1, so: '1', piezas: [{ serial: 'MT1', carton: 'FX1', manual: true, x: 1 }] }] });
  assert.equal(v.items[0].dn, '9000000001');
  assert.equal(v.items[0].price, undefined);
  assert.equal(v.items[0].hack, undefined);
  assert.deepEqual(v.items[0].piezas, [{ serial: 'MT1', sn: '', carton: 'FX1', pallet: '', estado: '', manual: true }]);
  assert.ok(validateItems({ items: [{ dn: 'a b', piezas: [] }] }).error);
  assert.ok(validateItems({ items: [{ dn: '1', piezas: [{ serial: '' }] }] }).error);
  assert.ok(validateItems({ items: [{ dn: '1', so: 'x'.repeat(400), piezas: [] }] }).error);
  assert.ok(validateItems({ items: [] }).error);
  assert.ok(validateItems({ items: [{ dn: '1', piezas: [] }, { dn: ' 1', piezas: [] }] }).error);
  const t = validateItems({ items: [{ dn: '2', piezas: [], liberados: ['PAL1'], piso: [{ pallet: 'PAL1', filas: [{ serial: 'MT1', carton: 'FX1', x: 1 }] }] }] });
  assert.deepEqual([t.items[0].liberados, t.items[0].piso], [['PAL1'], [{ pallet: 'PAL1', filas: [{ serial: 'MT1', carton: 'FX1' }] }]]);
  assert.ok(validateItems({ items: [{ dn: '3', piezas: [], piso: [{ pallet: 'P', filas: 'x' }] }] }).error);
  assert.ok(validateItems({ items: [{ dn: '4', piezas: [], liberados: [1] }] }).error);
});

test('validateCorte: corte AAAA-MM-DD HH:MM, enteros, resumen acotado y sin campos extra', async () => {
  const { validateCorte } = await import('./validate.js');
  const ok = { archivo: ' wip.xlsx ', corte: '2026-11-26 10:15:00', piezas: 3, terminadas: 1, resumen: [{ estacion: 'TEST', modelo: 'M1', piezas: 3, bloqueadas: 0, horas: 2.5, max: 4, serial: 'x' }] };
  const v = validateCorte(ok);
  assert.deepEqual([v.archivo, v.resumen[0].serial, v.resumen[0].horas], ['wip.xlsx', undefined, 2.5]);
  assert.ok(validateCorte({ ...ok, corte: 'ayer' }).error);
  assert.ok(validateCorte({ ...ok, piezas: -1 }).error);
  assert.ok(validateCorte({ ...ok, resumen: [{ estacion: 'T', piezas: 1, bloqueadas: 0, horas: NaN, max: 0 }] }).error);
  assert.ok(validateCorte({ ...ok, archivo: '' }).error);
  const d = validateCorte({ ...ok, detalle: [{ serial: 'S1', model: 'M', mo: 'O', station: 'TEST', prev: 'ASSY', at: '2026-11-27 10:00:00', hours: 2.3, blocked: true, x: 1 }] });
  assert.deepEqual(d.detalle, [{ serial: 'S1', model: 'M', mo: 'O', station: 'TEST', prev: 'ASSY', at: '2026-11-27 10:00:00', hours: 2.3, blocked: true }]);
  assert.deepEqual(validateCorte(ok).detalle, []);
  assert.ok(validateCorte({ ...ok, detalle: [{ serial: '', hours: 1 }] }).error);
  // terminadas: misma forma que el detalle; el tope de 25,000 es entre las dos
  const f = validateCorte({ ...ok, fin: [{ serial: 'S9', model: 'M', mo: 'O', station: 'STOCKIN', at: '2026-11-27 09:00:00', hours: 1 }] });
  assert.deepEqual(f.fin, [{ serial: 'S9', model: 'M', mo: 'O', station: 'STOCKIN', prev: '', at: '2026-11-27 09:00:00', hours: 1, blocked: false }]);
  assert.deepEqual(validateCorte(ok).fin, []);
  assert.ok(validateCorte({ ...ok, fin: [{ serial: 'S9' }] }).error);
  const muchas = Array.from({ length: 12501 }, (_, i) => ({ serial: `S${i}`, hours: 0 }));
  assert.match(validateCorte({ ...ok, detalle: muchas, fin: muchas }).error, /25,000/);
});

test('validateFlujo: 4 columnas en texto, estación y etapa obligatorias, sin campos extra', async () => {
  const { validateFlujo } = await import('./validate.js');
  const v = validateFlujo({ archivo: 'yield.csv', pasos: [{ stage: 'SMT', board: 'SWB', model: 'M', station: 'SPI_B', input: 3 }] });
  assert.deepEqual(v.pasos, [{ stage: 'SMT', board: 'SWB', model: 'M', station: 'SPI_B' }]);
  assert.ok(validateFlujo({ archivo: 'y', pasos: [] }).error);
  assert.ok(validateFlujo({ archivo: 'y', pasos: [{ stage: 'SMT', board: '', model: '', station: '' }] }).error);
  assert.ok(validateFlujo({ archivo: 'y', pasos: [{ stage: 'SMT', board: 1, model: '', station: 'X' }] }).error);
});
