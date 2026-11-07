import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkPassword, failed, hashPassword, limited, sign, verify } from './auth.js';

test('contraseñas: hash con sal distinta y verificación', async () => {
  const a = await hashPassword('clave-larga-1'), b = await hashPassword('clave-larga-1');
  assert.notEqual(a, b);
  assert.ok(!a.includes('clave-larga-1'));
  assert.equal(await checkPassword('clave-larga-1', a), true);
  assert.equal(await checkPassword('otra', a), false);
  assert.equal(await checkPassword('x', 'basura'), false);
});

test('sesión firmada: válida, alterada, con otra clave y vencida', () => {
  const t = sign({ uid: 1, sid: 's' }, 'secreto', 0);
  assert.equal(verify(t, 'secreto', 1000).uid, 1);
  const [data, sig] = t.split('.');
  const otro = Buffer.from(JSON.stringify({ uid: 2, sid: 's', exp: 9e15 })).toString('base64url');
  assert.equal(verify(`${otro}.${sig}`, 'secreto', 1000), null); // cambiar los datos invalida la firma
  assert.equal(verify(t, 'otra-clave', 1000), null);
  assert.equal(verify(t, 'secreto', 13 * 3600e3), null); // venció a las 12 h
  assert.equal(verify(`${data}`, 'secreto'), null);
});

test('límite de intentos por dirección', () => {
  for (let i = 0; i < 5; i++) failed('1.2.3.4', 1000 + i);
  assert.equal(limited('1.2.3.4', 2000), true);
  assert.equal(limited('1.2.3.4', 1000 + 16 * 60e3), false);
  assert.equal(limited('5.6.7.8', 2000), false);
});
