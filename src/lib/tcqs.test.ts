import { test } from 'node:test';
import assert from 'node:assert/strict';
import { by, change, daily, fromDb, diagnose, modelKey, modelsFrom, periodOf, periodsOf, readTcqs, rty, totals } from './tcqs.ts';

const H = ['WORK_DATE', 'MODEL_NAME', 'SAP_MODEL_NAME', 'MO_NUMBER', 'GROUP_NAME', 'STATION_NAME', 'INPUT_QTY', 'FIRST_PASS_QTY', 'FIRST_FAIL_QTY', 'SECOND_PASS_QTY'];
// filas con la forma del TCQS real (cantidades como texto, como las deja el lector de CSV)
const tcqs = { headers: H, rows: [
  ['20261103', 'SA029400', 'SA029400', '125307', 'FT', 'foxgua48023_2', '5', '4', '1', '0'],
  ['20261103', 'SA029400', 'SA029400', '125307', 'FT', 'foxgua48023_8', '3', '2', '1', '1'],
  ['20261104', 'SA029400', 'SA029400', '125307', 'J_TAG', 'corelis48200', '4', '4', '0', '0'],
  ['20261104', 'SA029400', 'SA029400', '125307', 'J_TAG', 'corelis48181', '-1', '0', '0', '0'],
  ['', 'SA029400', 'SA029400', '125307', 'FT', 'x', '1', '1', '0', '0'],
  ['20261104', 'SA029400', 'SA029400', '125307', 'FT', 'x', '3', '1', '1', '0'], // 1 + 1 ≠ 3
] };

test('readTcqs separa filas válidas de las inválidas y avisa columnas faltantes', () => {
  const r = readTcqs(tcqs);
  assert.equal(r.records.length, 3);
  assert.deepEqual(r.bad, [5, 6, 7]);
  assert.equal(r.records[0].date, '2026-11-03');
  assert.deepEqual(readTcqs({ headers: ['WORK_DATE'], rows: [] }).missing.length, 8);
});

test('totals sigue la guía: FPY, retest ponderado, Final = FPY + Retest, recuperación', () => {
  const ft = totals(readTcqs(tcqs).records.filter((r) => r.group === 'FT'));
  assert.equal(ft.input, 8);
  assert.equal(ft.fpy, 75); // 6/8
  assert.equal(ft.retest, 12.5); // 1/8
  assert.equal(ft.final, 87.5); // (6+1)/8 = 75 + 12.5
  assert.equal(ft.recovered, 50); // 1 de 2 primeras fallas pasó al re-probarla
  const rec = (input: number, fp: number, ff: number, sp: number) => ({ date: 'x', model: 'm', mo: '', group: 'g', tester: '', input, fp, ff, sp });
  // retest de una entrada fuera del rango: no infla el yield (guía, caso SA016491 y fórmula 10)
  const day = totals([rec(3, 3, 0, 0), rec(1, 1, 0, 0), rec(1, 0, 1, 1), rec(0, 0, 0, 1), rec(1, 1, 0, 0)]);
  assert.equal(day.retest.toFixed(1), '16.7'); // 1 ÷ 6, no 2 ÷ 6
  assert.equal(day.extra, 1);
  const over = totals([rec(2, 2, 0, 3)]);
  assert.equal(over.final, 100);
  assert.equal(over.fpy + over.retest, over.final);
  assert.ok(Number.isNaN(totals([rec(0, 0, 0, 1)]).fpy)); // entradas 0 = sin dato
});

test('by, rty y diagnose', () => {
  const st = by(readTcqs(tcqs).records, (r) => r.group);
  assert.deepEqual(st.map((s) => s.name), ['FT', 'J_TAG']);
  assert.equal(rty(st), 75); // 75 % × 100 %
  assert.equal(diagnose(st[0])[0], 'Datos insuficientes'); // 8 entradas
  assert.equal(diagnose(totals([]))[0], 'Sin dato');
  assert.equal(diagnose({ ...st[0], input: 20, fpy: 80, final: 96 })[1], 'warn');
  assert.equal(diagnose({ ...st[0], input: 20, fpy: 80, final: 90 })[1], 'bad');
});

test('modelsFrom saca los números de modelo del texto del BOM', () => {
  const bom = { headers: ['9* LEVEL'], rows: [['920-9K33R-00MV-GS0\r\n692-9K33R-00MV-GDL \r\n(FG packing)'], ['SA029400\r\nMO: 118305*50pcs'], ['ma016491 MANIFOLD RIGHT'], [null]] };
  assert.deepEqual(modelsFrom(bom), ['920-9K33R-00MV-GS0', '692-9K33R-00MV-GDL', 'SA029400', 'MA016491']);
});

test('periodOf agrupa por día, semana ISO y mes', () => {
  assert.deepEqual(periodOf('2026-11-05', 'dia'), ['2026-11-05', '5 nov']);
  assert.deepEqual(periodOf('2026-11-05', 'semana'), ['2026-W45', 'Sem 45']);
  assert.deepEqual(periodOf('2026-11-01', 'semana'), ['2026-W44', 'Sem 44']); // domingo
  assert.deepEqual(periodOf('2027-01-01', 'semana'), ['2026-W53', 'Sem 53']);
  assert.deepEqual(periodOf('2026-10-31', 'mes'), ['2026-10', 'oct 2026']);
});

test('modelKey iguala MA y SA del mismo número de parte', () => {
  assert.equal(modelKey('MA016491'), modelKey(' sa016491'));
  assert.equal(modelKey('920-9K33R-00MV-GS0'), '920-9K33R-00MV-GS0');
  assert.notEqual(modelKey('MA0164912'), 'SA0164912');
});

test('periodsOf y change: cambio contra el periodo anterior solo con muestra suficiente', () => {
  const rec = (date: string, input: number, fp: number) => ({ date, model: 'm', mo: '', group: 'g', tester: '', input, fp, ff: input - fp, sp: 0 });
  const rs = [rec('2026-11-03', 20, 18), rec('2026-10-27', 20, 16), rec('2026-11-04', 5, 5)];
  assert.deepEqual(periodsOf(rs, 'semana').map(([k]) => k), ['2026-W44', '2026-W45']);
  const [w44, w45] = ['2026-W44', '2026-W45'].map((k) => totals(rs.filter((r) => periodOf(r.date, 'semana')[0] === k)));
  assert.equal(change(w45, w44, 'fpy'), 12); // 92 % − 80 %
  assert.equal(change(w45, w44, 'input'), 5);
  assert.equal(change(w45, undefined, 'fpy'), undefined);
  assert.equal(change(totals([rec('x', 5, 5)]), w44, 'fpy'), undefined); // 5 entradas: no se compara
  assert.equal(change({ input: 20, rty: 50 }, { input: 30, rty: 62.3 }, 'rty'), -12.3); // también RTY
});

test('daily y fromDb: el histórico de Neon da los mismos totales que el TCQS', () => {
  const rs = readTcqs(tcqs).records;
  const rows = daily(rs);
  assert.equal(rows.length, 2); // FT del 3 nov (dos testers juntos) y J_TAG del 4 nov
  assert.deepEqual(totals(readTcqs(fromDb(rows)).records), totals(rs));
});
