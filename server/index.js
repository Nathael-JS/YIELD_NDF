// Servidor de Yield Control en Render: sirve la app (dist/), las cuentas y la API del resumen en Neon.
// La conexión vive solo aquí (DATABASE_URL en Render), nunca en el navegador. Toda la API de datos exige sesión.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import pg from 'pg';
import { randomBytes, randomUUID } from 'node:crypto';
import { checkPassword, checkTotp, cookieOf, failed, hashPassword, HOURS, limited, newSecret, otpUri, sign, verify } from './auth.js';
import { validate } from './validate.js';

const DIST = resolve('dist');
const TYPES = { '.ico': 'image/x-icon', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json' };
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
  activo boolean not null default false, admin boolean not null default false, creado timestamptz not null default now());
-- debe_cambiar: contraseña temporal (creada por un administrador o desde Render); mfa: secreto TOTP confirmado; mfa_nuevo: en configuración
alter table usuarios add column if not exists debe_cambiar boolean not null default false;
alter table usuarios add column if not exists mfa text;
alter table usuarios add column if not exists mfa_nuevo text;
-- modelos del proyecto (Juliet), sacados del Excel del BOM: filtran el TCQS de todos sin volver a cargar el Excel
create table if not exists yield_modelos (
  modelo text primary key, archivo text not null, usuario text not null, guardado_en timestamptz not null default now());
-- comentarios de una gráfica ampliada (Gráficos); grafica = qué gráfica y con qué rango de fechas
create table if not exists yield_comentarios (
  id serial primary key, grafica text not null, usuario text not null, texto text not null, creado timestamptz not null default now());
create index if not exists yield_comentarios_grafica on yield_comentarios (grafica)`)
  // cuenta principal (super administrador) desde el entorno: ADMIN_USER (y ADMIN_PASSWORD si hay que crearla)
  .then(async () => {
    // si la cuenta ya existe (creada desde «Crear cuenta») se activa como administradora y conserva su contraseña
    // cuenta de prueba siempre activa: demo / yield2026 (pública; quitarla cuando se entregue a producción)
    await db.query(`insert into usuarios (usuario, nombre, clave, activo) values ('demo', 'Usuario de prueba', $1, true) on conflict (usuario) do update set activo = true`, [await hashPassword('yield2026')]);
    if (!PRINCIPAL) return console.log('Cuenta principal: falta ADMIN_USER');
    const { rowCount } = await db.query('update usuarios set activo = true, admin = true where usuario = $1', [PRINCIPAL]);
    if (rowCount) return console.log(`Cuenta principal: ${PRINCIPAL} activada como administradora (con su propia contraseña)`);
    if (!process.env.ADMIN_PASSWORD) return console.log(`Cuenta principal: ${PRINCIPAL} no existe; créala desde «Crear cuenta» o pon ADMIN_PASSWORD`);
    // la contraseña de Render es temporal: se pide cambiarla (y configurar el MFA) al primer inicio
    await db.query(`insert into usuarios (usuario, nombre, clave, activo, admin, debe_cambiar) values ($1, $1, $2, true, true, true)`, [PRINCIPAL, await hashPassword(process.env.ADMIN_PASSWORD)]);
    console.log(`Cuenta principal: ${PRINCIPAL} creada; pedirá cambiar la contraseña y configurar el MFA`);
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
  const { rows: [u] } = await db.query('select usuario, activo, admin, debe_cambiar, mfa from usuarios where id = $1', [s.uid]);
  if (!u?.activo) return null;
  // mientras falte cambiar la contraseña temporal o (si administra) configurar el MFA, solo puede usar /api/seguridad
  const debeCambiar = u.debe_cambiar, mfaPendiente = u.admin && !u.mfa;
  return { ...s, usuario: u.usuario, admin: u.admin, principal: u.usuario === PRINCIPAL, mfa: !!u.mfa, debeCambiar, mfaPendiente, limitado: debeCambiar || mfaPendiente };
}

const me = (s) => ({ nombre: s.nombre, sesion: s.sid, admin: s.admin, principal: s.principal, mfa: s.mfa, debeCambiar: s.debeCambiar, mfaPendiente: s.mfaPendiente });
const strong = (c) => typeof c === 'string' && c.length >= 12 && c.length <= 200;
const WEAK = 'La contraseña debe tener al menos 12 caracteres';

async function security(req, res, s, path) {
  const b = await body(req);
  if (path === '/api/seguridad/clave') {
    const { rows: [u] } = await db.query('select clave from usuarios where id = $1', [s.uid]);
    if (!(await checkPassword(String(b.actual ?? ''), u.clave))) return json(res, 400, { error: 'La contraseña actual no es correcta' });
    if (!strong(b.nueva)) return json(res, 400, { error: WEAK });
    if (b.nueva === b.actual) return json(res, 400, { error: 'La nueva contraseña debe ser distinta' });
    await db.query('update usuarios set clave = $2, debe_cambiar = false where id = $1', [s.uid, await hashPassword(b.nueva)]);
    return json(res, 200, {});
  }
  if (path === '/api/seguridad/mfa/iniciar') {
    const secreto = newSecret();
    await db.query('update usuarios set mfa_nuevo = $2 where id = $1', [s.uid, secreto]);
    return json(res, 200, { secreto, uri: otpUri(s.usuario, secreto) });
  }
  if (path === '/api/seguridad/mfa/confirmar') {
    const { rows: [u] } = await db.query('select mfa_nuevo from usuarios where id = $1', [s.uid]);
    if (!u.mfa_nuevo || !checkTotp(u.mfa_nuevo, b.codigo)) return json(res, 400, { error: 'Código incorrecto. Revisa la hora del teléfono y usa el código actual.' });
    await db.query('update usuarios set mfa = mfa_nuevo, mfa_nuevo = null where id = $1', [s.uid]);
    return json(res, 200, {});
  }
  return json(res, 404, { error: 'No encontrado' });
}

// Administración de cuentas. Los administradores gestionan usuarios; solo la cuenta principal (super administrador)
// da o quita el rol de administrador, borra cuentas y toca a otros administradores.
async function accounts(req, res, me) {
  if (!me.admin) return json(res, 403, { error: 'Solo para administradores' });
  if (req.method === 'GET') {
    const { rows } = await db.query(`select id, usuario, nombre, activo, admin, debe_cambiar, mfa is not null as mfa, creado, usuario = $1 as principal
      from usuarios order by usuario = $1 desc, activo, creado desc`, [PRINCIPAL]);
    return json(res, 200, { usuarios: rows });
  }
  const b = await body(req);
  if (b.accion === 'crear') {
    const usuario = String(b.usuario ?? '').trim().toLowerCase(), nombre = String(b.nombre ?? '').trim().slice(0, 80) || usuario;
    if (!/^[a-z0-9._@-]{3,80}$/.test(usuario)) return json(res, 400, { error: 'Usuario de 3 a 80 caracteres: letras, números, punto, guion o @' });
    if (!strong(b.clave)) return json(res, 400, { error: WEAK });
    if (b.admin && !me.principal) return json(res, 403, { error: 'Solo el super administrador crea administradores' });
    const r = await db.query(`insert into usuarios (usuario, nombre, clave, activo, admin, debe_cambiar) values ($1, $2, $3, true, $4, true) on conflict (usuario) do nothing`,
      [usuario, nombre, await hashPassword(b.clave), !!b.admin]);
    return r.rowCount ? json(res, 201, {}) : json(res, 400, { error: 'Ese usuario ya existe' });
  }
  const id = Number(b.id);
  if (!Number.isInteger(id)) return json(res, 400, { error: 'Falta la cuenta' });
  // nadie se quita a sí mismo el acceso ni el rol: evita quedarse sin administradores
  if (id === me.uid) return json(res, 400, { error: 'Tu propia cuenta se cambia en Seguridad' });
  const { rows: [t] } = await db.query('select usuario, admin from usuarios where id = $1', [id]);
  if (!t) return json(res, 404, { error: 'Cuenta no encontrada' });
  if (t.usuario === PRINCIPAL) return json(res, 403, { error: 'La cuenta principal solo se cambia desde Render (ADMIN_USER)' });
  if ((t.admin || b.admin !== undefined || b.accion === 'borrar') && !me.principal) return json(res, 403, { error: 'Solo el super administrador gestiona administradores y borra cuentas' });
  if (b.accion === 'editar') {
    if (b.nombre !== undefined && !String(b.nombre).trim()) return json(res, 400, { error: 'El nombre no puede quedar vacío' });
    await db.query('update usuarios set nombre = coalesce($2, nombre), activo = coalesce($3, activo), admin = coalesce($4, admin) where id = $1',
      [id, b.nombre === undefined ? null : String(b.nombre).trim().slice(0, 80), typeof b.activo === 'boolean' ? b.activo : null, typeof b.admin === 'boolean' ? b.admin : null]);
  } else if (b.accion === 'clave') {
    if (!strong(b.clave)) return json(res, 400, { error: WEAK });
    await db.query('update usuarios set clave = $2, debe_cambiar = true where id = $1', [id, await hashPassword(b.clave)]);
  } else if (b.accion === 'mfa') {
    await db.query('update usuarios set mfa = null, mfa_nuevo = null where id = $1', [id]);
  } else if (b.accion === 'borrar') {
    await db.query('delete from usuarios where id = $1', [id]);
  } else return json(res, 400, { error: 'Acción desconocida' });
  return json(res, 200, {});
}

/** Estado y limpieza de la base (solo administradores; borrar, solo el super administrador). */
async function database(req, res, me) {
  if (!me.admin) return json(res, 403, { error: 'Solo para administradores' });
  if (req.method === 'GET') {
    const [{ rows: [g] }, { rows: tablas }, { rows: [r] }] = await Promise.all([
      db.query('select pg_database_size(current_database())::bigint as bytes'),
      // conteo exacto (n_live_tup de pg_stat se actualiza con retraso); son tablas chicas
      db.query(`select t as tabla, (xpath('/row/c/text()', query_to_xml('select count(*) as c from ' || t, false, true, '')))[1]::text::int as filas,
        pg_total_relation_size(t::regclass)::bigint as bytes from unnest(array['yield_resumen', 'yield_cargas', 'yield_modelos', 'yield_comentarios', 'usuarios']) as t`),
      db.query(`select to_char(min(fecha), 'YYYY-MM-DD') desde, to_char(max(fecha), 'YYYY-MM-DD') hasta, count(*)::int filas from yield_resumen`),
    ]);
    return json(res, 200, { bytes: Number(g.bytes), tablas: tablas.map((t) => ({ ...t, bytes: Number(t.bytes) })), resumen: r });
  }
  if (!me.principal) return json(res, 403, { error: 'Solo el super administrador borra datos' });
  const b = await body(req);
  if (b.accion === 'borrarCarga' && Number.isInteger(b.id)) {
    const r = await db.query('delete from yield_cargas where id = $1', [b.id]);
    return json(res, 200, { borradas: r.rowCount });
  }
  if (b.accion === 'borrarRango' && DAY.test(b.desde) && DAY.test(b.hasta)) {
    const r = await db.query('delete from yield_resumen where fecha between $1 and $2', [b.desde, b.hasta]);
    return json(res, 200, { borradas: r.rowCount });
  }
  if (b.accion === 'retener' && Number.isInteger(b.dias) && b.dias >= 30) {
    const r = await db.query(`delete from yield_cargas where guardado_en < now() - make_interval(days => $1)`, [b.dias]);
    return json(res, 200, { borradas: r.rowCount });
  }
  return json(res, 400, { error: 'Acción o datos inválidos (la retención mínima es de 30 días)' });
}

const MODEL = /^(?:\d{3}-[0-9A-Z]{5}-[0-9A-Z]{4}-[0-9A-Z]{3}|[A-Z]{2}\d{6})$/; // mismo formato que modelsFrom (src/lib/tcqs.ts)

/** Modelos de Juliet: todos los leen; solo un administrador reemplaza la lista (sube el Excel del BOM). */
async function models(req, res, me) {
  if (req.method === 'GET') {
    const { rows } = await db.query('select modelo, archivo, usuario, guardado_en from yield_modelos order by modelo');
    return json(res, 200, { modelos: rows.map((r) => r.modelo), archivo: rows[0]?.archivo ?? null, usuario: rows[0]?.usuario ?? null, guardado_en: rows[0]?.guardado_en ?? null });
  }
  if (!me.admin) return json(res, 403, { error: 'Solo un administrador cambia los modelos' });
  const b = await body(req), list = b.modelos;
  if (typeof b.archivo !== 'string' || !b.archivo || b.archivo.length > 200 || !Array.isArray(list) || !list.length || list.length > 5000 || !list.every((m) => typeof m === 'string' && MODEL.test(m)))
    return json(res, 400, { error: 'Lista de modelos inválida' });
  const c = await db.connect();
  try {
    // se reemplaza completa: la lista vieja no se mezcla con la del BOM nuevo
    await c.query('begin');
    await c.query('delete from yield_modelos');
    await c.query('insert into yield_modelos (modelo, archivo, usuario) select distinct unnest($1::text[]), $2, $3', [list, b.archivo, me.usuario]);
    await c.query('commit');
  } catch (e) { await c.query('rollback'); throw e; } finally { c.release(); }
  return json(res, 200, { guardados: new Set(list).size });
}

/** Comentarios de una gráfica: todos leen y escriben; cada uno firma con su usuario (lo pone el servidor). */
async function comments(req, res, me, url) {
  if (req.method === 'GET') {
    const g = url.searchParams.get('grafica') ?? '';
    if (!g || g.length > 200) return json(res, 400, { error: 'Falta la gráfica' });
    const { rows } = await db.query('select id, usuario, texto, creado from yield_comentarios where grafica = $1 order by creado desc limit 100', [g]);
    return json(res, 200, { comentarios: rows });
  }
  const b = await body(req), texto = typeof b.texto === 'string' ? b.texto.trim() : '';
  if (typeof b.grafica !== 'string' || !b.grafica || b.grafica.length > 200 || !texto || texto.length > 2000) return json(res, 400, { error: 'Comentario vacío o demasiado largo (máx. 2000)' });
  const { rows: [c] } = await db.query('insert into yield_comentarios (grafica, usuario, texto) values ($1, $2, $3) returning id, usuario, texto, creado', [b.grafica, me.usuario, texto]);
  return json(res, 200, c);
}

async function account(req, res, path) {
  if (path === '/api/logout') { res.setHeader('set-cookie', cookie('', 0)); return json(res, 200, {}); }
  if (path === '/api/me') {
    const s = await current(req);
    return s ? json(res, 200, me(s)) : json(res, 401, { error: 'Sesión vencida' });
  }
  const b = await body(req);
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;
  if (limited(ip)) return json(res, 429, { error: 'Demasiados intentos. Espera 15 minutos.' });
  let u;
  if (path === '/api/login/codigo') {
    // segundo paso: el ticket prueba que la contraseña ya fue correcta hace menos de 5 min
    const t = verify(b.ticket, SECRET);
    ({ rows: [u] } = t?.paso === 'mfa' ? await db.query('select id, nombre, activo, mfa from usuarios where id = $1', [t.uid]) : { rows: [] });
    if (!u?.activo || !u.mfa) return json(res, 401, { error: 'Vuelve a iniciar sesión' });
    if (!checkTotp(u.mfa, b.codigo)) { failed(ip); return json(res, 401, { error: 'Código incorrecto' }); }
  } else {
    ({ rows: [u] } = await db.query('select id, nombre, clave, activo, mfa from usuarios where usuario = $1', [String(b.usuario ?? '').trim().toLowerCase()]));
    if (!u || !(await checkPassword(String(b.clave ?? ''), u.clave))) { failed(ip); return json(res, 401, { error: NOPE }); }
    if (!u.activo) return json(res, 403, { error: 'Tu cuenta está desactivada. Habla con el administrador.' });
    if (u.mfa) return json(res, 200, { paso: 'codigo', ticket: sign({ uid: u.id, paso: 'mfa' }, SECRET, Date.now(), 5 * 60e3) });
  }
  const token = sign({ uid: u.id, nombre: u.nombre, sid: randomUUID() }, SECRET);
  res.setHeader('set-cookie', cookie(token, HOURS * 3600));
  const s = await current({ headers: { cookie: `yc_sesion=${token}` } });
  return json(res, 200, me(s));
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
  if (['/api/login', '/api/login/codigo', '/api/logout', '/api/me'].includes(url.pathname)) {
    if (url.pathname !== '/api/me' && req.method !== 'POST') return json(res, 405, { error: 'Método no permitido' });
    return account(req, res, url.pathname);
  }
  const s = await current(req);
  if (!s) return json(res, 401, { error: 'Inicia sesión' });
  if (url.pathname.startsWith('/api/seguridad/')) return req.method === 'POST' ? security(req, res, s, url.pathname) : json(res, 405, { error: 'Método no permitido' });
  if (s.limitado) return json(res, 403, { error: 'Completa la seguridad de tu cuenta', seguridad: true });
  if (url.pathname === '/api/usuarios') return accounts(req, res, s);
  if (url.pathname === '/api/base') return database(req, res, s);
  if (url.pathname === '/api/modelos') return models(req, res, s);
  if (url.pathname === '/api/comentarios') return comments(req, res, s, url);
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
  'content-security-policy': "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' blob: data:; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
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
