import { test } from 'node:test';
import assert from 'node:assert/strict';
test('parseFile lee CSV como texto y conserva ceros a la izquierda', async () => {
  const { parseFile } = await import('./files.ts');
  const r = await parseFile(new File(['Serial,,Result\n00123,FT,PASS\n'], 'tcqs.csv'));
  assert.deepEqual(r.headers, ['Serial', 'Columna 2', 'Result']);
  assert.deepEqual(r.rows, [['00123', 'FT', 'PASS']]);
  await assert.rejects(parseFile(new File(['x'], 'a.pdf')), /Formato no soportado/);
  await assert.rejects(parseFile(new File([''], 'a.csv')), /no tiene filas/);
});

test('mergeParsed: columnas por nombre (en otro orden o faltantes) y filas una tras otra', async () => {
  const { mergeParsed } = await import('./files.ts');
  const m = mergeParsed([{ headers: ['DN_NO', 'SO'], rows: [['1', 'a']] }, { headers: ['SO', 'DN_NO', 'X'], rows: [['b', '2', 'x']] }]);
  assert.deepEqual(m, { headers: ['DN_NO', 'SO', 'X'], rows: [['1', 'a', null], ['2', 'b', 'x']] });
});
