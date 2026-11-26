// Pallets: el export de SFC (una fila por serial) crea un item por DN. Ver PALLETS.md.
import type { Cell, ParsedFile } from './files.ts';

/** Piezas por DN (serial + carton + Pallet ID). Con menos, se piden las faltantes con el escáner o a mano. */
export const POR_DN = 9;
export const SFC_REQUIRED = ['DN', 'SERIAL_NUMBER1', 'MCARTON_NO', 'IMEI'] as const;

/** Una pieza: serial (`SERIAL_NUMBER1`, MT…), SN (`SERIAL_NUMBER`, el del MES: se cruza con el WIP), carton (`MCARTON_NO`),
 * Pallet ID (`IMEI`) y estado en SFC (`WIP_GROUP`; el estado en línea sale del WIP, en Conexión con WIP). `manual`: agregada o corregida en la app. */
export interface Pieza { serial: string; sn: string; carton: string; pallet: string; estado: string; manual?: boolean }

/** Campos que se escriben a mano (los de «plantilla» se copian del último item con el mismo PN del SFC). */
export const MANUAL = [['so', 'Sales Order'], ['pnNvidia', 'Part number NVIDIA'], ['shipped', 'Shipped day'], ['custPo', 'Customer PO'], ['custDn', 'Customer DN']] as const;
export const PLANTILLA = [['project', 'Project'], ['model', 'Model'], ['hazmat', 'Hazmat'], ['coo', 'COO'], ['price', 'Unit price USD']] as const;
type Manual = Record<(typeof MANUAL)[number][0] | (typeof PLANTILLA)[number][0], string>;

export interface Item extends Manual {
  dn: string; po: string; to: string; pnSfc: string; piezas: Pieza[];
  archivo: string; usuario: string; creado: string; editado?: string;
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
/** El DN ya tiene sus piezas completas: se puede ver su etiqueta. */
export const conEtiqueta = (it: Pick<Item, 'piezas'>) => completas(it) >= POR_DN && it.piezas.length === POR_DN;
export const ocho = /^\d{8}$/;
/** Lo que le falta a un item para estar listo (vacío = listo). */
export function faltan(it: Item) {
  const out: string[] = [];
  const n = completas(it);
  if (n < POR_DN) out.push(`${POR_DN - n} de ${POR_DN} piezas sin serial, carton o Pallet ID`);
  if (it.piezas.length > POR_DN) out.push(`${it.piezas.length - POR_DN} piezas de más`);
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
  const s = serial.trim().toUpperCase(), c = carton.trim().toUpperCase(), pl = pallet.trim().toUpperCase();
  if (!s) return piezas;
  const i = piezas.findIndex((p) => p.serial.toUpperCase() === s);
  if (i < 0) return [...piezas, { serial: s, sn: '', carton: c, pallet: pl, estado: '', manual: true }];
  return piezas.map((p, j) => (j === i ? { ...p, carton: c || p.carton, pallet: pl || p.pallet, manual: true } : p));
}
