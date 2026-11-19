import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cruce, desde, estadoOf, nivel, readWip, stations, urgente } from './wip.ts';
import type { Rec } from './tcqs.ts';

const H = ['SERIAL_NUMBER', 'MODEL_NAME', 'MO_NUMBER', 'TARGET_QTY', 'SECTION_NAME', 'WIP_GROUP', 'IN_STATION_TIME', 'HOUR', 'ERROR_FLAG'];
const row = (sn: string, g: string, at: string, h: number, flag = '0', sec = 'SI') => [sn, 'SA1', 'M1', 10, sec, g, at, h, flag];

test('readWip: sin repetidas, sin terminadas ni empaque, corte = llegada + horas', () => {
  const r = readWip({ headers: H, rows: [
    row('a', 'WC_KIT_PRESSURE', '2026/11/19 06:00:00', 2.2), row('a', 'WC_KIT_PRESSURE', '2026/11/19 06:00:00', 2.2), // fila repetida del MES
    row('b', 'R_WC_KIT_PRESSURE', '2026/11/14 08:00:00', 120.2, '1'), row('c', 'STOCKIN', '2026/11/18 08:00:00', 24.2),
    row('d', 'PACK_CTN', '2026/11/19 08:00:00', 0.2), row('e', 'B28M', '2026/11/19 07:00:00', 1.2, '0', 'SMT'), ['', 'SA1', 'M1', 10, 'SI', 'FT', '', '', '0'],
  ] });
  assert.deepEqual(r.bad, [8]); // fila 8 del Excel (con el encabezado)
  assert.deepEqual(r.piezas.map((p) => [p.serial, p.estado, p.blocked]), [['a', 'Línea', false], ['b', 'Reparación', true], ['e', 'Bonpile', false]]);
  assert.deepEqual([r.terminadas.map((p) => p.serial), r.ocultas.map((p) => p.serial)], [['c'], ['d']]);
  assert.equal(r.corte, '2026-11-19 08:12:00');
  const st = stations(r.piezas, [{ date: '2026-11-18', model: 'SA1', mo: 'M1', group: 'WC_KIT_PRESSURE', tester: 't', input: 10, fp: 8, ff: 2, sp: 1 }]);
  assert.deepEqual(st.map((s) => [s.name, s.fpy]), [['B28M', NaN], ['WC_KIT_PRESSURE', 80], ['R_WC_KIT_PRESSURE', NaN]]); // SMT antes que SI
  assert.deepEqual(stations([{ ...r.piezas[0], section: 'ZZ' }, { ...r.piezas[1], section: 'AA' }, { ...r.piezas[2], section: 'ZZ', station: 'X' }], []).map((s) => s.section), ['AA', 'ZZ', 'ZZ']); // secciones desconocidas juntas
  assert.deepEqual(cruce(r.piezas, [{ mo: 'M2' } as Rec]), { soloWip: ['M1'], soloTcqs: ['M2'] });
});

test('criticidad y estados', () => {
  assert.deepEqual([1.9, 2, 19.9, 20, 100].map(nivel), ['ok', 'warn', 'warn', 'bad', 'bad']);
  assert.deepEqual([100, 100.1].map(urgente), [false, true]);
  assert.deepEqual(['HOLD-FT', 'B31M', 'R_ICT', 'REPAIR', 'ICT'].map(estadoOf), ['Hold', 'Bonpile', 'Reparación', 'Reparación', 'Línea']);
});

test('desde: hora, turno (6/14/22), día y semana desde el lunes', () => {
  const c = '2026-11-19 08:12:00'; // jueves
  assert.deepEqual(['hora', 'turno', 'dia', 'semana', 'todo'].map((v) => desde(c, v as never)),
    ['2026-11-19 07:12:00', '2026-11-19 06:00:00', '2026-11-19 00:00:00', '2026-11-16 00:00:00', '']);
  assert.equal(desde('2026-11-19 03:00:00', 'turno'), '2026-11-18 22:00:00');
});
