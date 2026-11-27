// WIP (Work in Process): reporte del MES con una fila por pieza y la estación donde está ahora.
// No se estima con el TCQS (no registra la entrada a almacén): se cuenta del archivo y se cruza con el TCQS
// por orden y estación (FPY de la estación junto a las piezas que esperan en ella).
import type { Cell, ParsedFile } from './files.ts';
import type { FlowStage } from '../components/flow.tsx';
import { by, META_FPY, periodOf, text, type Rec } from './tcqs.ts';

export const WIP_REQUIRED = ['SERIAL_NUMBER', 'MODEL_NAME', 'MO_NUMBER', 'SECTION_NAME', 'WIP_GROUP', 'IN_STATION_TIME', 'ERROR_FLAG'] as const;
/** Opcionales. HOUR: horas en la estación (reporte general); sin ella (reporte por orden) se cuentan hasta la hora de carga.
 * GROUP_NAME: última estación que pasó (de ahí sale el orden de la ruta). LINE_NAME: línea. */
const OPCIONALES = ['HOUR', 'GROUP_NAME', 'LINE_NAME'] as const;

/** Línea: en proceso · Hold: retenida · Reparación: R_… o REPAIR · Bonpile: B28M/B30M/B31M (pila de falladas). */
export type Estado = 'Línea' | 'Hold' | 'Reparación' | 'Bonpile';
export interface Pieza {
  serial: string; model: string; mo: string; section: string; station: string;
  /** Estación que acaba de pasar (GROUP_NAME; vacío si el reporte no la trae) y línea. */
  prev: string; line: string;
  /** Llegada a la estación actual, «2026-11-19 08:14:59». */
  at: string; hours: number; blocked: boolean; estado: Estado;
}

/** Empaque: es WIP, pero no se muestra (así se acordó con planta). */
const OCULTAS = new Set(['FG', 'PACK_CTN', 'PACK_PALT']);
/** Orden del flujo por sección; las que no estén van al final. */
export const SECCIONES = ['INPUT', 'SMT', 'PTH', 'ICT', 'TEST', 'ASSY_2', 'SI'];

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

/** Hora local de la PC como «2026-11-23 10:15:00» (misma forma que las horas del MES).
 * shortcut: supone que la PC está en la zona horaria de planta; si se usa desde otra zona, agregar la zona de planta como ajuste. */
export const local = (d = new Date()) => stamp(new Date(d.getTime() - d.getTimezoneOffset() * 6e4));

/** Piezas en proceso (sin terminadas ni empaque), sin filas repetidas, y la hora del corte.
 * Con HOUR: corte = llegada + horas en la estación. Sin HOUR: corte = `cargado` (hora en que se cargó el archivo) o,
 * si no se sabe, el último movimiento; las horas se cuentan hasta el corte. `ultimo` = el movimiento más reciente. */
export function readWip(f: ParsedFile, cargado?: string) {
  const at = Object.fromEntries([...WIP_REQUIRED, ...OPCIONALES].map((c) => [c, f.headers.findIndex((h) => h.toUpperCase() === c)])) as Record<(typeof WIP_REQUIRED)[number] | (typeof OPCIONALES)[number], number>;
  const missing = WIP_REQUIRED.filter((c) => at[c] < 0);
  const conHoras = at.HOUR >= 0;
  const out = {
    piezas: [] as Pieza[], missing, bad: [] as number[], corte: '', ultimo: '', terminadas: [] as Pieza[], ocultas: [] as Pieza[], // aparte, para contarlas con los mismos filtros
    filas: f.rows.length, repetidas: 0, formato: conHoras ? 'general' as const : 'por orden' as const,
    fuente: conHoras ? 'archivo' as const : cargado ? 'carga' as const : 'movimiento' as const,
  };
  if (missing.length) return out;
  // el reporte del MES repite filas idénticas: una pieza por serial (la llegada más reciente)
  const seen = new Map<string, Pieza>();
  let corte = 0;
  f.rows.forEach((r, i) => {
    // sin HOUR en la fila (reporte por orden, o mezclado con uno general): se cuenta después hasta el corte
    const h = conHoras ? text(r[at.HOUR]) : '';
    const p: Pieza = {
      serial: text(r[at.SERIAL_NUMBER]), model: text(r[at.MODEL_NAME]), mo: text(r[at.MO_NUMBER]),
      section: text(r[at.SECTION_NAME]), station: text(r[at.WIP_GROUP]), at: when(r[at.IN_STATION_TIME]),
      hours: h ? Number(h.replace(',', '.')) : -1, // CSV en español: «20,5»; -1 = falta
      prev: at.GROUP_NAME >= 0 ? text(r[at.GROUP_NAME]) : '', line: at.LINE_NAME >= 0 ? text(r[at.LINE_NAME]) : '',
      blocked: !['', '0'].includes(text(r[at.ERROR_FLAG])), estado: 'Línea',
    };
    if (!p.serial || !p.station || !p.at || !Number.isFinite(p.hours)) { out.bad.push(i + 2); return; }
    if (p.hours >= 0) corte = Math.max(corte, ms(p.at) + p.hours * 36e5);
    if (p.at > out.ultimo) out.ultimo = p.at;
    const old = seen.get(p.serial);
    if (old) out.repetidas++;
    if (!old || old.at < p.at) seen.set(p.serial, { ...p, estado: estadoOf(p.station) });
  });
  // filas sin horas: hasta el corte del reporte general si lo hay; si no, hasta la carga (nunca antes del último movimiento)
  if (!corte) corte = ms(cargado && cargado > out.ultimo ? cargado : out.ultimo);
  for (const p of seen.values()) if (p.hours < 0) p.hours = Math.max(0, (corte - ms(p.at)) / 36e5);
  for (const p of seen.values()) {
    if (/STOCKIN|SHIP/.test(p.station)) out.terminadas.push(p);
    else if (OCULTAS.has(p.station)) out.ocultas.push(p);
    else out.piezas.push(p);
  }
  out.corte = corte ? stamp(new Date(Math.round(corte / 6e4) * 6e4)) : '';
  return out;
}

/** Lugar de cada estación en la ruta, con lo que el reporte dice que pasó antes (GROUP_NAME → WIP_GROUP): 0 = sin antecesor conocido. */
export function ranks(ps: Pieza[]) {
  const next = new Map<string, Set<string>>();
  for (const p of ps) if (p.prev && p.prev !== p.station) (next.get(p.prev) ?? next.set(p.prev, new Set()).get(p.prev)!).add(p.station);
  const r = new Map<string, number>();
  // camino más largo; con tope para que un retrabajo (ruta que regresa) no gire sin fin
  for (let k = 0, changed = true; changed && k <= next.size; k++) {
    changed = false;
    for (const [a, bs] of next) for (const b of bs) {
      const v = (r.get(a) ?? 0) + 1;
      if (v > (r.get(b) ?? 0) && v <= next.size) { r.set(b, v); changed = true; }
    }
  }
  return r;
}

/** Ruta de cada estación: las estaciones unidas por GROUP_NAME → WIP_GROUP forman una; se numeran de la más corta a la más larga
 * (las cortas suelen ser subensambles que alimentan a la línea principal). Sin GROUP_NAME todas quedan en la 0. */
export function rutas(ps: Pieza[], rank = ranks(ps)) {
  const up = new Map<string, string>(), find = (a: string): string => (up.get(a) ?? a) === a ? a : find(up.get(a)!);
  for (const p of ps) if (p.prev && p.prev !== p.station) up.set(find(p.prev), find(p.station));
  if (!up.size) return () => 0; // reporte general: sin ruta, se ordena por piezas
  const len = new Map<string, number>();
  for (const s of new Set(ps.flatMap((p) => [p.station, p.prev]).filter(Boolean))) len.set(find(s), Math.max(len.get(find(s)) ?? 0, rank.get(s) ?? 0));
  const order = [...len].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0])).map(([root]) => root);
  return (s: string) => order.indexOf(find(s));
}

/** Por orden: piezas en proceso por estado, terminadas y empaque, y la más antigua. */
export function ordenes(ps: Pieza[], terminadas: Pieza[], ocultas: Pieza[]) {
  const m = new Map<string, { mo: string; model: string; n: number; linea: number; hold: number; rep: number; blocked: number; urgent: number; terminadas: number; ocultas: number; max: number }>();
  const get = (p: Pieza) => m.get(p.mo) ?? m.set(p.mo, { mo: p.mo, model: p.model, n: 0, linea: 0, hold: 0, rep: 0, blocked: 0, urgent: 0, terminadas: 0, ocultas: 0, max: 0 }).get(p.mo)!;
  for (const p of ps) {
    const o = get(p);
    o.n++; o.max = Math.max(o.max, p.hours);
    if (p.estado === 'Línea') o.linea++; else if (p.estado === 'Hold') o.hold++; else o.rep++;
    if (p.blocked) o.blocked++;
    if (urgente(p.hours)) o.urgent++;
  }
  for (const p of terminadas) get(p).terminadas++;
  for (const p of ocultas) get(p).ocultas++;
  return [...m.values()].sort((a, b) => b.n - a.n || a.mo.localeCompare(b.mo));
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
  const rank = ranks(ps), rk = (s: string) => rank.get(s) ?? 0, ruta = rutas(ps, rank);
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
  }).sort((a, b) => sec(a.section) - sec(b.section) || a.section.localeCompare(b.section) || ruta(a.name) - ruta(b.name) || rk(a.name) - rk(b.name) || b.n - a.n); // secciones nuevas juntas; dentro, ruta por ruta y en su orden
}

/** Órdenes que no cruzan: con piezas en el WIP y sin TCQS, y del TCQS sin piezas en proceso. */
export function cruce(ps: Pieza[], recs: Rec[]) {
  const w = new Set(ps.map((p) => p.mo)), t = new Set(recs.flatMap((r) => r.mo.split(',')).filter(Boolean));
  return { soloWip: [...w].filter((x) => !t.has(x)), soloTcqs: [...t].filter((x) => !w.has(x)) };
}

/** Resumen de un corte para el historial: por estación × modelo, piezas en proceso, bloqueadas y horas (promedio y máxima). Sin seriales. */
export function resumenWip(r: Pick<ReturnType<typeof readWip>, 'piezas'>) {
  const m = new Map<string, { estacion: string; modelo: string; piezas: number; bloqueadas: number; horas: number; max: number }>();
  for (const p of r.piezas) {
    const k = `${p.station}\u0000${p.model}`, x = m.get(k) ?? m.set(k, { estacion: p.station, modelo: p.model, piezas: 0, bloqueadas: 0, horas: 0, max: 0 }).get(k)!;
    x.piezas++; x.bloqueadas += p.blocked ? 1 : 0; x.horas += p.hours; x.max = Math.max(x.max, p.hours);
  }
  return [...m.values()].map((x) => ({ ...x, horas: Math.round((x.horas / x.piezas) * 10) / 10, max: Math.round(x.max * 10) / 10 }))
    .sort((a, b) => b.piezas - a.piezas || a.estacion.localeCompare(b.estacion));
}

/** Estructura de flujo (del reporte de yield de producción): Process Stage → Board → Model → Station, en el orden de la ruta. */
export interface Paso { stage: string; board: string; model: string; station: string }

/** Lee solo esas cuatro columnas. El encabezado puede no estar en el primer renglón; una celda vacía hereda la de arriba (celdas combinadas del Excel). */
export function readFlujo(f: ParsedFile) {
  const tabla = [f.headers, ...f.rows.map((r) => r.map((c) => text(c)))], norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  const h = tabla.findIndex((r) => r.some((c) => /^proces+ stage$/.test(norm(String(c)))));
  if (h < 0) return { pasos: [] as Paso[], error: 'No se encontró el encabezado «Process Stage» (con Board Name, Model y Station).' };
  const at = (re: RegExp) => tabla[h].findIndex((c) => re.test(norm(String(c))));
  const col = { stage: at(/^proces+ stage$/), board: at(/^board( name)?$/), model: at(/^model$/), station: at(/^station$/) };
  const falta = Object.entries(col).filter(([, i]) => i < 0).map(([k]) => k);
  if (falta.length) return { pasos: [] as Paso[], error: `Faltan las columnas: ${falta.join(', ')}.` };
  const pasos: Paso[] = [], ult = { stage: '', board: '', model: '' };
  for (const r of tabla.slice(h + 1)) {
    const v = (i: number) => String(r[i] ?? '').trim();
    if (v(col.stage)) { ult.stage = v(col.stage); ult.board = ''; ult.model = ''; }
    if (v(col.board)) { ult.board = v(col.board); ult.model = ''; }
    if (v(col.model)) ult.model = v(col.model);
    if (v(col.station) && ult.stage) pasos.push({ ...ult, station: v(col.station) });
  }
  return { pasos, error: pasos.length ? '' : 'El archivo no trae estaciones.' };
}

/** Ubica una estación del WIP en la estructura: por modelo + estación; si el modelo no está, por la estación sola (la primera). */
export const ubicar = (pasos: Paso[], model: string, station: string) =>
  pasos.find((p) => p.model === model && p.station === station) ?? pasos.find((p) => p.station === station);

/** Turno de un corte («2026-11-27 10:15»): T1 07:00–15:00 · T2 15:00–22:30 · pendiente de 22:30 a 07:00 (aún sin definir). */
export type Turno = 'T1' | 'T2' | 'pendiente';
export function turno(corte: string): Turno {
  const m = +corte.slice(11, 13) * 60 + +corte.slice(14, 16);
  return m >= 7 * 60 && m < 15 * 60 ? 'T1' : m >= 15 * 60 && m < 22 * 60 + 30 ? 'T2' : 'pendiente';
}
/** Semana ISO del corte: [«2026-W48», «Sem 48»]. */
export const semana = (corte: string) => periodOf(corte.slice(0, 10), 'semana');

/** Pieza en proceso tal como se guarda en el corte (para la ventana de seriales y los gráficos sin el archivo). */
export const detalleWip = (ps: Pieza[]) => ps.map((p) => ({ serial: p.serial, model: p.model, mo: p.mo, station: p.station, prev: p.prev, at: p.at, hours: Math.round(p.hours * 10) / 10, blocked: p.blocked }));

/** Flujo del Dashboard: las piezas en su etapa → board → estación (con la estructura de flujo), en el orden de la ruta.
 * Tono de cada estación = el de su pieza más vieja. Ver dentro cómo se ubican reparaciones, holds y estaciones fuera del reporte. */
export function flujoDe<P extends { model: string; station: string; hours: number }>(pasos: Paso[], ps: P[]) {
  const porClave = new Map<string, P[]>(), clave = (a: string, b: string, c: string) => `${a}\u0000${b}\u0000${c}`;
  const extra: Paso[] = [];
  for (const p of ps) {
    // reparación y hold (R_ICT, HOLD-FT) van junto a su estación; una estación que el reporte de yield no trae (LINK_CARRIER_B, KANBAN_IN…)
    // va a la etapa y board de su modelo, después de la ruta; si tampoco está el modelo, a «Sin etapa»
    const u = ubicar(pasos, p.model, p.station.replace(/^(R_|HOLD-)/, '')) ?? pasos.find((x) => x.model === p.model);
    const lugar = u ? { stage: u.stage, board: u.board, model: '', station: p.station } : { stage: 'Sin etapa', board: '', model: '', station: p.station };
    if (!pasos.some((x) => x.stage === lugar.stage && x.board === lugar.board && x.station === lugar.station)
      && !extra.some((x) => x.stage === lugar.stage && x.board === lugar.board && x.station === lugar.station)) extra.push(lugar);
    const k = clave(lugar.stage, lugar.board, lugar.station);
    (porClave.get(k) ?? porClave.set(k, []).get(k)!).push(p);
  }
  const sin = extra.filter((x) => x.stage === 'Sin etapa'), dentro = extra.filter((x) => x.stage !== 'Sin etapa');
  const stages: FlowStage[] = [];
  for (const x of [...pasos, ...dentro, ...sin]) {
    const s = stages.find((y) => y.stage === x.stage) ?? (stages.push({ stage: x.stage, boards: [] }), stages[stages.length - 1]);
    const b = s.boards.find((y) => y.board === x.board) ?? (s.boards.push({ board: x.board, stations: [] }), s.boards[s.boards.length - 1]);
    if (b.stations.some((y) => y.station === x.station)) continue;
    const mias = porClave.get(clave(x.stage, x.board, x.station)) ?? [], max = Math.max(0, ...mias.map((p) => p.hours));
    b.stations.push({ station: x.station, n: mias.length, tone: mias.length ? nivel(max) : 'idle', urgent: mias.filter((p) => urgente(p.hours)).length });
  }
  return { stages, piezasDe: (stage: string, board: string, station: string) => porClave.get(clave(stage, board, station)) ?? [] };
}

/** Dimensiones de los gráficos del Dashboard. */
export type Dim = 'station' | 'model' | 'mo' | 'prev' | 'tiempo' | 'serial';
export const RANGOS: [string, number][] = [['< 2 h', 2], ['2–8 h', 8], ['8–20 h', 20], ['20–48 h', 48], ['2–4 d', 96], ['4–7 d', 168], ['1–2 sem', 336], ['> 2 sem', Infinity]];
/** Grupos para un gráfico: por estación, modelo, orden o última estación (de mayor a menor), por rango de tiempo (en orden)
 * o una pieza por grupo, de la más vieja a la más nueva (serial). `value` = piezas, salvo en serial (horas). */
export function agrupar<P extends { serial: string; model: string; mo: string; station: string; prev: string; hours: number }>(ps: P[], dim: Dim) {
  if (dim === 'serial') return [...ps].sort((a, b) => b.hours - a.hours).map((p) => ({ label: p.serial, value: Math.round(p.hours * 10) / 10, ps: [p] }));
  if (dim === 'tiempo') return RANGOS.map(([label, max], i) => {
    const xs = ps.filter((p) => p.hours < max && p.hours >= (i ? RANGOS[i - 1][1] : 0));
    return { label, value: xs.length, ps: xs };
  });
  const m = new Map<string, P[]>();
  for (const p of ps) { const k = p[dim] || '(sin dato)'; (m.get(k) ?? m.set(k, []).get(k)!).push(p); }
  return [...m].map(([label, xs]) => ({ label, value: xs.length, ps: xs })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

/** Histórico: un punto por turno (día + T1/T2) o por semana, con el último corte de cada uno (cómo cerró). Los cortes vienen de más nuevo a más viejo. */
export function tendencia<C extends { corte: string; piezas: number; bloqueadas: number }>(cortes: C[], por: 'turno' | 'semana', solo?: 'T1' | 'T2') {
  const m = new Map<string, { label: string; c: C }>();
  for (const c of [...cortes].sort((a, b) => a.corte.localeCompare(b.corte))) {
    const t = turno(c.corte);
    if (por === 'turno' && (t === 'pendiente' || (solo && t !== solo))) continue; // 22:30–07:00 aún sin definir
    const [k, label] = por === 'semana' ? semana(c.corte) : [`${c.corte.slice(0, 10)} ${t}`, `${+c.corte.slice(8, 10)}/${+c.corte.slice(5, 7)} ${t}`];
    m.set(k, { label, c }); // el último del grupo gana
  }
  return [...m.values()];
}

/** Comparativa de dos cortes: piezas y bloqueadas por estación (sumando modelos), y el cambio; de mayor a menor cambio. */
export function cambioPorEstacion(antes: { estacion: string; piezas: number; bloqueadas: number }[], despues: typeof antes) {
  const m = new Map<string, { estacion: string; antes: number; despues: number; bloqAntes: number; bloqDespues: number }>();
  const add = (r: (typeof antes)[number], cual: 'antes' | 'despues') => {
    const x = m.get(r.estacion) ?? m.set(r.estacion, { estacion: r.estacion, antes: 0, despues: 0, bloqAntes: 0, bloqDespues: 0 }).get(r.estacion)!;
    x[cual] += r.piezas; if (cual === 'antes') x.bloqAntes += r.bloqueadas; else x.bloqDespues += r.bloqueadas;
  };
  antes.forEach((r) => add(r, 'antes')); despues.forEach((r) => add(r, 'despues'));
  return [...m.values()].map((x) => ({ ...x, cambio: x.despues - x.antes })).sort((a, b) => Math.abs(b.cambio) - Math.abs(a.cambio) || a.estacion.localeCompare(b.estacion));
}
