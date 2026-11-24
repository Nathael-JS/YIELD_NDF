// Verificación de la base y de la API, SOLO LECTURA: `npm run check` (usa DATABASE_URL) y/o `npm run check -- --api https://…`.
// No escribe nada (la sesión de Postgres va en modo solo lectura) ni muestra datos o secretos: solo estructura y conteos.
import pg from 'pg';

/** Lo que crea server/index.js al arrancar (tablas y columnas). Si cambia el esquema, cambia también aquí. */
const ESPERADO = {
  yield_resumen: ['fecha', 'modelo', 'estacion', 'entradas', 'primer_pase', 'primera_falla', 'segundo_pase', 'archivo', 'guardado_en', 'ordenes', 'carga'],
  yield_cargas: ['id', 'sesion', 'usuario', 'archivo', 'filas', 'entradas', 'primer_pase', 'primera_falla', 'segundo_pase', 'desde', 'hasta', 'guardado_en', 'congruencia'],
  usuarios: ['id', 'usuario', 'nombre', 'clave', 'activo', 'admin', 'creado', 'debe_cambiar', 'mfa', 'mfa_nuevo'],
  yield_respaldos: ['id', 'motivo', 'usuario', 'datos', 'creado', 'vence'],
  yield_modelos: ['modelo', 'archivo', 'usuario', 'guardado_en'],
  yield_comentarios: ['id', 'grafica', 'usuario', 'texto', 'creado'],
};
const INDICES = ['yield_comentarios_grafica'];

let fallas = 0;
const aviso = (msg, extra) => console.log(`AVISO ${msg} · ${extra}`); // a revisar, pero no es un error
const ok = (b, msg, extra = '') => { if (!b) fallas++; console.log(`${b ? 'OK   ' : 'FALLA'} ${msg}${extra ? ` · ${extra}` : ''}`); };

async function base(url) {
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  try {
    await c.query('set default_transaction_read_only = on'); // aunque alguien cambie este archivo, no puede escribir
    const { rows: cols } = await c.query(`select table_name t, column_name c from information_schema.columns where table_schema = 'public'`);
    const reales = new Map();
    for (const { t, c: col } of cols) (reales.get(t) ?? reales.set(t, new Set()).get(t)).add(col);
    console.log('\nBase de datos');
    for (const [t, esperadas] of Object.entries(ESPERADO)) {
      const r = reales.get(t);
      if (!r) { ok(false, `tabla ${t}`, 'no existe (el servidor la crea al arrancar: ¿arrancó con esta DATABASE_URL?)'); continue; }
      const faltan = esperadas.filter((x) => !r.has(x)), sobran = [...r].filter((x) => !esperadas.includes(x));
      const { rows: [{ n }] } = await c.query(`select count(*)::int n from ${t}`); // t viene de ESPERADO, no de afuera
      ok(!faltan.length, `tabla ${t}`, `${n} filas${faltan.length ? ` · faltan columnas: ${faltan.join(', ')}` : ''}${sobran.length ? ` · columnas extra: ${sobran.join(', ')}` : ''}`);
    }
    const otras = [...reales.keys()].filter((t) => !(t in ESPERADO));
    if (otras.length) console.log(`INFO  tablas que la app no usa: ${otras.join(', ')}`);
    const { rows: idx } = await c.query(`select indexname from pg_indexes where schemaname = 'public'`);
    for (const i of INDICES) ok(idx.some((x) => x.indexname === i), `índice ${i}`);
    if (reales.has('yield_respaldos')) {
      const { rows: [{ n }] } = await c.query('select count(*)::int n from yield_respaldos where vence < now()');
      ok(true, 'respaldos vencidos por borrar', `${n} (se borran solos al usar respaldos)`);
    }
    if (reales.has('usuarios')) {
      const { rows: [u] } = await c.query(`select count(*)::int total, count(*) filter (where activo)::int activos, count(*) filter (where admin)::int admins,
        count(*) filter (where admin and mfa is null)::int admins_sin_mfa, count(*) filter (where debe_cambiar)::int temporales from usuarios`);
      ok(u.admins > 0, 'cuentas', `${u.total} (${u.activos} activas, ${u.admins} administradores, ${u.temporales} con contraseña temporal)`);
      if (u.admins_sin_mfa) aviso('administradores sin MFA', `${u.admins_sin_mfa}: solo pueden entrar a Seguridad hasta configurarlo`); else ok(true, 'administradores con MFA');
    }
  } finally { await c.end(); }
}

/** Lo que se puede revisar sin sesión: salud, que todo lo demás pida sesión y que se rechace lo que no es JSON. */
async function api(url) {
  console.log(`\nAPI · ${url}`);
  const call = (m, p, body, type) => fetch(url + p, { method: m, headers: type ? { 'content-type': type } : {}, body }).then((r) => r.status, () => 0);
  ok(await call('GET', '/api/salud') === 200, 'GET /api/salud', '200');
  for (const p of ['/api/me', '/api/cargas', '/api/resumen', '/api/modelos', '/api/usuarios', '/api/base', '/api/respaldos', '/api/comentarios?grafica=x']) ok(await call('GET', p) === 401, `GET ${p} sin sesión`, '401');
  ok(await call('GET', '/api/login') === 405, 'GET /api/login', '405 (solo POST)');
  ok(await call('POST', '/api/login', 'x', 'text/plain') === 415, 'POST /api/login sin JSON', '415');
  // sin probar una clave mala: contaría como intento fallido y podría bloquear 15 min a quien comparta la IP
  const s = await fetch(url + '/api/salud').then((r) => r.json(), () => ({}));
  ok(s.base === true, 'el servidor llega a la base', JSON.stringify(s));
}

const i = process.argv.indexOf('--api'), apiUrl = i > 0 ? process.argv[i + 1]?.replace(/\/$/, '') : '';
if (!process.env.DATABASE_URL && !apiUrl) { console.log('Uso: DATABASE_URL=… npm run check   y/o   npm run check -- --api https://tu-servicio.onrender.com'); process.exit(2); }
try {
  if (process.env.DATABASE_URL) await base(process.env.DATABASE_URL);
  if (apiUrl) await api(apiUrl);
} catch (e) { fallas++; console.log(`FALLA ${e instanceof Error ? e.message : e}`); }
console.log(fallas ? `\n${fallas} falla(s)` : '\nTodo en orden');
process.exit(fallas ? 1 : 0);
