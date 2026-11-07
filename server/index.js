// Servidor de Yield Control en Render: sirve la app (dist/) y la API del resumen en Neon.
// La conexión vive solo aquí (DATABASE_URL en Render), nunca en el navegador.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import pg from 'pg';
import { validate } from './validate.js';

const DIST = resolve('dist');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json' };
const LIMIT = 5 * 1024 * 1024;

const db = process.env.DATABASE_URL ? new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 3 }) : null;
const ready = db?.query(`create table if not exists yield_resumen (
  fecha date not null, modelo text not null, estacion text not null,
  entradas int not null, primer_pase int not null, primera_falla int not null, segundo_pase int not null,
  archivo text not null, guardado_en timestamptz not null default now(),
  primary key (fecha, modelo, estacion))`);

const json = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };

async function body(req) {
  let size = 0; const parts = [];
  for await (const c of req) { size += c.length; if (size > LIMIT) throw Object.assign(new Error('Archivo demasiado grande (máx. 5 MB)'), { code: 413 }); parts.push(c); }
  return JSON.parse(Buffer.concat(parts).toString('utf8'));
}

async function api(req, res) {
  if (!db) return json(res, 503, { error: 'Base de datos no configurada (falta DATABASE_URL)' });
  await ready;
  if (req.method === 'GET') {
    const { rows } = await db.query(`select to_char(fecha, 'YYYY-MM-DD') fecha, modelo, estacion, entradas, primer_pase, primera_falla, segundo_pase
      from yield_resumen order by fecha, modelo, estacion`);
    return json(res, 200, { filas: rows });
  }
  if (req.method === 'POST') {
    const v = validate(await body(req));
    if (v.error) return json(res, 400, { error: v.error });
    const col = (k) => v.filas.map((f) => f[k]);
    // la carga más reciente de un mismo día × modelo × estación reemplaza a la anterior
    const r = await db.query(`insert into yield_resumen (fecha, modelo, estacion, entradas, primer_pase, primera_falla, segundo_pase, archivo)
      select f, m, e, i, p, ff, sp, $8 from unnest($1::date[], $2::text[], $3::text[], $4::int[], $5::int[], $6::int[], $7::int[]) as t(f, m, e, i, p, ff, sp)
      on conflict (fecha, modelo, estacion) do update set entradas = excluded.entradas, primer_pase = excluded.primer_pase,
        primera_falla = excluded.primera_falla, segundo_pase = excluded.segundo_pase, archivo = excluded.archivo, guardado_en = now()`,
      [col('fecha'), col('modelo'), col('estacion'), col('entradas'), col('primer_pase'), col('primera_falla'), col('segundo_pase'), v.archivo]);
    return json(res, 200, { guardadas: r.rowCount });
  }
  json(res, 405, { error: 'Método no permitido' });
}

async function file(req, res) {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
  const full = join(DIST, path);
  // nada fuera de dist/; rutas de la app (/yield, /carga…) devuelven index.html
  const target = full.startsWith(DIST + '/') && extname(full) ? full : join(DIST, 'index.html');
  try {
    const data = await readFile(target);
    res.writeHead(200, { 'content-type': TYPES[extname(target)] ?? 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404).end('No encontrado');
  }
}

createServer(async (req, res) => {
  try {
    if (req.url.startsWith('/api/resumen')) await api(req, res);
    else await file(req, res);
  } catch (e) {
    json(res, e.code === 413 ? 413 : e instanceof SyntaxError ? 400 : 500, { error: e.code === 413 || e instanceof SyntaxError ? e.message : 'Error del servidor' });
    if (e.code !== 413 && !(e instanceof SyntaxError)) console.error(e);
  }
}).listen(process.env.PORT || 3000, () => console.log(`Yield Control en el puerto ${process.env.PORT || 3000}${db ? ' con base de datos' : ' sin base de datos'}`));
