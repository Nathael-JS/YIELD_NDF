// Servidor de Yield Control en Render: sirve la app (dist/), las cuentas y la API del resumen en Neon.
// La conexión vive solo aquí (DATABASE_URL en Render), nunca en el navegador. Toda la API de datos exige sesión.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import pg from 'pg';
import { randomBytes, randomUUID } from 'node:crypto';
import { checkPassword, cookieOf, failed, hashPassword, HOURS, limited, sign, verify } from './auth.js';
import { validate } from './validate.js';

const DIST = resolve('dist');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json' };
const LIMIT = 5 * 1024 * 1024;

const db = process.env.DATABASE_URL ? new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 3 }) : null;
const ready = db?.query(`create table if not exists yield_resumen (
  fecha date not null, modelo text not null, estacion text not null,
  entradas int not null, primer_pase int not null, primera_falla int not null, segundo_pase int not null,
  archivo text not null, guardado_en timestamptz not null default now(),
  primary key (fecha, modelo, estacion));
create table if not exists yield_cargas (
  id serial primary key, sesion text not null, usuario text not null, archivo text not null,
  filas int not null, entradas int not null, primer_pase int not null, primera_falla int not null, segundo_pase int not null,
  desde date not null, hasta date not null, guardado_en timestamptz not null default now());
create table if not exists usuarios (
  id serial primary key, usuario text not null unique, nombre text not null, clave text not null,
  activo boolean not null default false, admin boolean not null default false, creado timestamptz not null default now())`)
  // cuenta principal (super administrador) desde el entorno: ADMIN_USER (y ADMIN_PASSWORD si hay que crearla)
  .then(async () => {
    // si la cuenta ya existe (creada desde «Crear cuenta») se activa como administradora y conserva su contraseña
    // cuenta de prueba siempre activa: demo / yield2026 (pública; quitarla cuando se entregue a producción)
    await db.query(`insert into usuarios (usuario, nombre, clave, activo) values ('demo', 'Usuario de prueba', $1, true) on conflict (usuario) do update set activo = true`, [await hashPassword('yield2026')]);
    if (!PRINCIPAL) return console.log('Cuenta principal: falta ADMIN_USER');
    const { rowCount } = await db.query('update usuarios set activo = true, admin = true where usuario = $1', [PRINCIPAL]);
    if (rowCount) return console.log(`Cuenta principal: ${PRINCIPAL} activada como administradora (con su propia contraseña)`);
    if (!process.env.ADMIN_PASSWORD) return console.log(`Cuenta principal: ${PRINCIPAL} no existe; créala desde «Crear cuenta» o pon ADMIN_PASSWORD`);
    await db.query(`insert into usuarios (usuario, nombre, clave, activo, admin) values ($1, $1, $2, true, true)`, [PRINCIPAL, await hashPassword(process.env.ADMIN_PASSWORD)]);
    console.log(`Cuenta principal: ${PRINCIPAL} creada con la contraseña de ADMIN_PASSWORD`);
  });
// sin esto, una base que no responde al arrancar tumba el servidor; así sigue en pie y /api/salud lo explica
ready?.catch((e) => console.error('No se pudo preparar la base:', e.message));
// sin SESSION_SECRET (Render la genera) las sesiones duran hasta que se reinicie el servidor
const SECRET = process.env.SESSION_SECRET || randomBytes(32).toString('hex');
const SECURE = process.env.NODE_ENV === 'production' || !!process.env.RENDER;
const cookie = (value, maxAge) => `yc_sesion=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${SECURE ? '; Secure' : ''}`;
/** La cuenta principal solo se cambia desde Render: ningún otro administrador puede desactivarla ni quitarle el rol. */
const PRINCIPAL = process.env.ADMIN_USER?.trim().toLowerCase() || null;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

const json = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };

async function body(req) {
  let size = 0; const parts = [];
  for await (const c of req) { size += c.length; if (size > LIMIT) throw Object.assign(new Error('Archivo demasiado grande (máx. 5 MB)'), { code: 413 }); parts.push(c); }
  return JSON.parse(Buffer.concat(parts).toString('utf8'));
}

const NOPE = 'Usuario o contraseña incorrectos'; // nunca decir cuál de los dos falló

/** Sesión válida de una cuenta que sigue activa (se mira en la base cada vez: desactivar o quitar el rol vale al instante). */
async function current(req) {
  const s = verify(cookieOf(req, 'yc_sesion'), SECRET);
  if (!s) return null;
  const { rows: [u] } = await db.query('select activo, admin from usuarios where id = $1', [s.uid]);
  return u?.activo ? { ...s, admin: u.admin } : null;
}

async function accounts(req, res, me) {
  if (!me.admin) return json(res, 403, { error: 'Solo para administradores' });
  if (req.method === 'GET') {
    const { rows } = await db.query('select id, usuario, nombre, activo, admin, creado, usuario = $1 as principal from usuarios order by activo, creado desc', [PRINCIPAL]);
    return json(res, 200, { usuarios: rows });
  }
  const b = await body(req), id = Number(b.id);
  if (!Number.isInteger(id) || (typeof b.activo !== 'boolean' && typeof b.admin !== 'boolean')) return json(res, 400, { error: 'Se esperaba { id, activo? , admin? }' });
  // nadie se quita a sí mismo el acceso ni el rol: evita quedarse sin administradores
  if (id === me.uid) return json(res, 400, { error: 'No puedes cambiar tu propia cuenta' });
  const { rows: [t] } = await db.query('select usuario from usuarios where id = $1', [id]);
  if (t && t.usuario === PRINCIPAL) return json(res, 403, { error: 'La cuenta principal solo se cambia desde Render (ADMIN_USER)' });
  const { rowCount } = await db.query('update usuarios set activo = coalesce($2, activo), admin = coalesce($3, admin) where id = $1', [id, b.activo ?? null, b.admin ?? null]);
  return rowCount ? json(res, 200, {}) : json(res, 404, { error: 'Cuenta no encontrada' });
}

async function account(req, res, path) {
  if (path === '/api/logout') { res.setHeader('set-cookie', cookie('', 0)); return json(res, 200, {}); }
  if (path === '/api/me') {
    const s = await current(req);
    return s ? json(res, 200, { nombre: s.nombre, sesion: s.sid, admin: s.admin }) : json(res, 401, { error: 'Sesión vencida' });
  }
  const b = await body(req), usuario = String(b.usuario ?? '').trim().toLowerCase(), clave = String(b.clave ?? '');
  // login
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;
  if (limited(ip)) return json(res, 429, { error: 'Demasiados intentos. Espera 15 minutos.' });
  const { rows: [u] } = await db.query('select id, nombre, clave, activo, admin from usuarios where usuario = $1', [usuario]);
  if (!u || !(await checkPassword(clave, u.clave))) { failed(ip); return json(res, 401, { error: NOPE }); }
  if (!u.activo) return json(res, 403, { error: 'Tu cuenta está pendiente: el encargado debe activarla.' });
  const sid = randomUUID();
  res.setHeader('set-cookie', cookie(sign({ uid: u.id, nombre: u.nombre, sid }, SECRET), HOURS * 3600));
  return json(res, 200, { nombre: u.nombre, sesion: sid, admin: u.admin });
}

/** Diagnóstico sin secretos: ¿hay base y cómo está la cuenta principal? (abrir /api/salud en el navegador) */
async function health(res) {
  if (!db) return json(res, 200, { servidor: true, base: false, aviso: 'Falta DATABASE_URL en Render' });
  try {
    await ready;
    const { rows: [u] } = PRINCIPAL ? await db.query('select activo, admin from usuarios where usuario = $1', [PRINCIPAL]) : { rows: [] };
    const principal = !PRINCIPAL ? 'falta ADMIN_USER' : !u ? 'no existe' : u.activo && u.admin ? 'activa' : 'pendiente';
    return json(res, 200, { servidor: true, base: true, principal, sesionesFijas: !!process.env.SESSION_SECRET });
  } catch (e) {
    return json(res, 200, { servidor: true, base: false, aviso: `No se pudo conectar a la base: ${e.code ?? 'error'}` });
  }
}

async function api(req, res) {
  if (req.url === '/api/salud') return health(res);
  if (!db) return json(res, 503, { error: 'Base de datos no configurada (falta DATABASE_URL)' });
  await ready;
  const url = new URL(req.url, 'http://x');
  // un POST de otro sitio no puede mandar JSON sin permiso del navegador: junto con SameSite=Strict, frena CSRF
  if (req.method === 'POST' && !req.headers['content-type']?.startsWith('application/json')) return json(res, 415, { error: 'Se esperaba JSON' });
  if (['/api/login', '/api/logout', '/api/me'].includes(url.pathname)) {
    if (url.pathname !== '/api/me' && req.method !== 'POST') return json(res, 405, { error: 'Método no permitido' });
    return account(req, res, url.pathname);
  }
  const s = await current(req);
  if (!s) return json(res, 401, { error: 'Inicia sesión' });
  if (url.pathname === '/api/usuarios') return accounts(req, res, s);
  if (req.method === 'GET' && url.pathname === '/api/cargas') {
    const { rows } = await db.query(`select id, sesion, usuario, archivo, filas, entradas, primer_pase, primera_falla, segundo_pase,
      to_char(desde, 'YYYY-MM-DD') desde, to_char(hasta, 'YYYY-MM-DD') hasta, guardado_en from yield_cargas order by guardado_en desc limit 200`);
    return json(res, 200, { cargas: rows });
  }
  if (url.pathname !== '/api/resumen') return json(res, 404, { error: 'No encontrado' });
  if (req.method === 'GET') {
    // ?desde=&hasta= opcionales (las de una carga del historial)
    const desde = url.searchParams.get('desde') ?? '0001-01-01', hasta = url.searchParams.get('hasta') ?? '9999-12-31';
    if (!DAY.test(desde) || !DAY.test(hasta)) return json(res, 400, { error: 'Fechas inválidas' });
    const { rows } = await db.query(`select to_char(fecha, 'YYYY-MM-DD') fecha, modelo, estacion, entradas, primer_pase, primera_falla, segundo_pase
      from yield_resumen where fecha between $1 and $2 order by fecha, modelo, estacion`, [desde, hasta]);
    return json(res, 200, { filas: rows });
  }
  if (req.method === 'POST') {
    const v = validate({ ...(await body(req)), sesion: s.sid, usuario: s.nombre }); // quién y en qué sesión lo pone el servidor
    if (v.error) return json(res, 400, { error: v.error });
    const col = (k) => v.filas.map((f) => f[k]);
    const sum = (k) => v.filas.reduce((t, f) => t + f[k], 0);
    const dias = col('fecha').sort();
    const c = await db.connect();
    try {
    await c.query('begin');
    // la carga más reciente de un mismo día × modelo × estación reemplaza a la anterior
    const r = await c.query(`insert into yield_resumen (fecha, modelo, estacion, entradas, primer_pase, primera_falla, segundo_pase, archivo)
      select f, m, e, i, p, ff, sp, $8 from unnest($1::date[], $2::text[], $3::text[], $4::int[], $5::int[], $6::int[], $7::int[]) as t(f, m, e, i, p, ff, sp)
      on conflict (fecha, modelo, estacion) do update set entradas = excluded.entradas, primer_pase = excluded.primer_pase,
        primera_falla = excluded.primera_falla, segundo_pase = excluded.segundo_pase, archivo = excluded.archivo, guardado_en = now()`,
      [col('fecha'), col('modelo'), col('estacion'), col('entradas'), col('primer_pase'), col('primera_falla'), col('segundo_pase'), v.archivo]);
    // registro de la carga para el historial por sesión
    await c.query(`insert into yield_cargas (sesion, usuario, archivo, filas, entradas, primer_pase, primera_falla, segundo_pase, desde, hasta)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [v.sesion, v.usuario, v.archivo, v.filas.length, sum('entradas'), sum('primer_pase'), sum('primera_falla'), sum('segundo_pase'), dias[0], dias.at(-1)]);
    await c.query('commit');
    return json(res, 200, { guardadas: r.rowCount });
    } catch (e) {
      await c.query('rollback');
      throw e;
    } finally {
      c.release();
    }
  }
  json(res, 405, { error: 'Método no permitido' });
}

// la página solo carga lo suyo, no se puede incrustar en otro sitio y no filtra la dirección al salir
const HEADERS = {
  'content-security-policy': "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' blob: data:; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'x-frame-options': 'DENY',
  ...(SECURE ? { 'strict-transport-security': 'max-age=31536000' } : {}),
};

async function file(req, res) {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
  const full = join(DIST, path);
  // nada fuera de dist/; rutas de la app (/yield, /carga…) devuelven index.html
  const target = full.startsWith(DIST + '/') && extname(full) ? full : join(DIST, 'index.html');
  try {
    const data = await readFile(target);
    res.writeHead(200, { ...HEADERS, 'content-type': TYPES[extname(target)] ?? 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404).end('No encontrado');
  }
}

createServer(async (req, res) => {
  try {
    if (req.url.startsWith('/api/')) await api(req, res);
    else await file(req, res);
  } catch (e) {
    json(res, e.code === 413 ? 413 : e instanceof SyntaxError ? 400 : 500, { error: e.code === 413 || e instanceof SyntaxError ? e.message : 'Error del servidor' });
    if (e.code !== 413 && !(e instanceof SyntaxError)) console.error(e);
  }
}).listen(process.env.PORT || 3000, () => console.log(`Yield Control en el puerto ${process.env.PORT || 3000}${db ? ' con base de datos' : ' sin base de datos'}`));
