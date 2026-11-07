// API del servidor (server/index.js) para Neon. Misma dirección que la app: sin claves en el navegador.
import type { DbRow } from './tcqs.ts';

export interface Carga { id: number; sesion: string; usuario: string; archivo: string; filas: number; entradas: number; primer_pase: number; primera_falla: number; segundo_pase: number; desde: string; hasta: string; guardado_en: string }

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path, init);
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error ?? `Error ${r.status}`);
  return body;
}

export const saveSummary = (archivo: string, filas: DbRow[], sesion: string, usuario: string) =>
  call<{ guardadas: number }>('/api/resumen', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ archivo, sesion, usuario, filas }) });
export const loadSummary = (desde?: string, hasta?: string) =>
  call<{ filas: DbRow[] }>(`/api/resumen${desde && hasta ? `?desde=${desde}&hasta=${hasta}` : ''}`).then((b) => b.filas);
export const loadCargas = () => call<{ cargas: Carga[] }>('/api/cargas').then((b) => b.cargas);
