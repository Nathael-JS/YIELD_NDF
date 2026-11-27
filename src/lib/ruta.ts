// Ruta de un modelo, como el diagrama de ruta del MES: la línea principal de estaciones en orden, la reparación R_ de cada una
// debajo, los retornos de una reparación a otra estación (líneas verdes) y los saltos de la línea (la curva azul).
import type { RouteBand, RouteNode, RouteStop } from '../components/flow.tsx';
import { nivel, urgente } from './wip.ts';

// Se arma con la ruta guardada (o la base de abajo), la estructura de yield y lo que enseña cada WIP (GROUP_NAME → WIP_GROUP).

export interface Ruta {
  model: string;
  /** Línea principal, en orden; `rep`: tiene estación de reparación R_<estación>. */
  estaciones: { station: string; rep: boolean }[];
  /** [reparación, estación]: de esa reparación la pieza puede regresar a esa estación. */
  retornos: [string, string][];
  /** [desde, hasta]: la línea puede saltar de una estación a otra más adelante. */
  saltos: [string, string][];
}

export const esRep = (s: string) => s.startsWith('R_');
/** Estación de la línea a la que pertenece: R_FT y HOLD-FT → FT. */
export const base = (s: string) => s.replace(/^(R_|HOLD-)/, '');

/** Mete `s` en la línea después de `antes` (o al final), sin repetir. */
function meter(r: Ruta, s: string, antes?: string) {
  if (r.estaciones.some((e) => e.station === s)) return;
  const i = antes ? r.estaciones.findIndex((e) => e.station === antes) : -1;
  r.estaciones.splice(i < 0 ? r.estaciones.length : i + 1, 0, { station: s, rep: false });
}
const sumar = (xs: [string, string][], x: [string, string]) => { if (!xs.some(([a, b]) => a === x[0] && b === x[1])) xs.push(x); };

/** La ruta de un modelo: la guardada (o vacía), más las estaciones de la estructura de yield en su orden,
 * más lo que enseñan las piezas del WIP (estación anterior → estación actual). No cambia la guardada. */
export function armarRuta(model: string, guardada: Ruta | undefined, yieldEstaciones: string[], piezas: { model: string; station: string; prev: string }[]) {
  const r: Ruta = guardada
    ? { model, estaciones: guardada.estaciones.map((e) => ({ ...e })), retornos: guardada.retornos.map(([a, b]) => [a, b]), saltos: guardada.saltos.map(([a, b]) => [a, b]) }
    : { model, estaciones: [], retornos: [], saltos: [] };
  yieldEstaciones.forEach((s, i) => meter(r, s, yieldEstaciones[i - 1]));
  const mias = piezas.filter((p) => p.model === model);
  // primero las estaciones nuevas (después de su anterior), luego las líneas: así el orden ya está completo
  for (const p of mias) {
    const s = base(p.station), prev = p.prev && base(p.prev);
    meter(r, s, prev && r.estaciones.some((e) => e.station === prev) ? prev : undefined);
  }
  const at = (s: string) => r.estaciones.findIndex((e) => e.station === s);
  // un hold (HOLD-FT) cuenta como su estación; una reparación se queda como R_
  const norm = (s: string) => (esRep(s) ? s : base(s));
  for (const p of mias) {
    const st = norm(p.station), pv = p.prev && norm(p.prev);
    if (esRep(st)) r.estaciones[at(base(st))].rep = true; // base(st) ya se metió arriba
    if (!pv || pv === st) continue;
    // la estación anterior puede no estar en la ruta (solo se meten las actuales): sin ella no hay línea que dibujar
    if (at(base(pv)) < 0) continue;
    if (esRep(pv) && !esRep(st)) {
      if (base(pv) !== st) sumar(r.retornos, [pv, st]); // de la reparación a otra estación
      r.estaciones[at(base(pv))].rep = true;
    } else if (!esRep(pv) && !esRep(st) && at(st) > at(pv) + 1) sumar(r.saltos, [pv, st]);
  }
  return r;
}

/** Lo que dibuja `RouteMap`: cada estación con sus piezas (los holds HOLD-X cuentan en X) y su reparación,
 * las bandas de etapa y board (`lugar`, la misma ubicación de los filtros) y los retornos y saltos como índices. */
export function mapaDe<P extends { station: string; hours: number }>(r: Ruta, ps: P[], lugar: (station: string) => { stage: string; board: string }) {
  const de = new Map<string, P[]>();
  for (const p of ps) { const k = esRep(p.station) ? p.station : base(p.station); (de.get(k) ?? de.set(k, []).get(k)!).push(p); }
  const parada = (station: string): RouteStop => {
    const xs = de.get(station) ?? [];
    return { station, n: xs.length, tone: xs.length ? nivel(Math.max(...xs.map((p) => p.hours))) : 'idle', urgent: xs.filter((p) => urgente(p.hours)).length };
  };
  const nodes: RouteNode[] = r.estaciones.map((e) => ({ ...parada(e.station), ...(e.rep ? { rep: parada(`R_${e.station}`) } : {}) }));
  const banda = (k: 'stage' | 'board') => r.estaciones.reduce<RouteBand[]>((bs, e, i) => {
    const label = lugar(e.station)[k], ult = bs.at(-1);
    if (ult && ult.label === label) ult.to = i; else bs.push({ label, from: i, to: i });
    return bs;
  }, []);
  const at = (s: string) => r.estaciones.findIndex((e) => e.station === s);
  const dentro = new Set([...r.estaciones.map((e) => e.station), ...r.estaciones.filter((e) => e.rep).map((e) => `R_${e.station}`)]);
  return {
    nodes, bands: [banda('stage'), banda('board')],
    retornos: r.retornos.map(([a, b]) => [at(base(a)), at(b)] as [number, number]),
    saltos: r.saltos.map(([a, b]) => [at(a), at(b)] as [number, number]),
    piezasDe: (station: string) => de.get(station) ?? [],
    /** piezas del modelo en estaciones que la ruta no tiene (no debería pasar: `armarRuta` las aprende) */
    fuera: [...de].filter(([k]) => !dentro.has(k)).reduce((t, [, xs]) => t + xs.length, 0),
  };
}

/** Texto editable de la ruta (Base de datos):
 *   ASSY_SA_SWB R          ← estación; «R» si tiene reparación
 *   R_ASSY_CHASSIS > ASSY_SA_SWB   ← retorno de reparación
 *   FATP_VI > KANBAN_IN    ← salto de la línea */
export function rutaATexto(r: Ruta) {
  return [
    ...r.estaciones.map((e) => `${e.station}${e.rep ? ' R' : ''}`),
    ...r.retornos.map(([a, b]) => `${a} > ${b}`),
    ...r.saltos.map(([a, b]) => `${a} > ${b}`),
  ].join('\n');
}

/** Lee el texto de `rutaATexto`. Las líneas vacías y las que empiezan con # se ignoran. */
export function textoARuta(model: string, texto: string): { ruta: Ruta; error: string } {
  const r: Ruta = { model, estaciones: [], retornos: [], saltos: [] }, errores: string[] = [];
  const ok = (s: string) => /^[A-Za-z0-9_.\-/]{1,80}$/.test(s);
  texto.split(/\r?\n/).forEach((linea, i) => {
    const t = linea.trim();
    if (!t || t.startsWith('#')) return;
    const flecha = t.split(/\s*>\s*/);
    if (flecha.length === 2) {
      const [a, b] = flecha;
      if (!ok(a) || !ok(b) || esRep(b)) return errores.push(`Renglón ${i + 1}: «${t}» (es «A > B» y B no es una reparación)`);
      return sumar(esRep(a) ? r.retornos : r.saltos, [a, b]);
    }
    const m = /^(\S+)(\s+R)?$/i.exec(t);
    if (!m || !ok(m[1]) || esRep(m[1])) return errores.push(`Renglón ${i + 1}: «${t}» (una estación por renglón, con «R» si tiene reparación)`);
    if (r.estaciones.some((e) => e.station === m[1])) return errores.push(`Renglón ${i + 1}: ${m[1]} está repetida`);
    r.estaciones.push({ station: m[1], rep: !!m[2] });
  });
  const en = new Set(r.estaciones.map((e) => e.station));
  for (const [a, b] of [...r.retornos, ...r.saltos]) if (!en.has(base(a)) || !en.has(b)) errores.push(`«${a} > ${b}»: ${!en.has(base(a)) ? base(a) : b} no está en la línea`);
  if (!r.estaciones.length) errores.push('La ruta no tiene estaciones');
  return { ruta: r, error: errores.slice(0, 3).join(' · ') };
}

/** Ruta de SA029400 según el diagrama del MES (27 nov). Vale hasta que un administrador guarde otra en Base de datos. */
export const RUTAS_BASE: Ruta[] = [textoARuta('SA029400', `
ASSY_SA_SWB R
ASSY_SA_MGMT R
SYS_ASSY_AVI R
SYS_ASSY_VI R
J_TAG R
ASSY_CHASSIS R
ASSEMBLY_EJECT R
FRONT_PANEL_VI R
CURING_IN R
CURING_OUT R
WC_PRESSURE R
WC_WATER_FILL R
FT R
FATP_VI R
PRESSURE_TEST R
PUT_STATIC_OUT
PRESSURE_CHECK R
LEAKAGE_CHECK R
RELEASE_PRESSURE
KANBAN_IN R
STOCKIN
R_ASSY_CHASSIS > ASSY_SA_SWB
R_ASSY_CHASSIS > ASSY_SA_MGMT
R_J_TAG > SYS_ASSY_VI
R_FT > J_TAG
R_FT > CURING_IN
R_FATP_VI > FT
R_LEAKAGE_CHECK > PRESSURE_TEST
FATP_VI > KANBAN_IN`).ruta];
