import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchKeys, validate } from './match.ts';

const tcqs = { headers: ['Serial', 'Station'], rows: [['SN1', 'FT'], ['sn2 ', 'FT'], ['SN2', 'JTAG'], ['', 'LED'], [null, 'ICT']] };
const qm = { headers: ['SERIAL', 'Code'], rows: [['SN1', 'E104'], ['SN3', 'E221']] };

test('validate cuenta vacías y duplicadas sin distinguir mayúsculas ni espacios', () => {
  assert.deepEqual(validate(tcqs, 'serial'), { rows: 5, hasKey: true, empty: 2, duplicated: 1 });
  assert.equal(validate(qm, 'Station').hasKey, false);
});

test('matchKeys separa llaves en todos los archivos de las parciales', () => {
  const r = matchKeys({ TCQS: tcqs, QM: qm }, 'Serial');
  assert.equal(r.total, 3);
  assert.equal(r.inAll, 1);
  assert.deepEqual(r.partial, [{ key: 'SN2', in: ['TCQS'] }, { key: 'SN3', in: ['QM'] }]);
});
