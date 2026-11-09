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

export interface Sesion { nombre: string; sesion: string; admin: boolean; principal: boolean; mfa: boolean; debeCambiar: boolean; mfaPendiente: boolean }
/** Con MFA activo, el primer paso devuelve un ticket de 5 min para el código. */
export const apiLogin = (usuario: string, clave: string) => post<Sesion | { paso: 'codigo'; ticket: string }>('/api/login', { usuario, clave });
export const apiCodigo = (ticket: string, codigo: string) => post<Sesion>('/api/login/codigo', { ticket, codigo });
export const changePassword = (actual: string, nueva: string) => post('/api/seguridad/clave', { actual, nueva });
export const mfaStart = () => post<{ secreto: string; uri: string }>('/api/seguridad/mfa/iniciar', {});
export const mfaConfirm = (codigo: string) => post('/api/seguridad/mfa/confirmar', { codigo });
export const apiLogout = () => post('/api/logout', {});
export const apiMe = () => call<Sesion>('/api/me');

export interface Cuenta { id: number; usuario: string; nombre: string; activo: boolean; admin: boolean; debe_cambiar: boolean; mfa: boolean; creado: string; principal: boolean }
export const loadCuentas = () => call<{ usuarios: Cuenta[] }>('/api/usuarios').then((b) => b.usuarios);
export type AccionCuenta =
  | { accion: 'crear'; usuario: string; nombre: string; clave: string; admin: boolean }
  | { accion: 'editar'; id: number; nombre?: string; activo?: boolean; admin?: boolean }
  | { accion: 'clave'; id: number; clave: string }
  | { accion: 'mfa' | 'borrar'; id: number };
export const cuentaAccion = (a: AccionCuenta) => post('/api/usuarios', a);

export interface EstadoBase { bytes: number; tablas: { tabla: string; filas: number; bytes: number }[]; resumen: { desde: string | null; hasta: string | null; filas: number } }
export const loadBase = () => call<EstadoBase>('/api/base');
export const baseAccion = (a: { accion: 'borrarCarga'; id: number } | { accion: 'borrarRango'; desde: string; hasta: string } | { accion: 'retener'; dias: number }) =>
  post<{ borradas: number }>('/api/base', a);

// quién guarda y en qué sesión lo pone el servidor a partir de la cookie
export const saveSummary = (archivo: string, filas: DbRow[]) => post<{ guardadas: number }>('/api/resumen', { archivo, filas });
export const loadSummary = (desde?: string, hasta?: string) =>
  call<{ filas: DbRow[] }>(`/api/resumen${desde && hasta ? `?desde=${desde}&hasta=${hasta}` : ''}`).then((b) => b.filas);
export const loadCargas = () => call<{ cargas: Carga[] }>('/api/cargas').then((b) => b.cargas);
