// Pallets: el export de SFC (una fila por serial) crea un item por DN. Ver PALLETS.md.
import type { Cell, ParsedFile } from './files.ts';
import type { PalletLabelData } from '../components/label.tsx';

/** Piezas por pallet (un bloque de la hoja de piso). Una DN de 154 = 17 pallets de 9 + 1 de 1. */
export const POR_PALLET = 9;
export const SFC_REQUIRED = ['DN', 'SERIAL_NUMBER1', 'MCARTON_NO', 'IMEI'] as const;

/** Una pieza: serial (`SERIAL_NUMBER1`, MT…), SN (`SERIAL_NUMBER`, el del MES: se cruza con el WIP), carton (`MCARTON_NO`),
 * Pallet ID (`IMEI`) y estado en SFC (`WIP_GROUP`; el estado en línea sale del WIP, en Conexión con WIP). `manual`: agregada o corregida en la app. */
export interface Pieza { serial: string; sn: string; carton: string; pallet: string; estado: string; manual?: boolean }

/** Campos que se escriben a mano (los de «plantilla» se copian del último item con el mismo PN del SFC). */
export const MANUAL = [['so', 'Sales Order'], ['pnNvidia', 'Part number NVIDIA'], ['shipped', 'Shipped day'], ['custPo', 'Customer PO'], ['custDn', 'Customer DN']] as const;
export const PLANTILLA = [['project', 'Project'], ['model', 'Model'], ['hazmat', 'Hazmat'], ['coo', 'COO'], ['price', 'Unit price USD']] as const;
type Manual = Record<(typeof MANUAL)[number][0] | (typeof PLANTILLA)[number][0], string>;

/** Un bloque de la Tabla de Pallets: un pallet en piso con sus renglones (serial + carton escaneados). */
export interface Bloque { pallet: string; filas: { serial: string; carton: string }[] }

export interface Item extends Manual {
  dn: string; po: string; to: string; pnSfc: string; piezas: Pieza[];
  archivo: string; usuario: string; creado: string; editado?: string;
  /** Quién lo editó al último, según la base (solo lectura). */
  edito?: string;
  /** Pallets liberados: pueden ir con menos de 9 (p. ej. el último de la DN). */
  liberados?: string[];
  /** Tabla de Pallets (piso): lo escaneado en cada pallet; se compara con las piezas (sistema). */
  piso?: Bloque[];
}

const text = (v: Cell) => (v instanceof Date ? v.toISOString().slice(0, 10) : v == null ? '' : String(v).trim());
const vacio = (s: string) => (/^(n\/?a|-)?$/i.test(s) ? '' : s); // SFC escribe «N/A» si aún no hay tarima

/** Un item por DN. Un serial repetido cuenta una sola vez. */
export function readSfc(f: ParsedFile) {
  const at = (c: string) => f.headers.findIndex((h) => h.trim().toUpperCase() === c);
  const missing = SFC_REQUIRED.filter((c) => at(c) < 0);
  const porDn = new Map<string, Pick<Item, 'dn' | 'po' | 'to' | 'pnSfc' | 'piezas'>>();
  if (missing.length) return { items: [], missing, repetidos: 0 };
  const g = (r: Cell[], c: string) => (at(c) < 0 ? '' : text(r[at(c)]));
  const vistos = new Set<string>();
  let repetidos = 0;
  for (const r of f.rows) {
    const dn = g(r, 'DN'), serial = g(r, 'SERIAL_NUMBER1');
    if (!dn || !serial) continue;
    if (vistos.has(serial)) { repetidos++; continue; }
    vistos.add(serial);
    const it = porDn.get(dn) ?? porDn.set(dn, { dn, po: g(r, 'CUST_PO'), to: g(r, 'TO_NO').replace(/^0+/, ''), pnSfc: g(r, 'MODEL_NAME1'), piezas: [] }).get(dn)!;
    it.piezas.push({ serial, sn: g(r, 'SERIAL_NUMBER'), carton: vacio(g(r, 'MCARTON_NO')), pallet: vacio(g(r, 'IMEI')), estado: g(r, 'WIP_GROUP') });
  }
  return { items: [...porDn.values()], missing, repetidos };
}

/** Pieza lista: con serial, carton y Pallet ID. */
export const lista = (p: Pieza) => !!(p.serial && p.carton && p.pallet);
export const completas = (it: Pick<Item, 'piezas'>) => it.piezas.filter(lista).length;
/** Grupos de un DN: uno por Pallet ID, en el orden del SFC; las piezas sin Pallet ID van al final (pallet ''). */
export function grupos(it: Pick<Item, 'piezas'>) {
  const m = new Map<string, Pieza[]>();
  for (const p of it.piezas) (m.get(p.pallet) ?? m.set(p.pallet, []).get(p.pallet)!).push(p);
  const gs = [...m].map(([pallet, piezas]) => ({ pallet, piezas }));
  return [...gs.filter((g) => g.pallet), ...gs.filter((g) => !g.pallet)];
}
/** Qué le falta a un pallet para estar completo: 9 seriales con 9 cartons distintos ('' = completo). */
export function problema(g: { pallet: string; piezas: Pieza[] }, liberados: string[] = []) {
  const n = g.piezas.length, cartons = new Set(g.piezas.map((p) => p.carton).filter(Boolean)).size;
  if (!g.pallet) return 'sin Pallet ID';
  if (n > POR_PALLET) return `${n - POR_PALLET} de más`;
  if (n < POR_PALLET && !liberados.includes(g.pallet)) return `faltan ${POR_PALLET - n}`;
  if (cartons < n) return g.piezas.some((p) => !p.carton) ? 'sin carton' : 'carton repetido';
  return '';
}
/** Pallets por completar. */
export const pendientes = (it: Pick<Item, 'piezas' | 'liberados'>) => grupos(it).filter((g) => problema(g, it.liberados));
/** Todos sus pallets tienen 9 seriales y 9 cartons: se puede ver su etiqueta. */
export const conEtiqueta = (it: Pick<Item, 'piezas' | 'liberados'>) => it.piezas.length > 0 && !pendientes(it).length;
export const ocho = /^\d{8}$/;
/** Lo que le falta a un item para estar listo (vacío = listo). */
export function faltan(it: Item) {
  const out: string[] = [];
  if (!it.piezas.length) out.push('Sin piezas');
  for (const g of pendientes(it)) out.push(g.pallet ? `${g.pallet}: ${problema(g, it.liberados)}` : `${g.piezas.length} ${g.piezas.length === 1 ? 'pieza' : 'piezas'} sin Pallet ID`);
  for (const [k, label] of MANUAL) if (!it[k].trim()) out.push(label);
  for (const k of ['custPo', 'custDn'] as const) if (it[k].trim() && !ocho.test(it[k].trim())) out.push(`${k === 'custPo' ? 'Customer PO' : 'Customer DN'}: 8 dígitos`);
  return out;
}

/** Datos fijos del modelo: del último item con el mismo PN del SFC, o los de siempre. */
export function plantilla(pnSfc: string, items: Item[]): Pick<Item, (typeof PLANTILLA)[number][0] | 'pnNvidia'> {
  const prev = items.find((x) => x.pnSfc === pnSfc);
  return { project: prev?.project ?? 'NVIDIA', model: prev?.model ?? '', hazmat: prev?.hazmat ?? '', coo: prev?.coo ?? 'MX', price: prev?.price ?? '', pnNvidia: prev?.pnNvidia ?? '' };
}

/** Agrega o corrige una pieza con el escáner: un serial que ya está toma el carton y el Pallet ID nuevos (los vacíos no borran); si no, entra como pieza nueva. */
export function escanear(piezas: Pieza[], serial: string, carton: string, pallet = ''): Pieza[] {
  const s = serial.trim().toUpperCase(), c = vacio(carton.trim().toUpperCase()), pl = vacio(pallet.trim().toUpperCase()); // «N/A» = vacío, como en el SFC
  if (!s) return piezas;
  const i = piezas.findIndex((p) => p.serial.toUpperCase() === s);
  if (i < 0) return [...piezas, { serial: s, sn: '', carton: c, pallet: pl, estado: '', manual: true }];
  return piezas.map((p, j) => (j === i ? { ...p, carton: c || p.carton, pallet: pl || p.pallet, manual: true } : p));
}

/** Solo ASCII en el QR (cualquier lector lo lee igual). */
const ascii = (s: string) => s.normalize('NFD').replace(/[^\x20-\x7e]/g, '').trim();

/** Una etiqueta por Pallet ID del DN, en el orden en que aparecen; el QR lleva sus datos y sus seriales. Sin precios. */
export function etiquetas(it: Item): { d: PalletLabelData; qr: string }[] {
  const gs = grupos(it).filter((g) => g.pallet);
  return gs.map(({ pallet, piezas: ps }, i) => {
    const cartons = [...new Set(ps.map((p) => p.carton).filter(Boolean))];
    const d: PalletLabelData = { pallet, project: it.project, model: it.model, dn: it.dn, po: it.po, so: it.so, custPo: it.custPo, custDn: it.custDn,
      pn: it.pnNvidia, pnSfc: it.pnSfc, qty: ps.length, cartons: cartons.length, shipped: it.shipped, coo: it.coo, hazmat: it.hazmat, index: i + 1, total: gs.length };
    const qr = [`PALLET:${pallet}`, `DN:${it.dn}`, `PO:${it.po}`, `SO:${it.so}`, `CPO:${it.custPo}`, `CDN:${it.custDn}`, `PN:${it.pnNvidia}`, `QTY:${ps.length}`,
      `DATE:${it.shipped}`, `COO:${it.coo}`, `CTN:${cartons.join(',')}`, `SN:${ps.map((p) => p.serial).join(',')}`].map(ascii).join('\n');
    return { d, qr };
  });
}

/** Edita una pieza (SN, carton o Pallet ID); «N/A» o vacío deja el campo vacío. */
export function editarPieza(piezas: Pieza[], serial: string, patch: Partial<Pick<Pieza, 'sn' | 'carton' | 'pallet'>>): Pieza[] {
  const limpio = Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, vacio((v ?? '').trim().toUpperCase())]));
  return piezas.map((p) => (p.serial === serial ? { ...p, ...limpio, manual: true } : p));
}

/** Bloques de piso de un item: los guardados o, la primera vez, uno por pallet del sistema; siempre con 9 renglones como mínimo. */
export function bloques(it: Pick<Item, 'piezas' | 'piso'>): Bloque[] {
  const sis = grupos(it).filter((g) => g.pallet).map((g) => ({ pallet: g.pallet, filas: [] as Bloque['filas'] }));
  const base = [...(it.piso ?? []), ...sis.filter((g) => !it.piso?.some((b) => b.pallet === g.pallet))]; // un pallet nuevo del SFC también aparece
  return base.map((b) => ({ ...b, filas: [...b.filas, ...Array.from({ length: Math.max(0, POR_PALLET - b.filas.length) }, () => ({ serial: '', carton: '' }))] }));
}

/** Pega renglones copiados de Excel desde el renglón `i` del bloque `b`. Cada renglón: «Physical · palet · # carton», «serial · carton» o solo serial.
 * Con palet: va al primer renglón libre del bloque de ese pallet (si no existe, se crea). Sin palet: llena hacia abajo y sigue en el bloque siguiente. */
export function pegar(bs: Bloque[], b: number, i: number, texto: string): Bloque[] {
  const out = bs.map((x) => ({ ...x, filas: x.filas.map((f) => ({ ...f })) }));
  const lineas = texto.replace(/\r/g, '').split('\n').map((l) => l.split('\t').map((c) => c.trim().toUpperCase())).filter((c) => c.some(Boolean));
  for (const c of lineas) {
    const [serial, carton, pallet] = c.length >= 3 ? [c[0], c[2], c[1]] : [c[0], c[1] ?? '', ''];
    if (pallet) {
      b = out.findIndex((x) => x.pallet === pallet);
      if (b < 0) { out.push({ pallet, filas: [] }); b = out.length - 1; }
      i = out[b].filas.findIndex((f) => !f.serial);
      if (i < 0) i = out[b].filas.length;
    } else if (i >= POR_PALLET && out[b + 1]) { b++; i = 0; }
    if (!out[b]) out[b] = { pallet: '', filas: [] };
    out[b].filas[i] = { serial, carton };
    i++;
  }
  return out;
}
