// TCQS: una fila por fecha × modelo × orden × estación (GROUP_NAME) × tester (STATION_NAME).
// Fórmulas verificadas contra FPRATE, RETESTRATE y FINAL_YIELD_RATE del propio archivo y contra la
// «Guía de interpretación – YieldRateSFC y RetestRate» (fórmulas 1–4, 6, 10 y 11; reglas de lectura 2 y 4).
import type { Cell, ParsedFile } from './files.ts';

export const REQUIRED = ['WORK_DATE', 'MODEL_NAME', 'MO_NUMBER', 'GROUP_NAME', 'STATION_NAME', 'INPUT_QTY', 'FIRST_PASS_QTY', 'FIRST_FAIL_QTY', 'SECOND_PASS_QTY'] as const;
export const META_FPY = 95;
const MIN_SAMPLE = 10; // menos entradas que esto no basta para juzgar una estación

export interface Rec { date: string; model: string; mo: string; group: string; tester: string; input: number; fp: number; ff: number; sp: number }

const text = (v: Cell) => (v == null ? '' : String(v).trim());
const qty = (v: Cell) => { const n = Number(text(v)); return Number.isFinite(n) && n >= 0 ? n : NaN; };
/** WORK_DATE llega como 20261105 (texto o número) o como fecha de Excel; sale como 2026-11-05. */
function day(v: Cell) {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = text(v);
  return /^\d{8}$/.test(s) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6)}` : /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : '';
}

/** Filas válidas; `bad` son números de fila del archivo (contando el encabezado) con fecha, modelo, estación o
 * cantidades inválidas, o que rompen la fórmula 1 de la guía: INPUT = FIRST_PASS + FIRST_FAIL. */
export function readTcqs(f: ParsedFile) {
  const at = Object.fromEntries(REQUIRED.map((c) => [c, f.headers.findIndex((h) => h.toUpperCase() === c)])) as Record<(typeof REQUIRED)[number], number>;
  const missing = REQUIRED.filter((c) => at[c] < 0);
  const records: Rec[] = [], bad: number[] = [];
  if (missing.length) return { records, missing, bad };
  f.rows.forEach((r, i) => {
    const rec: Rec = {
      date: day(r[at.WORK_DATE]), model: text(r[at.MODEL_NAME]), mo: text(r[at.MO_NUMBER]), group: text(r[at.GROUP_NAME]), tester: text(r[at.STATION_NAME]),
      input: qty(r[at.INPUT_QTY]), fp: qty(r[at.FIRST_PASS_QTY]), ff: qty(r[at.FIRST_FAIL_QTY]), sp: qty(r[at.SECOND_PASS_QTY]),
    };
    if (!rec.date || !rec.model || !rec.group || [rec.input, rec.fp, rec.ff, rec.sp].some(Number.isNaN) || rec.fp + rec.ff !== rec.input) bad.push(i + 2);
    else records.push(rec);
  });
  return { records, missing, bad };
}

/** Números de modelo dentro del texto de las celdas (BOM): 920-9K33R-00MV-GS0, 699-9T363-1300-000, SA029400, MA017863… */
export function modelsFrom(f: ParsedFile) {
  const re = /\b(?:\d{3}-[0-9A-Z]{5}-[0-9A-Z]{4}-[0-9A-Z]{3}|[A-Z]{2}\d{6})\b/g;
  const all = [f.headers, ...f.rows].flat().map((c) => text(c).toUpperCase()).join('\n');
  return [...new Set(all.match(re))];
}

/** El BOM nombra MA016491 lo que el TCQS registra como SA016491 (mismo número de parte): se comparan iguales. */
export const modelKey = (m: string) => m.trim().toUpperCase().replace(/^MA(?=\d{6}$)/, 'SA');

export interface Totals {
  input: number; fp: number; ff: number;
  /** Segundos pases que sí cuentan: nunca más que las primeras fallas del mismo grupo. */
  sp: number;
  /** Segundos pases sin su primera falla en el rango (retest de otro día o de una entrada anterior). */
  extra: number;
  fpy: number; final: number; retest: number; recovered: number;
}
/** Entradas 0 = sin dato (NaN), no 0 % (guía, regla 2). */
const pct = (a: number, b: number) => (b ? (a / b) * 100 : NaN);

export function totals(rs: Rec[]): Totals {
  const t = { input: 0, fp: 0, ff: 0, sp: 0 };
  for (const r of rs) { t.input += r.input; t.fp += r.fp; t.ff += r.ff; t.sp += r.sp; }
  // ponderado (guía, fórmula 10), y así FPY + Retest = Final Yield (regla de comprobación)
  const sp = Math.min(t.sp, t.ff);
  return {
    ...t, sp, extra: t.sp - sp,
    fpy: pct(t.fp, t.input),
    retest: pct(sp, t.input),
    final: pct(t.fp + sp, t.input),
    // de las que fallaron la primera vez, cuántas pasaron al re-probarlas (guía, fórmula 11)
    recovered: pct(sp, t.ff),
  };
}

/** Totales por grupo (estación, tester, modelo…), en el orden de `sort`. */
export function by(rs: Rec[], key: (r: Rec) => string) {
  const m = new Map<string, Rec[]>();
  for (const r of rs) (m.get(key(r)) ?? m.set(key(r), []).get(key(r))!).push(r);
  return [...m].map(([name, list]) => ({ name, ...totals(list) }));
}

/** Rolled throughput yield: producto del FPY de cada estación con entradas. */
/** Orden de peor a mejor FPY; las estaciones sin dato van al final. */
export const byFpy = (a: Totals, b: Totals) => (Number.isNaN(a.fpy) ? Infinity : a.fpy) - (Number.isNaN(b.fpy) ? Infinity : b.fpy);

/** Porcentaje con un decimal; «—» cuando no hay entradas. */
export const pctText = (n: number) => (Number.isFinite(n) ? n.toFixed(1) : '—');

export const rty = (stations: Totals[]) => stations.filter((s) => s.input > 0).reduce((p, s) => (p * s.fpy) / 100, 1) * 100;

export type Tone = 'ok' | 'warn' | 'bad' | 'neutral';
/** Explicación al pasar el mouse sobre un diagnóstico. */
export const DX_HINT: Record<string, string> = { 'Datos insuficientes': `Los datos tomados del archivo Excel no son suficientes para un muestreo completo (menos de ${MIN_SAMPLE} entradas).` };
export function diagnose(t: Totals): [string, Tone] {
  if (!t.input) return ['Sin dato', 'neutral'];
  if (t.input < MIN_SAMPLE) return ['Datos insuficientes', 'neutral'];
  if (t.fpy >= META_FPY) return ['OK', 'ok'];
  if (t.final >= META_FPY) return ['Posible falsa falla', 'warn']; // se recupera en retest sin reparar: revisar fixture/tester
  return ['Crítico', 'bad'];
}

export type Grain = 'dia' | 'semana' | 'mes';
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const shortDay = (iso: string) => `${+iso.slice(8)} ${MONTHS[+iso.slice(5, 7) - 1]}`;

/** Clave ordenable y etiqueta del periodo de una fecha ISO. Semanas ISO (lunes a domingo). */
export function periodOf(iso: string, g: Grain): [string, string] {
  if (g === 'dia') return [iso, shortDay(iso)];
  if (g === 'mes') return [iso.slice(0, 7), `${MONTHS[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}`];
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7)); // jueves de esa semana
  const y = d.getUTCFullYear(), w = 1 + Math.floor((d.getTime() - Date.UTC(y, 0, 1)) / 864e5 / 7);
  return [`${y}-W${String(w).padStart(2, '0')}`, `Sem ${w}`];
}

/** Periodos con datos, en orden: [clave, etiqueta]. */
export function periodsOf(rs: Rec[], g: Grain) {
  return [...new Map(rs.map((r) => periodOf(r.date, g)))].sort(([a], [b]) => (a < b ? -1 : 1));
}

/** Cambio contra el periodo anterior, a un decimal; sin cambio si falta dato o alguno de los dos
 * periodos tiene muy pocas entradas (guía, regla 1: con poco volumen el porcentaje no es estable). */
type WithInput<K extends string> = { input: number } & Record<K, number>;
export function change<K extends string>(cur: WithInput<K>, prev: WithInput<K> | undefined, key: K) {
  if (!prev || cur.input < MIN_SAMPLE || prev.input < MIN_SAMPLE) return undefined;
  const d = cur[key] - prev[key];
  return Number.isFinite(d) ? Math.round(d * 10) / 10 : undefined;
}

export const ACTION = { bad: 'Falla real del proceso: revisar la estación.', warn: 'Se recupera en retest sin reparar: revisar fixture, puntas o tester.' };

/** Hasta 3 estaciones a revisar: primero las críticas, luego las posibles falsas fallas; dentro, peor FPY primero. */
export function toWatch<T extends Totals>(stations: T[]) {
  return stations.filter((s) => s.input > 0).map((s) => ({ ...s, dx: diagnose(s) })).filter((s) => s.dx[1] === 'bad' || s.dx[1] === 'warn')
    .sort((a, b) => (a.dx[1] === b.dx[1] ? byFpy(a, b) : a.dx[1] === 'bad' ? -1 : 1)).slice(0, 3);
}

/** Fila de la tabla yield_resumen en Neon: conteos por día × modelo × estación (los % se calculan al leer). */
export interface DbRow { fecha: string; modelo: string; estacion: string; entradas: number; primer_pase: number; primera_falla: number; segundo_pase: number }

export function daily(rs: Rec[]): DbRow[] {
  const m = new Map<string, DbRow>();
  for (const r of rs) {
    const k = `${r.date}|${r.model}|${r.group}`;
    const d = m.get(k) ?? m.set(k, { fecha: r.date, modelo: r.model, estacion: r.group, entradas: 0, primer_pase: 0, primera_falla: 0, segundo_pase: 0 }).get(k)!;
    d.entradas += r.input; d.primer_pase += r.fp; d.primera_falla += r.ff; d.segundo_pase += r.sp;
  }
  return [...m.values()];
}

/** El histórico de Neon con forma de TCQS, para que todas las pantallas lo lean igual. */
export function fromDb(rows: DbRow[]): ParsedFile {
  return {
    headers: [...REQUIRED],
    rows: rows.map((r) => [r.fecha, r.modelo, '', r.estacion, '', r.entradas, r.primer_pase, r.primera_falla, r.segundo_pase]),
  };
}
