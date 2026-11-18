// Primeras fallas por unidad (reporte FirstFail): el «por qué» de cada falla, con su código de error.
// Cuántas son NDF lo dice el TCQS (2do pase = falló y pasó al re-probar sin reparación; FAIL = real; el resto,
// pendiente). Cada unidad se marca con su orden × estación del TCQS en todo el rango: el retest suele quedar
// registrado otro día u en otro tester que la primera falla. El conteo fino (día × orden × estación × tester) solo
// comprueba que el archivo cuadre con FIRST_FAIL_QTY.
import type { Cell, ParsedFile } from './files.ts';
import { by, type Rec } from './tcqs.ts';

export const FAIL_REQUIRED = ['MO_NUMBER', 'MODEL_NAME', 'SERIAL_NUMBER', 'GROUP_NAME', 'STATION_NAME', 'ERROR_CODE', 'ERROR_DESC', 'IN_STATION_TIME'] as const;

export interface Fail { date: string; model: string; mo: string; group: string; tester: string; serial: string; code: string; desc: string }
/** NDF: todo su grupo pasó al re-probar · Real: ninguno pasó y todos fallaron el retest · Pendiente: aún sin re-probar ·
 * Mezcla: el grupo tiene de varios y no se sabe cuál es esta (`ndf` = probabilidad) · Sin TCQS: el TCQS no registra esa falla. */
export type Estado = 'NDF' | 'Mezcla' | 'Real' | 'Pendiente' | 'Sin TCQS';
export type Marked = Fail & { estado: Estado; ndf: number };

const text = (v: Cell) => (v == null ? '' : String(v).trim());
/** «2026-11-13 11:20:40», fecha de Excel o número de serie de Excel → 2026-11-13. */
function day(v: Cell) {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'number') return new Date(Date.UTC(1899, 11, 30) + v * 864e5).toISOString().slice(0, 10);
  const s = text(v);
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : '';
}

export function readFails(f: ParsedFile) {
  const at = Object.fromEntries(FAIL_REQUIRED.map((c) => [c, f.headers.findIndex((h) => h.toUpperCase() === c)])) as Record<(typeof FAIL_REQUIRED)[number], number>;
  const missing = FAIL_REQUIRED.filter((c) => at[c] < 0);
  const fails: Fail[] = [], bad: number[] = [];
  if (missing.length) return { fails, missing, bad };
  f.rows.forEach((r, i) => {
    const x: Fail = { date: day(r[at.IN_STATION_TIME]), model: text(r[at.MODEL_NAME]), mo: text(r[at.MO_NUMBER]), group: text(r[at.GROUP_NAME]),
      tester: text(r[at.STATION_NAME]), serial: text(r[at.SERIAL_NUMBER]), code: text(r[at.ERROR_CODE]), desc: text(r[at.ERROR_DESC]) };
    if (!x.date || !x.serial || !x.group) bad.push(i + 2); else fails.push(x);
  });
  return { fails, missing, bad };
}

type K = { date: string; mo: string; group: string; tester: string };
const fine = (x: K) => `${x.date}|${x.mo}|${x.group}|${x.tester}`, key = (x: K) => `${x.mo}|${x.group}`;

/** Marca cada primera falla con lo que dice el TCQS de su grupo; `distintos` = grupos donde el conteo no cuadra con FIRST_FAIL_QTY. */
export function classify(fails: Fail[], recs: Rec[]) {
  const g = new Map<string, { ff: number; sp: number; fail: number }>();
  for (const r of recs) {
    const a = g.get(key(r)) ?? g.set(key(r), { ff: 0, sp: 0, fail: 0 }).get(key(r))!;
    a.ff += r.ff; a.sp += r.sp; a.fail += r.fail ?? NaN; // sin FAIL_QTY no se distingue real de pendiente
  }
  const n = new Map<string, number>(), ffFine = new Map<string, number>();
  for (const x of fails) n.set(fine(x), (n.get(fine(x)) ?? 0) + 1);
  for (const r of recs) if (r.ff) ffFine.set(fine(r), (ffFine.get(fine(r)) ?? 0) + r.ff);
  const marked: Marked[] = fails.map((x) => {
    const a = g.get(key(x));
    if (!a?.ff) return { ...x, estado: 'Sin TCQS', ndf: 0 };
    const p = Math.min(a.sp, a.ff) / a.ff;
    const estado: Estado = p === 1 ? 'NDF' : p > 0 ? 'Mezcla' : a.fail >= a.ff ? 'Real' : a.fail === 0 ? 'Pendiente' : 'Mezcla';
    return { ...x, estado, ndf: p };
  });
  const keys = new Set([...n.keys(), ...ffFine.keys()]);
  const distintos = [...keys].filter((k) => (n.get(k) ?? 0) !== (ffFine.get(k) ?? 0)).length;
  return { marked, grupos: keys.size, distintos };
}

/** Por estación: NDF = 2do pase, real = FAIL_QTY (falló el retest), pendiente = lo que falta re-probar; más NDF primero.
 * Sin FAIL_QTY (lo leído de la base) real y pendiente quedan en NaN («—»). */
export function ndfStations(recs: Rec[]) {
  return by(recs, (r) => r.group).filter((s) => s.ff > 0).map((s) => {
    const real = recs.reduce((a, r) => (r.group === s.name ? a + (r.fail ?? NaN) : a), 0);
    return { ...s, ndf: s.sp, real, pend: Math.max(0, s.ff - s.sp - real) };
  }).sort((a, b) => b.ndf - a.ndf);
}

/** Cuenta por `label` con el desglose por estado, de mayor a menor (para Pareto y tabla). */
export function byLabel(ms: Marked[], label: (m: Marked) => string) {
  const m = new Map<string, Record<Estado | 'total' | 'est', number> & { name: string; desc: string }>();
  for (const x of ms) {
    const k = label(x);
    const c = m.get(k) ?? m.set(k, { name: k, desc: x.desc, total: 0, est: 0, NDF: 0, Mezcla: 0, Real: 0, Pendiente: 0, 'Sin TCQS': 0 }).get(k)!;
    c.total++; c[x.estado]++; c.est += x.ndf; // est: NDF estimado (suma de probabilidades)
  }
  return [...m.values()].sort((a, b) => b.total - a.total);
}

/** Etiquetas dentro del 80 % acumulado (y siempre la primera), como la columna «Pareto 80 %» del Excel. */
export function top80<T extends { total: number }>(rows: T[]) {
  const all = rows.reduce((s, r) => s + r.total, 0);
  let cum = 0;
  return rows.filter((r, i) => { cum += r.total; return i === 0 || cum / all <= 0.8 + 1e-9; });
}
