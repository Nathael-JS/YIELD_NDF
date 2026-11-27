import { test } from 'node:test';
import assert from 'node:assert/strict';
import { armarRuta, RUTAS_BASE, rutaATexto, textoARuta } from './ruta.ts';

test('textoARuta / rutaATexto: ida y vuelta, retornos y saltos, errores claros', () => {
  const { ruta, error } = textoARuta('M', 'A R\nB\n# comentario\n\nC R\nR_C > A\nA > C');
  assert.equal(error, '');
  assert.deepEqual(ruta.estaciones, [{ station: 'A', rep: true }, { station: 'B', rep: false }, { station: 'C', rep: true }]);
  assert.deepEqual(ruta.retornos, [['R_C', 'A']]); assert.deepEqual(ruta.saltos, [['A', 'C']]);
  assert.equal(rutaATexto(ruta), 'A R\nB\nC R\nR_C > A\nA > C');
  assert.match(textoARuta('M', 'A\nA').error, /repetida/);
  assert.match(textoARuta('M', 'A\nR_X > A').error, /X no está/);
  assert.match(textoARuta('M', 'A\nA > R_A').error, /reparación/);
  assert.match(textoARuta('M', '').error, /no tiene estaciones/);
  const sa = RUTAS_BASE[0];
  assert.equal(sa.estaciones.length, 21); assert.equal(sa.estaciones.filter((e) => e.rep).length, 18);
  assert.deepEqual([sa.estaciones[0].station, sa.estaciones.at(-1)!.station], ['ASSY_SA_SWB', 'STOCKIN']);
});

test('armarRuta: yield en orden, estaciones nuevas tras su anterior, reparaciones, retornos y saltos del WIP', () => {
  const p = (station: string, prev = '') => ({ model: 'M', station, prev });
  const r = armarRuta('M', undefined, ['A', 'C', 'E'], [
    p('B', 'A'), // B va después de A
    p('R_C', 'C'), // C tiene reparación
    p('A', 'R_C'), // de R_C se regresa a A: retorno
    p('E', 'B'), // de B salta a E (C en medio): salto
    p('HOLD-E', 'E'), // un hold no es estación nueva
    { model: 'OTRO', station: 'Z', prev: '' },
  ]);
  assert.deepEqual(r.estaciones.map((e) => e.station + (e.rep ? '*' : '')), ['A', 'B', 'C*', 'E']);
  assert.deepEqual(r.retornos, [['R_C', 'A']]); assert.deepEqual(r.saltos, [['B', 'E']]);
  // con la guardada: no la cambia y respeta su orden
  const g = RUTAS_BASE[0], antes = rutaATexto(g);
  const r2 = armarRuta('SA029400', g, ['FT'], [{ model: 'SA029400', station: 'KANBAN_IN', prev: 'FATP_VI' }, { model: 'SA029400', station: 'NUEVA', prev: 'FT' }]);
  assert.equal(rutaATexto(g), antes);
  assert.equal(r2.estaciones[r2.estaciones.findIndex((e) => e.station === 'FT') + 1].station, 'NUEVA');
  assert.equal(r2.saltos.length, 1); // FATP_VI > KANBAN_IN ya estaba
});

test('mapaDe: piezas por estación (holds con su estación), reparación debajo, bandas e índices', async () => {
  const { mapaDe } = await import('./ruta.ts');
  const r = textoARuta('M', 'A R\nB\nC R\nR_C > A\nA > C').ruta;
  const ps = [{ station: 'A', hours: 1 }, { station: 'HOLD-A', hours: 30 }, { station: 'R_C', hours: 120 }, { station: 'X', hours: 1 }];
  const m = mapaDe(r, ps, (s) => ({ stage: s === 'C' ? 'S2' : 'S1', board: 'B' }));
  assert.deepEqual(m.nodes.map((s) => [s.station, s.n, s.tone, s.rep?.n ?? '-']), [['A', 2, 'bad', 0], ['B', 0, 'idle', '-'], ['C', 0, 'idle', 1]]);
  assert.equal(m.nodes[2].rep!.urgent, 1);
  assert.deepEqual(m.bands, [[{ label: 'S1', from: 0, to: 1 }, { label: 'S2', from: 2, to: 2 }], [{ label: 'B', from: 0, to: 2 }]]);
  assert.deepEqual([m.retornos, m.saltos], [[[2, 0]], [[0, 2]]]);
  assert.equal(m.piezasDe('A').length, 2); assert.equal(m.fuera, 1);
});
