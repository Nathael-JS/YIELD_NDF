// API del servidor (server/index.js): cuentas y datos en Neon. Misma dirección que la app: la sesión va en una
// cookie que JavaScript no puede leer, y ninguna clave vive en el navegador.
import type { DbRow } from './tcqs.ts';

/** Lo llama la app cuando el servidor dice que la sesión ya no vale (vencida o cerrada). */
export let onExpired = () => {};
export const setOnExpired = (f: () => void) => { onExpired = f; };

export interface Carga { id: number; sesion: string; usuario: string; archivo: string; filas: number; entradas: number; primer_pase: number; primera_falla: number; segundo_pase: number; desde: string; hasta: string; guardado_en: string }

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  // status 0 = no hay API (sin conexión, sitio estático o página de error en HTML)
  const fail = (msg: string, status = 0) => Object.assign(new Error(msg), { status });
  const r = await fetch(path, init).catch(() => { throw fail('No hay conexión con el servidor.'); });
  if (!r.headers.get('content-type')?.includes('application/json')) throw fail(`El servidor no respondió como API (${r.status}).`);
  const body = await r.json();
  if (r.status === 401 && !path.startsWith('/api/login')) onExpired();
  if (!r.ok) throw fail(body.error ?? `Error ${r.status}`, r.status);
  return body;
}

const post = <T>(path: string, data: unknown) => call<T>(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });

export interface Sesion { nombre: string; sesion: string; admin: boolean }
export const apiLogin = (usuario: string, clave: string) => post<Sesion>('/api/login', { usuario, clave });
export const apiLogout = () => post('/api/logout', {});
export const apiMe = () => call<Sesion>('/api/me');

export interface Cuenta { id: number; usuario: string; nombre: string; activo: boolean; admin: boolean; creado: string; principal: boolean }
export const loadCuentas = () => call<{ usuarios: Cuenta[] }>('/api/usuarios').then((b) => b.usuarios);
export const setCuenta = (id: number, cambio: { activo?: boolean; admin?: boolean }) => post('/api/usuarios', { id, ...cambio });

// quién guarda y en qué sesión lo pone el servidor a partir de la cookie
export const saveSummary = (archivo: string, filas: DbRow[]) => post<{ guardadas: number }>('/api/resumen', { archivo, filas });
export const loadSummary = (desde?: string, hasta?: string) =>
  call<{ filas: DbRow[] }>(`/api/resumen${desde && hasta ? `?desde=${desde}&hasta=${hasta}` : ''}`).then((b) => b.filas);
export const loadCargas = () => call<{ cargas: Carga[] }>('/api/cargas').then((b) => b.cargas);
