// Validación y match por una columna llave (p. ej. serial), sin suponer el resto del formato.
// shortcut: una sola llave; si el piso necesita serial + estación, pasar a una lista de columnas.
import type { ParsedFile } from './files.ts';

const col = (f: ParsedFile, key: string) => f.headers.findIndex((h) => h.toLowerCase() === key.toLowerCase());
const norm = (v: unknown) => (v == null ? '' : String(v).trim().toUpperCase());

export interface Check { rows: number; hasKey: boolean; empty: number; duplicated: number }

export function validate(f: ParsedFile, key: string): Check {
  const i = col(f, key);
  if (i < 0) return { rows: f.rows.length, hasKey: false, empty: 0, duplicated: 0 };
  const seen = new Set<string>();
  let empty = 0, duplicated = 0;
  for (const r of f.rows) {
    const k = norm(r[i]);
    if (!k) empty++;
    else if (seen.has(k)) duplicated++;
    else seen.add(k);
  }
  return { rows: f.rows.length, hasKey: true, empty, duplicated };
}

/** Por cada llave, en qué archivos aparece. `partial` = las que faltan en al menos uno. */
export function matchKeys(files: Record<string, ParsedFile>, key: string) {
  const types = Object.keys(files);
  const where = new Map<string, Set<string>>();
  for (const t of types) {
    const i = col(files[t], key);
    if (i < 0) continue;
    for (const r of files[t].rows) {
      const k = norm(r[i]);
      if (k) (where.get(k) ?? where.set(k, new Set()).get(k)!).add(t);
    }
  }
  const partial = [...where].filter(([, s]) => s.size < types.length).map(([k, s]) => ({ key: k, in: types.filter((t) => s.has(t)) }));
  return { types, total: where.size, inAll: where.size - partial.length, partial };
}
