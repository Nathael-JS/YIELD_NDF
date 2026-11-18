import { test } from 'node:test';
import assert from 'node:assert/strict';
import { byLabel, classify, readFails, top80 } from './fails.ts';
import type { Rec } from './tcqs.ts';

const H = ['MO_NUMBER', 'MODEL_NAME', 'SERIAL_NUMBER', 'GROUP_NAME', 'STATION_NAME', 'ERROR_CODE', 'ERROR_DESC', 'IN_STATION_TIME'];
const row = (sn: string, mo: string, code: string, tester = 't1') => [mo, 'SA1', sn, 'FT', tester, code, `desc ${code}`, '2026-11-13 10:00:00'];
const rec = (mo: string, ff: number, sp: number, fail: number, tester = 't1', date = '2026-11-13'): Rec =>
  ({ date, model: 'SA1', mo, group: 'FT', tester, input: 10, fp: 10 - ff, ff, sp, fail });

test('classify: cada primera falla con lo que dice el TCQS de su orden × estación', () => {
  const { fails, bad } = readFails({ headers: H, rows: [row('a', 'M1', 'X'), row('b', 'M1', 'X'), row('c', 'M2', 'Y'), row('d', 'M3', 'X'), row('e', 'M4', 'Z'), row('f', 'M5', 'X'), ['M1', 'SA1', '', 'FT', 't1', 'X', '', '']] });
  assert.deepEqual(bad, [8]);
  // M1: la falla en t1 el 13 y el retest (2do pase) registrado en t9 el 14: cuenta igual como NDF
  const recs = [rec('M1', 2, 0, 0), rec('M1', 0, 2, 0, 't9', '2026-11-14'), rec('M2', 1, 0, 1), rec('M3', 1, 0, 0), rec('M4', 2, 1, 1)];
  const { marked, distintos, grupos } = classify(fails, recs);
  assert.deepEqual(marked.map((m) => m.estado), ['NDF', 'NDF', 'Real', 'Pendiente', 'Mezcla', 'Sin TCQS']);
  assert.equal(marked[4].ndf, 0.5);
  assert.equal(grupos, 5); assert.equal(distintos, 2); // M4: 1 falla en el archivo y 2 en el TCQS; M5 no está en el TCQS
  const codes = byLabel(marked, (m) => m.code);
  assert.deepEqual(codes.map((c) => [c.name, c.total, c.NDF]), [['X', 4, 2], ['Y', 1, 0], ['Z', 1, 0]]);
  assert.deepEqual(top80(codes).map((c) => c.name), ['X']); // X 4/6 = 67 %; con Y llega a 83 % > 80 %
});

test('top80: siempre la primera; luego mientras el acumulado no pase de 80 %', () => {
  assert.deepEqual(top80([{ total: 9 }, { total: 1 }]).length, 1);
  assert.deepEqual(top80([{ total: 4 }, { total: 4 }, { total: 2 }]).length, 2);
});
