// TCQS: una fila por fecha × modelo × orden × estación (GROUP_NAME) × tester (STATION_NAME).
// Fórmulas verificadas contra FPRATE, RETESTRATE y FINAL_YIELD_RATE del propio archivo.
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

/** Filas válidas; `bad` son números de fila del archivo (contando el encabezado) con fecha, modelo, estación o cantidades inválidas. */
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
    if (!rec.date || !rec.model || !rec.group || [rec.input, rec.fp, rec.ff, rec.sp].some(Number.isNaN)) bad.push(i + 2);
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

export interface Totals { input: number; fp: number; ff: number; sp: number; fpy: number; final: number; retest: number; ndf: number }
const pct = (a: number, b: number) => (b ? (a / b) * 100 : 0);

export function totals(rs: Rec[]): Totals {
  const t = { input: 0, fp: 0, ff: 0, sp: 0 };
  for (const r of rs) { t.input += r.input; t.fp += r.fp; t.ff += r.ff; t.sp += r.sp; }
  return {
    ...t,
    fpy: pct(t.fp, t.input),
    final: Math.min(100, pct(t.fp + t.sp, t.input)),
    retest: pct(t.sp, t.input),
    // de las que fallaron la primera vez, cuántas pasaron en retest (sin falla encontrada)
    ndf: pct(Math.min(t.sp, t.ff), t.ff),
  };
}

/** Totales por grupo (estación, tester, modelo…), en el orden de `sort`. */
export function by(rs: Rec[], key: (r: Rec) => string) {
  const m = new Map<string, Rec[]>();
  for (const r of rs) (m.get(key(r)) ?? m.set(key(r), []).get(key(r))!).push(r);
  return [...m].map(([name, list]) => ({ name, ...totals(list) }));
}

/** Rolled throughput yield: producto del FPY de cada estación con entradas. */
export const rty = (stations: Totals[]) => stations.filter((s) => s.input > 0).reduce((p, s) => (p * s.fpy) / 100, 1) * 100;

export type Tone = 'ok' | 'warn' | 'bad' | 'neutral';
export function diagnose(t: Totals): [string, Tone] {
  if (t.input < MIN_SAMPLE) return ['Muestra insuficiente', 'neutral'];
  if (t.fpy >= META_FPY) return ['OK', 'ok'];
  if (t.final >= META_FPY) return ['Posible falso fallo (NDF)', 'warn'];
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
