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
export function sign(payload, secret, now = Date.now(), ms = HOURS * 3600e3) {
  const data = Buffer.from(JSON.stringify({ ...payload, exp: now + ms })).toString('base64url');
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

// MFA con códigos de 6 dígitos de una app autenticadora (TOTP, RFC 6238: HMAC-SHA1, pasos de 30 s).
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export const newSecret = () => [...randomBytes(32)].map((b) => B32[b & 31]).join('');

function fromBase32(s) {
  let bits = '';
  for (const c of s.replace(/=+$/, '').toUpperCase()) bits += B32.indexOf(c).toString(2).padStart(5, '0');
  return Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)));
}

export function totp(secret, now = Date.now()) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(now / 30e3)));
  const h = createHmac('sha1', fromBase32(secret)).update(counter).digest(), o = h[h.length - 1] & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, '0');
}

/** Acepta el código actual y el de 30 s antes o después (relojes de teléfono un poco desfasados). */
export const checkTotp = (secret, code, now = Date.now()) => /^\d{6}$/.test(String(code)) && [-1, 0, 1].some((w) => totp(secret, now + w * 30e3) === String(code));

export const otpUri = (usuario, secret) => `otpauth://totp/${encodeURIComponent(`Yield Control:${usuario}`)}?secret=${secret}&issuer=${encodeURIComponent('Yield Control')}`;
