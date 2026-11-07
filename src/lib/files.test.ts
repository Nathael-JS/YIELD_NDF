import { test } from 'node:test';
import assert from 'node:assert/strict';
import { commonColumns } from './files.ts';

test('commonColumns ignora mayúsculas y conserva el orden del primero', () => {
  assert.deepEqual(commonColumns([['Serial', 'Station', 'Result'], ['station', 'SERIAL'], ['serial', 'Station', 'x']]), ['Serial', 'Station']);
  assert.deepEqual(commonColumns([]), []);
});

test('parseFile lee CSV como texto y conserva ceros a la izquierda', async () => {
  const { parseFile } = await import('./files.ts');
  const r = await parseFile(new File(['Serial,,Result\n00123,FT,PASS\n'], 'tcqs.csv'));
  assert.deepEqual(r.headers, ['Serial', 'Columna 2', 'Result']);
  assert.deepEqual(r.rows, [['00123', 'FT', 'PASS']]);
  await assert.rejects(parseFile(new File(['x'], 'a.pdf')), /Formato no soportado/);
  await assert.rejects(parseFile(new File([''], 'a.csv')), /no tiene filas/);
});
