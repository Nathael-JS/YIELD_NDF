// API del servidor (server/index.js) para el resumen en Neon. Misma dirección que la app: sin claves en el navegador.
import type { DbRow } from './tcqs.ts';

async function call<T>(init?: RequestInit): Promise<T> {
  const r = await fetch('/api/resumen', init);
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error ?? `Error ${r.status}`);
  return body;
}

export const saveSummary = (archivo: string, filas: DbRow[]) =>
  call<{ guardadas: number }>({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ archivo, filas }) });
export const loadSummary = () => call<{ filas: DbRow[] }>().then((b) => b.filas);
