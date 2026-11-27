import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agrupar, cambioPorEstacion, cruce, desde, estadoOf, nivel, ordenes, readWip, stations, urgente, detalleWip, flujoDe, readFlujo, resumenWip, semana, tendencia, turno, ubicar, filtrar, FILTRO0, lugarDe } from './wip.ts';
import type { Rec } from './tcqs.ts';

const H = ['SERIAL_NUMBER', 'MODEL_NAME', 'MO_NUMBER', 'TARGET_QTY', 'SECTION_NAME', 'WIP_GROUP', 'IN_STATION_TIME', 'HOUR', 'ERROR_FLAG'];
const row = (sn: string, g: string, at: string, h: number, flag = '0', sec = 'SI') => [sn, 'SA1', 'M1', 10, sec, g, at, h, flag];

test('readWip: sin repetidas, sin terminadas ni empaque, corte = llegada + horas', () => {
  const r = readWip({ headers: H, rows: [
    row('a', 'WC_KIT_PRESSURE', '2026/11/19 06:00:00', 2.2), row('a', 'WC_KIT_PRESSURE', '2026/11/19 06:00:00', 2.2), // fila repetida del MES
    row('b', 'R_WC_KIT_PRESSURE', '2026/11/14 08:00:00', 120.2, '1'), row('c', 'STOCKIN', '2026/11/18 08:00:00', 24.2),
    row('d', 'PACK_CTN', '2026/11/19 08:00:00', 0.2), row('e', 'B28M', '2026/11/19 07:00:00', 1.2, '0', 'SMT'), ['', 'SA1', 'M1', 10, 'SI', 'FT', '', '', '0'],
  ] });
  assert.deepEqual(r.bad, [8]);
  assert.equal(readWip({ headers: H, rows: [row('x', 'FT', '2026/11/19 08:00:00', '0,5' as never)] }).piezas[0].hours, 0.5); // coma decimal
  assert.equal(readWip({ headers: H, rows: [row('x', 'FT', 46345.34374 as never, 0)] }).piezas[0].at, '2026-11-19 08:14:59'); // serial de Excel, al segundo // fila 8 del Excel (con el encabezado)
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

test('reporte por orden (sin HOUR): horas hasta la carga, último movimiento y orden de la ruta', () => {
  const H2 = ['SERIAL_NUMBER', 'MO_NUMBER', 'MODEL_NAME', 'SECTION_NAME', 'GROUP_NAME', 'WIP_GROUP', 'IN_STATION_TIME', 'ERROR_FLAG'];
  const f = { headers: H2, rows: [
    ['a', '127526', 'SA1', 'SI', 'WC_PRESSURE', 'WC_WATER_FILL', '2026/11/23 08:00:00', '0'],
    ['b', '127526', 'SA1', 'SI', 'WC_WATER_FILL', 'FT', '2026/11/23 09:30:00', '0'],
    ['c', '127526', 'SA1', 'SI', 'FT', 'FATP_VI', '2026/11/21 10:00:00', '0'],
    ['d', '127526', 'SA1', 'SI', 'FATP_VI', 'STOCKIN', '2026/11/22 10:00:00', '0'],
  ] };
  const r = readWip(f, '2026-11-23 10:00:00');
  assert.deepEqual([r.formato, r.fuente, r.ultimo, r.corte], ['por orden', 'carga', '2026-11-23 09:30:00', '2026-11-23 10:00:00']);
  assert.deepEqual(r.piezas.map((p) => [p.serial, p.hours]), [['a', 2], ['b', 0.5], ['c', 48]]);
  // sin hora de carga (archivo guardado antes): hasta el último movimiento
  assert.deepEqual([readWip(f).fuente, readWip(f).piezas[0].hours], ['movimiento', 1.5]);
  // la ruta sale de GROUP_NAME → WIP_GROUP: WC_WATER_FILL → FT → FATP_VI, aunque FT tenga menos piezas
  assert.deepEqual(stations(r.piezas, []).map((s) => s.name), ['WC_WATER_FILL', 'FT', 'FATP_VI']);
  assert.deepEqual(ordenes(r.piezas, r.terminadas, r.ocultas).map((o) => [o.mo, o.n, o.linea, o.terminadas, o.max]), [['127526', 3, 3, 1, 48]]);
});

test('rutas: las estaciones de una misma ruta quedan juntas, la ruta corta primero', () => {
  const P = (s: string, prev: string, station: string) => ({ serial: s, model: 'SA1', mo: 'M', section: 'SI', station, prev, line: '', at: '2026-11-23 08:00:00', hours: 1, blocked: false, estado: 'Línea' as const });
  const ps = [P('a', 'WC_PRESSURE', 'WC_WATER_FILL'), P('b', 'WC_WATER_FILL', 'FT'), P('c', 'FT', 'FATP_VI'), P('d', 'SYS_ASSY_VI', 'J_TAG'), P('e', 'J_TAG', 'ASSY_CHASSIS')];
  assert.deepEqual(stations(ps, []).map((s) => s.name), ['J_TAG', 'ASSY_CHASSIS', 'WC_WATER_FILL', 'FT', 'FATP_VI']);
});

test('WIP general y por orden juntos: las filas sin HOUR se cuentan hasta el corte del general', () => {
  const H3 = ['SERIAL_NUMBER', 'MODEL_NAME', 'MO_NUMBER', 'SECTION_NAME', 'WIP_GROUP', 'IN_STATION_TIME', 'HOUR', 'ERROR_FLAG'];
  const r = readWip({ headers: H3, rows: [['g', 'SA1', 'M1', 'SI', 'FT', '2026/11/19 06:00:00', 2, '0'], ['o', 'SA1', 'M2', 'SI', 'FT', '2026/11/17 08:00:00', null, '0']] });
  assert.equal(r.corte, '2026-11-19 08:00:00');
  assert.deepEqual(r.piezas.map((p) => [p.serial, p.hours]), [['g', 2], ['o', 48]]);
});

test('resumenWip: por estación × modelo, bloqueadas y horas promedio/máxima, de mayor a menor', () => {
  const p = (station: string, model: string, hours: number, blocked = false) => ({ station, model, hours, blocked }) as Parameters<typeof resumenWip>[0]['piezas'][number];
  const r = resumenWip({ piezas: [p('TEST', 'A', 2), p('TEST', 'A', 5, true), p('ASSY', 'A', 1), p('TEST', 'B', 3)] });
  assert.deepEqual(r, [
    { estacion: 'TEST', modelo: 'A', piezas: 2, bloqueadas: 1, horas: 3.5, max: 5 },
    { estacion: 'ASSY', modelo: 'A', piezas: 1, bloqueadas: 0, horas: 1, max: 1 },
    { estacion: 'TEST', modelo: 'B', piezas: 1, bloqueadas: 0, horas: 3, max: 3 },
  ]);
});

test('readFlujo: encabezado en otro renglón, celdas vacías heredan stage/board/model; ubicar por modelo + estación', () => {
  const H = ['', '', '', '']; // el primer renglón del CSV viene vacío
  const rows = [['Proces Stage', 'Board Name', 'Model', 'Station', 'Input'], ['SMT/PCBA', 'SWB', 'M-1', 'SPI_B', 1], ['', '', '', 'AOI1_B', 1],
    ['', 'MGMT', 'M-2', 'SPI_B', 0], ['', '', '', 'VI', 0], ['SWB SA', 'SWB SA', 'SA1', 'ASSY_VI', 3], ['', '', 'SA2', 'ASSY_VI', 1], ['', '', '', '', '']];
  const { pasos, error } = readFlujo({ headers: H, rows });
  assert.equal(error, '');
  assert.deepEqual(pasos.map((p) => `${p.stage}|${p.board}|${p.model}|${p.station}`), [
    'SMT/PCBA|SWB|M-1|SPI_B', 'SMT/PCBA|SWB|M-1|AOI1_B', 'SMT/PCBA|MGMT|M-2|SPI_B', 'SMT/PCBA|MGMT|M-2|VI', 'SWB SA|SWB SA|SA1|ASSY_VI', 'SWB SA|SWB SA|SA2|ASSY_VI']);
  assert.equal(ubicar(pasos, 'SA2', 'ASSY_VI')?.model, 'SA2');
  assert.equal(ubicar(pasos, 'OTRO', 'VI')?.board, 'MGMT');
  assert.equal(ubicar(pasos, 'OTRO', 'NADA'), undefined);
  assert.ok(readFlujo({ headers: ['a'], rows: [['b']] }).error);
});

test('turno y semana del corte: T1 07:00–15:00, T2 15:00–22:30, pendiente de 22:30 a 07:00; semana ISO', () => {
  assert.deepEqual(['2026-11-27 06:59', '2026-11-27 07:00', '2026-11-27 14:59', '2026-11-27 15:00', '2026-11-27 22:29', '2026-11-27 22:30', '2026-11-28 02:00'].map(turno),
    ['pendiente', 'T1', 'T1', 'T2', 'T2', 'pendiente', 'pendiente']);
  assert.deepEqual(semana('2026-11-27 10:15'), ['2026-W48', 'Sem 48']);
});

test('detalleWip: solo los campos que se guardan, horas a un decimal', () => {
  const p = { serial: 'S1', model: 'M', mo: 'O', section: 'X', station: 'TEST', prev: 'ASSY', line: 'L1', at: '2026-11-27 10:00:00', hours: 2.345, blocked: false, estado: 'Línea' } as const;
  assert.deepEqual(detalleWip([p]), [{ serial: 'S1', model: 'M', mo: 'O', station: 'TEST', prev: 'ASSY', at: '2026-11-27 10:00:00', hours: 2.3, blocked: false }]);
});

test('flujoDe: piezas en su etapa/board/estación en el orden de la ruta, tono por la más vieja, urgentes y «Sin etapa»', () => {
  const pasos = [{ stage: 'SMT', board: 'SWB', model: 'M1', station: 'SPI' }, { stage: 'SMT', board: 'SWB', model: 'M1', station: 'AOI' }, { stage: 'SYS', board: 'FA', model: 'M2', station: 'FT' }];
  const ps = [{ model: 'M1', station: 'AOI', hours: 1 }, { model: 'M1', station: 'AOI', hours: 30 }, { model: 'M2', station: 'FT', hours: 150 }, { model: 'X', station: 'RARA', hours: 5 },
    { model: 'M2', station: 'R_FT', hours: 3 }, { model: 'M1', station: 'LINK_CARRIER_B', hours: 0.5 }];
  const { stages, piezasDe } = flujoDe(pasos, ps);
  assert.deepEqual(stages.map((s) => [s.stage, s.boards.map((b) => [b.board, b.stations.map((x) => `${x.station}:${x.n}:${x.tone}:${x.urgent}`)])]), [
    ['SMT', [['SWB', ['SPI:0:idle:0', 'AOI:2:bad:0', 'LINK_CARRIER_B:1:ok:0']]]], ['SYS', [['FA', ['FT:1:bad:1', 'R_FT:1:warn:0']]]], ['Sin etapa', [['', ['RARA:1:warn:0']]]]]);
  assert.equal(piezasDe('SMT', 'SWB', 'AOI').length, 2);
  assert.equal(flujoDe([], ps).stages[0].stage, 'Sin etapa');
});

test('agrupar: por campo de mayor a menor, por rango de tiempo en orden, y serial por horas', () => {
  const p = (serial: string, station: string, prev: string, hours: number) => ({ serial, model: 'M', mo: 'O1', station, prev, hours });
  const ps = [p('A', 'FT', 'ICT', 1), p('B', 'FT', '', 30), p('C', 'ICT', 'AOI', 400)];
  assert.deepEqual(agrupar(ps, 'station').map((g) => [g.label, g.value]), [['FT', 2], ['ICT', 1]]);
  assert.deepEqual(agrupar(ps, 'prev').map((g) => [g.label, g.value]), [['(sin dato)', 1], ['AOI', 1], ['ICT', 1]]);
  assert.deepEqual(agrupar(ps, 'tiempo').filter((g) => g.value).map((g) => g.label), ['< 2 h', '20–48 h', '> 2 sem']);
  assert.equal(agrupar(ps, 'tiempo').length, 8);
  assert.deepEqual(agrupar(ps, 'serial').map((g) => [g.label, g.value]), [['C', 400], ['B', 30], ['A', 1]]);
});

test('tendencia: por turno (sin el pendiente) con el último corte de cada uno, filtro T1/T2, y por semana', () => {
  const c = (corte: string, piezas: number) => ({ corte, piezas, bloqueadas: 0 });
  const cs = [c('2026-11-27 16:00', 30), c('2026-11-27 08:00', 10), c('2026-11-27 14:00', 12), c('2026-11-27 23:00', 99), c('2026-11-20 09:00', 5)];
  assert.deepEqual(tendencia(cs, 'turno').map((x) => [x.label, x.c.piezas]), [['20/11 T1', 5], ['27/11 T1', 12], ['27/11 T2', 30]]);
  assert.deepEqual(tendencia(cs, 'turno', 'T2').map((x) => x.label), ['27/11 T2']);
  assert.deepEqual(tendencia(cs, 'semana').map((x) => [x.label, x.c.piezas]), [['Sem 47', 5], ['Sem 48', 99]]);
});

test('cambioPorEstacion: suma modelos por estación y ordena por el cambio más grande', () => {
  const r = (estacion: string, piezas: number, bloqueadas = 0) => ({ estacion, piezas, bloqueadas });
  const x = cambioPorEstacion([r('FT', 10), r('FT', 5), r('ICT', 4, 1)], [r('FT', 3), r('ICT', 4), r('CTO', 2)]);
  assert.deepEqual(x.map((y) => [y.estacion, y.antes, y.despues, y.cambio]), [['FT', 15, 3, -12], ['CTO', 0, 2, 2], ['ICT', 4, 4, 0]]);
  assert.equal(x[2].bloqAntes, 1);
});

test('filtrar: en cascada etapa → board → modelo → orden → estación, con el orden de la estructura', () => {
  const pasos = [
    { stage: 'SMT', board: 'SWB', model: 'M1', station: 'SPI' }, { stage: 'SMT', board: 'SWB', model: 'M1', station: 'AOI' },
    { stage: 'Sistema', board: 'Final', model: 'M2', station: 'FT' },
  ];
  const ps = [
    { model: 'M1', mo: 'A', station: 'SPI' }, { model: 'M1', mo: 'B', station: 'R_AOI' },
    { model: 'M2', mo: 'C', station: 'FT' }, { model: 'M2', mo: 'C', station: 'KANBAN_IN' }, { model: 'X9', mo: 'D', station: 'ZZ' },
  ];
  assert.deepEqual(lugarDe(pasos, 'M1', 'R_AOI'), { stage: 'SMT', board: 'SWB' }); // la reparación va con su estación
  assert.deepEqual(lugarDe(pasos, 'M2', 'KANBAN_IN'), { stage: 'Sistema', board: 'Final' }); // fuera del reporte: la de su modelo
  const todo = filtrar(ps, pasos, FILTRO0);
  assert.deepEqual(todo.opciones.stage, ['SMT', 'Sistema', 'Sin etapa']);
  assert.equal(todo.ps.length, 5); assert.equal(todo.activos, 0);
  const sis = filtrar(ps, pasos, { ...FILTRO0, stage: 'Sistema' });
  assert.deepEqual(sis.ps.map((p) => p.station), ['FT', 'KANBAN_IN']);
  assert.deepEqual(sis.opciones.model, ['M2']); assert.deepEqual(sis.opciones.station, ['FT', 'KANBAN_IN']);
  const uno = filtrar(ps, pasos, { ...FILTRO0, model: 'M1', station: 'R_AOI' });
  assert.deepEqual(uno.ps.map((p) => p.mo), ['B']); assert.equal(uno.activos, 2);
  assert.deepEqual(filtrar(ps, [], FILTRO0).opciones.stage, ['Sin etapa']); // sin estructura todo es «Sin etapa»
});

test('porHora: llegadas por estación en las últimas horas hasta el corte', async () => {
  const { porHora } = await import('./wip.ts');
  const ps = [
    { station: 'FT', at: '2026-11-27 09:59:59' }, { station: 'FT', at: '2026-11-27 10:00:00' }, { station: 'FT', at: '2026-11-27 10:20' },
    { station: 'ICT', at: '2026-11-27 07:59:00' }, { station: 'ICT', at: '' }, { station: 'ICT', at: '2026-11-27 11:00:00' },
  ];
  const r = porHora(ps, '2026-11-27 10:30', 3); // ventana 08:00–11:00
  assert.deepEqual(r.cols, ['2026-11-27 08', '2026-11-27 09', '2026-11-27 10']);
  assert.deepEqual(r.filas.get('FT')!.horas.map((h) => h.length), [0, 1, 2]);
  assert.deepEqual([r.filas.get('ICT')!.antes, r.filas.get('ICT')!.horas.flat().length], [2, 0]); // 07:59 y sin hora: antes; 11:00 queda fuera
});
