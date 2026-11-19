// WIP (Work in Process): reporte del MES con una fila por pieza y la estación donde está ahora.
// No se estima con el TCQS (no registra la entrada a almacén): se cuenta del archivo y se cruza con el TCQS
// por orden y estación (FPY de la estación junto a las piezas que esperan en ella).
import type { Cell, ParsedFile } from './files.ts';
import { by, META_FPY, type Rec } from './tcqs.ts';

export const WIP_REQUIRED = ['SERIAL_NUMBER', 'MODEL_NAME', 'MO_NUMBER', 'SECTION_NAME', 'WIP_GROUP', 'IN_STATION_TIME', 'HOUR', 'ERROR_FLAG'] as const;

/** Línea: en proceso · Hold: retenida · Reparación: R_… o REPAIR · Bonpile: B28M/B30M/B31M (pila de falladas). */
export type Estado = 'Línea' | 'Hold' | 'Reparación' | 'Bonpile';
export interface Pieza {
  serial: string; model: string; mo: string; section: string; station: string;
  /** Llegada a la estación actual, «2026-11-19 08:14:59». */
  at: string; hours: number; blocked: boolean; estado: Estado;
}

/** Empaque: es WIP, pero no se muestra (así se acordó con planta). */
const OCULTAS = new Set(['FG', 'PACK_CTN', 'PACK_PALT']);
/** Orden del flujo por sección; las que no estén van al final. */
export const SECCIONES = ['INPUT', 'SMT', 'PTH', 'ICT', 'TEST', 'ASSY_2', 'SI'];

const text = (v: Cell) => (v == null ? '' : String(v).trim());
const pad = (n: number) => String(n).padStart(2, '0');
const stamp = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
/** «2026/05/21 14:58:21», fecha de Excel o número de serie de Excel → «2026-05-21 14:58:21» (hora de planta, sin zona). */
function when(v: Cell) {
  if (v instanceof Date) return stamp(v);
  if (typeof v === 'number') return stamp(new Date(Date.UTC(1899, 11, 30) + Math.round(v * 86400) * 1000)); // al segundo: la fracción del día no es exacta
  const m = text(v).match(/^(\d{4})[-/](\d{2})[-/](\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  return m ? `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:${m[6] ?? '00'}` : '';
}
const ms = (s: string) => Date.parse(`${s.replace(' ', 'T')}Z`);

export function estadoOf(g: string): Estado {
  if (g.startsWith('HOLD-')) return 'Hold';
  if (/^B\d+M$/.test(g)) return 'Bonpile';
  return g.startsWith('R_') || g.startsWith('REPAIR') ? 'Reparación' : 'Línea';
}

/** Piezas en proceso (sin terminadas ni empaque), sin filas repetidas, y la hora del corte (llegada + horas en estación). */
export function readWip(f: ParsedFile) {
  const at = Object.fromEntries(WIP_REQUIRED.map((c) => [c, f.headers.findIndex((h) => h.toUpperCase() === c)])) as Record<(typeof WIP_REQUIRED)[number], number>;
  const missing = WIP_REQUIRED.filter((c) => at[c] < 0);
  const out = { piezas: [] as Pieza[], missing, bad: [] as number[], corte: '', terminadas: [] as Pieza[], ocultas: [] as Pieza[] }; // aparte, para contarlas con los mismos filtros
  if (missing.length) return out;
  // el reporte del MES repite filas idénticas: una pieza por serial (la llegada más reciente)
  const seen = new Map<string, Pieza>();
  let corte = 0;
  f.rows.forEach((r, i) => {
    const p: Pieza = {
      serial: text(r[at.SERIAL_NUMBER]), model: text(r[at.MODEL_NAME]), mo: text(r[at.MO_NUMBER]),
      section: text(r[at.SECTION_NAME]), station: text(r[at.WIP_GROUP]), at: when(r[at.IN_STATION_TIME]), hours: Number(text(r[at.HOUR]).replace(',', '.')), // CSV en español: «20,5»
      blocked: !['', '0'].includes(text(r[at.ERROR_FLAG])), estado: 'Línea',
    };
    if (!p.serial || !p.station || !p.at || !Number.isFinite(p.hours)) { out.bad.push(i + 2); return; }
    corte = Math.max(corte, ms(p.at) + p.hours * 36e5);
    const old = seen.get(p.serial);
    if (!old || old.at < p.at) seen.set(p.serial, { ...p, estado: estadoOf(p.station) });
  });
  for (const p of seen.values()) {
    if (/STOCKIN|SHIP/.test(p.station)) out.terminadas.push(p);
    else if (OCULTAS.has(p.station)) out.ocultas.push(p);
    else out.piezas.push(p);
  }
  out.corte = corte ? stamp(new Date(Math.round(corte / 6e4) * 6e4)) : '';
  return out;
}

/** Criticidad por horas en la estación: verde < 2 h, naranja < 20 h, rojo desde 20 h; urgente pasando de 100 h. */
export type Nivel = 'ok' | 'warn' | 'bad';
export const nivel = (h: number): Nivel => (h < 2 ? 'ok' : h < 20 ? 'warn' : 'bad');
export const urgente = (h: number) => h > 100;

export type Ventana = 'hora' | 'turno' | 'dia' | 'semana' | 'todo';
// shortcut: turnos de 8 h que empiezan 6:00, 14:00 y 22:00; si planta usa otros, cambiar aquí
const TURNOS = [6, 14, 22];
/** Desde cuándo cuenta la ventana, respecto al corte del archivo: llegaron a su estación desde entonces. */
export function desde(corte: string, v: Ventana) {
  const t = ms(corte), d = new Date(t), h = d.getUTCHours(), day = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  if (v === 'hora') return stamp(new Date(t - 36e5));
  if (v === 'turno') {
    const start = [...TURNOS].reverse().find((s) => s <= h);
    return stamp(new Date(start == null ? day - 2 * 36e5 : day + start * 36e5)); // antes de las 6 sigue el turno de las 22 del día anterior
  }
  if (v === 'dia') return stamp(new Date(day));
  if (v === 'semana') return stamp(new Date(day - ((d.getUTCDay() + 6) % 7) * 864e5)); // desde el lunes, como el resto del proyecto
  return '';
}

const mostCommon = (xs: string[]) => { const c = new Map<string, number>(); for (const x of xs) c.set(x, (c.get(x) ?? 0) + 1); return [...c].sort((a, b) => b[1] - a[1])[0][0]; };

/** Por estación, en el orden del flujo: piezas por nivel, la más antigua, bloqueadas y el FPY del TCQS (si la prueba ahí). */
export function stations(ps: Pieza[], recs: Rec[]) {
  const fpy = new Map(by(recs, (r) => r.group).map((s) => [s.name, s.fpy]));
  const m = new Map<string, Pieza[]>();
  for (const p of ps) (m.get(p.station) ?? m.set(p.station, []).get(p.station)!).push(p);
  const sec = (s: string) => (SECCIONES.indexOf(s) + SECCIONES.length + 1) % (SECCIONES.length + 1); // sin sección conocida: al final
  return [...m].map(([name, list]) => {
    const f = fpy.get(name) ?? NaN;
    return {
      name, section: mostCommon(list.map((p) => p.section)), n: list.length, estado: list[0].estado,
      ok: list.filter((p) => nivel(p.hours) === 'ok').length, warn: list.filter((p) => nivel(p.hours) === 'warn').length,
      bad: list.filter((p) => nivel(p.hours) === 'bad').length, urgent: list.filter((p) => urgente(p.hours)).length,
      blocked: list.filter((p) => p.blocked).length, max: Math.max(...list.map((p) => p.hours)), fpy: f,
      // se acumulan piezas donde el TCQS dice que la estación falla: cuello de botella probable
      cuello: f < META_FPY && list.length >= 10,
      piezas: list.sort((a, b) => b.hours - a.hours),
    };
  }).sort((a, b) => sec(a.section) - sec(b.section) || a.section.localeCompare(b.section) || b.n - a.n); // secciones nuevas: juntas, por nombre
}

/** Órdenes que no cruzan: con piezas en el WIP y sin TCQS, y del TCQS sin piezas en proceso. */
export function cruce(ps: Pieza[], recs: Rec[]) {
  const w = new Set(ps.map((p) => p.mo)), t = new Set(recs.flatMap((r) => r.mo.split(',')).filter(Boolean));
  return { soloWip: [...w].filter((x) => !t.has(x)), soloTcqs: [...t].filter((x) => !w.has(x)) };
}
