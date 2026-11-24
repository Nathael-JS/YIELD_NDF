// Pallets: listado de entregas (SAP, «download»), shipping report (FINISH GOOD) y las tarimas que arma la app.
// Las tarimas se guardan como una tabla limpia (TARIMAS_COLS): la misma que se exporta a CSV, se edita en Excel
// y se vuelve a cargar.
import type { Cell, ParsedFile } from './files.ts';
import type { PalletLabelData } from '../components/label.tsx';

const text = (v: Cell) => (v instanceof Date ? v.toISOString().slice(0, 10) : v == null ? '' : String(v).replace(/ /g, ' ').trim());
const norm = (h: string) => h.toLowerCase().replace(/\s+/g, ' ').trim();

export interface Entrega { dn: string; so: string; to: string; po: string; model: string; desc: string; qty: number; customer: string; destination: string; loose: string; nw: string; gw: string }
export const DN_REQUIRED = ['DN_NO', 'SO_NUMBER', 'TO_NO', 'MODEL_NAME', 'SHIPPING_QTY', 'CUST_PO'] as const;

/** Listado de entregas: una por DN. Los ceros a la izquierda del T/O (0001687795) se quitan, como en el reporte. */
export function readEntregas(f: ParsedFile) {
  const at = (c: string) => f.headers.findIndex((h) => h.toUpperCase() === c);
  const missing = DN_REQUIRED.filter((c) => at(c) < 0);
  if (missing.length) return { entregas: [] as Entrega[], missing };
  const g = (r: Cell[], c: string) => (at(c) < 0 ? '' : text(r[at(c)]));
  // con varios listados una entrega puede venir repetida: se queda una por DN (la última)
  const porDn = new Map(f.rows.filter((r) => g(r, 'DN_NO')).map((r): [string, Entrega] => [g(r, 'DN_NO'), {
    dn: g(r, 'DN_NO'), so: g(r, 'SO_NUMBER'), to: g(r, 'TO_NO').replace(/^0+/, ''), po: g(r, 'CUST_PO'), model: g(r, 'MODEL_NAME'),
    desc: g(r, 'MODEL_DESC'), qty: Number(g(r, 'SHIPPING_QTY')) || 0, customer: g(r, 'CUST_NAME'),
    destination: [g(r, 'CITY1'), g(r, 'COUNTRY')].filter(Boolean).join(' · '), loose: g(r, 'LOOSE'), nw: g(r, 'UNIT_NW'), gw: g(r, 'UNIT_GW'),
  }]));
  const entregas = [...porDn.values()];
  return { entregas, missing };
}

/** Una tarima: lo que lleva la etiqueta, lo que se exporta y lo que se vuelve a cargar. */
export const TARIMAS_COLS = [
  ['pallet', 'Pallet #'], ['ref', 'Internal Ref'], ['dn', 'DN'], ['nvdn', 'NVIDIA DN'], ['so', 'SO'], ['po', 'PO'], ['to', 'T/O'], ['pn', 'Part number'], ['desc', 'Descripción'],
  ['customer', 'Cliente'], ['destination', 'Destino'], ['qty', 'Piezas'], ['cartons', 'Cajas'], ['nw', 'Peso neto (kg)'], ['gw', 'Peso bruto (kg)'],
  ['dims', 'Medidas (cm)'], ['coo', 'COO'], ['hts', 'HTS'], ['battery', 'Nota de batería'], ['shipDate', 'Fecha de envío'], ['carrier', 'Carrier'],
  ['plates', 'Truck / placas'], ['truckHour', 'Hora de solicitud'], ['incoterm', 'Incoterm'], ['seal', 'Sello Foxconn'], ['dock', 'Dock #'],
  ['serials', 'Seriales'], ['printed', 'Impresa'], ['prueba', 'Prueba'],
] as const;
export type TarimaKey = (typeof TARIMAS_COLS)[number][0];
/** Todo es texto (editable tal cual); `serials` separados por espacio; `printed` = fecha de la última impresión. */
export type Tarima = Record<TarimaKey, string>;
export const vacia = (): Tarima => Object.fromEntries(TARIMAS_COLS.map(([k]) => [k, ''])) as Tarima;
export const serialsOf = (t: Tarima) => t.serials.split(/[\s,;]+/).filter(Boolean);

/** Tarima nueva desde una entrega del listado. */
export const desdeEntrega = (e: Entrega): Tarima => ({
  ...vacia(), so: e.so, // DN y NVIDIA DN se escriben a mano (el del listado se ve como guía)
  to: e.to, po: e.po, pn: e.model, desc: e.desc, customer: e.customer, destination: e.destination,
  qty: String(e.qty), nw: e.nw, gw: e.gw, coo: 'MX', shipDate: new Date().toISOString().slice(0, 10),
});

/** La tabla de tarimas como archivo (encabezados en español): para guardarla en el equipo y para el CSV. */
export const tarimasFile = (ts: Tarima[]): ParsedFile => ({ headers: TARIMAS_COLS.map(([, h]) => h), rows: ts.map((t) => TARIMAS_COLS.map(([k]) => t[k])) });
export function readTarimas(f: ParsedFile) {
  const at = TARIMAS_COLS.map(([, h]) => f.headers.findIndex((x) => norm(x) === norm(h)));
  const missing = TARIMAS_COLS.filter((_, i) => at[i] < 0 && i < 3).map(([, h]) => h); // sin Pallet #, Internal Ref y DN no es este archivo
  if (missing.length) return { tarimas: [] as Tarima[], missing };
  const unwrap = (s: string) => s.replace(/^="(.*)"$/, '$1'); // ="…" que escribe toCsv para que Excel lo deje como texto
  const tarimas = f.rows.map((r) => Object.fromEntries(TARIMAS_COLS.map(([k], i) => [k, at[i] < 0 ? '' : unwrap(text(r[at[i]]))])) as Tarima).filter((t) => t.pallet || t.dn);
  return { tarimas, missing };
}
/** CSV con BOM (Excel lo abre con acentos) y comillas donde hace falta. */
export const toCsv = (f: ParsedFile) => '﻿' + [f.headers, ...f.rows].map((r) => r.map((v) => {
  const s = text(v);
  if (/^\d{12,}$/.test(s)) return `="${s}"`; // Excel convertiría 62061000920002 en 6.20610E+13 y así lo guardaría
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}).join(',')).join('\r\n');

/** Shipping report (FINISH GOOD): renglón 1 = área (SHIPPING, ITC, FULLFILMENT; celdas combinadas), renglón 2 = campo.
 * Devuelve las tarimas ya embarcadas (para no repetir un Pallet # y poder reimprimir) y los valores de cada número de parte. */
export function readShipping(f: ParsedFile) {
  // parseFile toma el renglón 1 (las áreas) como encabezado: el de los campos es la primera fila
  const conAreas = !f.headers.some((h) => norm(h) === 'internal ref');
  const head = (conAreas ? f.rows[0] ?? [] : f.headers).map((h) => norm(text(h)));
  const rows = conAreas ? f.rows.slice(1) : f.rows;
  const col = (name: string) => head.indexOf(norm(name));
  const missing = ['Internal Ref', 'Pallet #', 'Serial#'].filter((c) => col(c) < 0);
  const out = { tarimas: [] as Tarima[], missing, sinPallet: 0 };
  if (missing.length) return out;
  const g = (r: Cell[], name: string) => (col(name) < 0 ? '' : text(r[col(name)]));
  let ref = '';
  for (const r of rows) {
    if (r.some((v) => text(v) === 'FIN')) break; // fin de la bitácora
    ref = g(r, 'Internal Ref') || ref; // las filas que siguen sin Internal Ref son del mismo embarque
    const pallet = g(r, 'Pallet #');
    if (!pallet) { if (g(r, 'Serial#')) out.sinPallet++; continue; }
    out.tarimas.push({
      ...vacia(), pallet, ref, dn: g(r, 'FXNN DN'), nvdn: g(r, 'NVIDIA DN'), so: g(r, 'FXNN SO'), po: g(r, 'NVIDIA PO') || g(r, 'FXNN PO'), to: g(r, 'T/O'), pn: g(r, 'Part Number FXNN'),
      qty: g(r, 'Quantity (PCS)'), cartons: g(r, 'Carton quantity'), nw: g(r, 'Net weight ( kg )'), gw: g(r, 'Gross weight ( kg)'),
      dims: [g(r, 'LENGTH'), g(r, 'WIDTH'), g(r, 'HEIGHT')].filter(Boolean).join(' x '), coo: g(r, 'COO'), hts: g(r, 'HTS CODE'),
      battery: g(r, 'Remark for Battery').replace(/\s*\n\s*/g, ' · '), shipDate: g(r, 'Shipped date'), carrier: g(r, 'Carrier'), plates: g(r, 'Truck # / Plates'),
      incoterm: g(r, 'Incoterm'), seal: g(r, 'Foxconn Seal (Plastic / Metal)'), dock: g(r, 'Dock #'), serials: g(r, 'Serial#').split(/\s+/).filter(Boolean).join(' '),
    });
  }
  return out;
}

/** Lo que un número de parte ya usó en el reporte (HTS, COO, batería, medidas…): para llenar una tarima nueva. */
export function defaultsFor(pn: string, hist: Tarima[]): Partial<Tarima> {
  const t = [...hist].reverse().find((x) => x.pn === pn);
  return t ? { hts: t.hts, coo: t.coo, battery: t.battery, dims: t.dims, incoterm: t.incoterm, carrier: t.carrier } : {};
}

const REQ: [TarimaKey, string][] = [['pallet', 'Pallet #'], ['ref', 'Internal Ref'], ['dn', 'DN'], ['nvdn', 'NVIDIA DN'], ['pn', 'Part number'], ['qty', 'Piezas'], ['cartons', 'Cajas'], ['nw', 'Peso neto'], ['gw', 'Peso bruto'], ['dims', 'Medidas'], ['hts', 'HTS'], ['coo', 'COO'], ['shipDate', 'Fecha de envío']];

/** Qué le falta a una tarima para imprimirse. `usados`: Pallet # de otras tarimas (las del equipo y las del reporte).
 * `wip`: serial → estación en el WIP cargado (aviso, no bloquea). */
export function revisar(t: Tarima, usados: Set<string>, wip?: Map<string, string>) {
  const s = serialsOf(t), qty = Number(t.qty) || 0;
  const faltan = REQ.filter(([k]) => !t[k].trim()).map(([, l]) => l);
  const pesoMal = Number(t.gw) > 0 && Number(t.nw) > Number(t.gw);
  const formato = !!t.pallet && !/^PAL[A-Z]{0,4}\d{3,}$/i.test(t.pallet.trim());
  const repetido = usados.has(t.pallet.trim().toUpperCase());
  const fueraWip = wip ? s.filter((x) => !wip.has(x)) : [];
  // terminadas (STOCKIN) o ya en empaque (FG, PACK_CTN, PACK_PALT): es lo esperado al armar una tarima
  const sinStock = wip ? s.filter((x) => wip.has(x) && !/STOCKIN|SHIP|^FG$|^PACK_(CTN|PALT)$/.test(wip.get(x)!)) : [];
  const listo = !faltan.length && !pesoMal && !formato && !repetido && s.length === qty && qty > 0;
  return { faltan, pesoMal, formato, repetido, seriales: s.length, qty, fueraWip, sinStock, listo };
}

/** Texto del QR: una línea por dato y los seriales al final. Solo ASCII (el lector de cualquier escáner lo entiende). */
export const qrText = (t: Tarima) => ([
  ['PALLET', t.pallet], ['REF', t.ref], ['DN', t.dn], ['NVDN', t.nvdn], ['SO', t.so], ['PO', t.po], ['TO', t.to], ['PN', t.pn], ['QTY', t.qty], ['CTN', t.cartons],
  ['NW', t.nw], ['GW', t.gw], ['DIM', t.dims], ['COO', t.coo], ['HTS', t.hts], ['DATE', t.shipDate], ['TEST', t.prueba ? '1' : ''], ['SN', serialsOf(t).join(',')],
] as const).filter(([, v]) => v).map(([k, v]) => `${k}:${v}`).join('\n').normalize('NFD').replace(/[^\x20-\x7e\n]/g, '');

/** Datos de la etiqueta de una tarima. */
export const labelOf = (t: Tarima, index = 1, total = 1): PalletLabelData => ({
  pallet: t.pallet || 'PAL—', customer: t.customer || '—', destination: t.destination || '—', ref: t.ref || '—', dn: t.dn, nvdn: t.nvdn, so: t.so, po: t.po, to: t.to, pn: t.pn, desc: t.desc,
  qty: Number(t.qty) || 0, cartons: Number(t.cartons) || 0, nw: t.nw || '—', gw: t.gw || '—', dims: t.dims, coo: t.coo, hts: t.hts, battery: t.battery, shipDate: t.shipDate, index, total, test: !!t.prueba,
});

const QR_KEYS: Record<string, TarimaKey> = { PALLET: 'pallet', REF: 'ref', DN: 'dn', NVDN: 'nvdn', SO: 'so', PO: 'po', TO: 'to', PN: 'pn', QTY: 'qty', CTN: 'cartons', NW: 'nw', GW: 'gw', DIM: 'dims', COO: 'coo', HTS: 'hts', DATE: 'shipDate' };
/** Tarima desde el texto de un QR de etiqueta (lo inverso de qrText); `null` si no es un QR de tarima. */
export function fromQr(text: string): Tarima | null {
  const t = vacia();
  for (const line of text.split(/\r?\n/)) {
    const i = line.indexOf(':'), k = line.slice(0, i), v = line.slice(i + 1).trim();
    if (k === 'SN') t.serials = v.split(',').filter(Boolean).join(' ');
    else if (k === 'TEST') t.prueba = v === '1' ? 'sí' : '';
    else if (QR_KEYS[k]) t[QR_KEYS[k]] = v;
  }
  return t.pallet ? t : null;
}
