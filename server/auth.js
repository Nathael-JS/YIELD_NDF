// Cuentas y sesiones sin dependencias: contraseñas con scrypt y sesión en una cookie firmada (HMAC).
import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb);
export const HOURS = 12;

export async function hashPassword(pw) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${(await scrypt(pw, salt, 64)).toString('hex')}`;
}

export async function checkPassword(pw, stored) {
  const [salt, hex] = String(stored).split(':');
  if (!salt || !hex) return false;
  const a = await scrypt(pw, salt, 64), b = Buffer.from(hex, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

const mac = (data, secret) => createHmac('sha256', secret).update(data).digest('base64url');

/** Token de sesión: datos + vencimiento, firmados. No se puede modificar sin la clave del servidor. */
export function sign(payload, secret, now = Date.now()) {
  const data = Buffer.from(JSON.stringify({ ...payload, exp: now + HOURS * 3600e3 })).toString('base64url');
  return `${data}.${mac(data, secret)}`;
}

export function verify(token, secret, now = Date.now()) {
  const [data, sig] = String(token ?? '').split('.');
  if (!data || !sig) return null;
  const good = Buffer.from(mac(data, secret)), got = Buffer.from(sig);
  if (good.length !== got.length || !timingSafeEqual(good, got)) return null;
  const p = JSON.parse(Buffer.from(data, 'base64url').toString());
  return p.exp > now ? p : null;
}

export const cookieOf = (req, name) => (req.headers.cookie ?? '').split(/;\s*/).find((c) => c.startsWith(`${name}=`))?.slice(name.length + 1);

/** Intentos fallidos por dirección: 5 en 15 min bloquean el login de esa dirección. */
const fails = new Map();
export const limited = (ip, now = Date.now()) => (fails.get(ip) ?? []).filter((t) => now - t < 15 * 60e3).length >= 5;
export const failed = (ip, now = Date.now()) => fails.set(ip, [...(fails.get(ip) ?? []).filter((t) => now - t < 15 * 60e3), now]);
// shortcut: el contador vive en memoria de un proceso; si Render corre varias instancias, pasarlo a la base.
