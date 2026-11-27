// Lo que llega del navegador no se confía: tipos, rangos y tamaños antes de tocar la base.
const MAX_FILAS = 20000;
const texto = (v) => typeof v === 'string' && v.trim().length > 0 && v.length <= 80;
const entero = (v) => Number.isInteger(v) && v >= 0 && v <= 1e6;

export function validate(b) {
  if (!b || typeof b !== 'object' || !Array.isArray(b.filas)) return { error: 'Se esperaba { archivo, filas: [...] }' };
  if (typeof b.archivo !== 'string' || b.archivo.length > 200) return { error: 'Nombre de archivo inválido' };
  if (!b.filas.length || b.filas.length > MAX_FILAS) return { error: `Entre 1 y ${MAX_FILAS} filas` };
  for (const [i, f] of b.filas.entries()) {
    const ok = f && /^\d{4}-\d{2}-\d{2}$/.test(f.fecha) && !Number.isNaN(Date.parse(f.fecha)) && texto(f.modelo) && texto(f.estacion)
      && ['entradas', 'primer_pase', 'primera_falla', 'segundo_pase'].every((k) => entero(f[k]))
      && f.primer_pase + f.primera_falla === f.entradas
      && (f.ordenes == null || (typeof f.ordenes === 'string' && f.ordenes.length <= 4000));
    if (!ok) return { error: `Fila ${i + 1} inválida` };
  }
  // congruencia: opcional, solo se guarda; se acepta un objeto chico y nada más
  const c = b.congruencia, size = c == null ? 0 : JSON.stringify(c).length;
  if (c != null && (typeof c !== 'object' || Array.isArray(c) || size > 16000)) return { error: 'Congruencia inválida' };
  return { archivo: b.archivo.trim().slice(0, 200), sesion: b.sesion, usuario: b.usuario, filas: b.filas, congruencia: c ?? null };
}

// ── Pallets ──
const corto = (v, max = 200) => typeof v === 'string' && v.length <= max;
const ENTREGA = ['dn', 'so', 'to', 'po', 'model', 'desc', 'customer', 'destination', 'loose', 'nw', 'gw'];
/** Un listado de entregas (SAP) tal como lo lee la app: se guarda completo para el histórico. */
export function validateEntregas(b) {
  if (!b || typeof b !== 'object' || !Array.isArray(b.entregas)) return { error: 'Se esperaba { archivo, entregas: [...] }' };
  if (!corto(b.archivo) || !b.archivo.trim()) return { error: 'Nombre de archivo inválido' };
  if (!b.entregas.length || b.entregas.length > 5000) return { error: 'Entre 1 y 5000 entregas' };
  for (const [i, e] of b.entregas.entries()) {
    const ok = e && typeof e === 'object' && corto(e.dn, 40) && e.dn.trim() && Number.isInteger(e.qty) && e.qty >= 0 && e.qty <= 1e6
      && ENTREGA.every((k) => e[k] == null || corto(e[k]));
    if (!ok) return { error: `Entrega ${i + 1} inválida` };
  }
  return { archivo: b.archivo.trim(), entregas: b.entregas.map((e) => Object.fromEntries([...ENTREGA, 'qty'].map((k) => [k, e[k] ?? '']))) };
}

/** Campos de una tarima (los de src/lib/pallets.ts TARIMAS_COLS). Todo texto; los seriales separados por espacio. */
export const TARIMA = ['pallet', 'ref', 'dn', 'nvdn', 'so', 'po', 'to', 'pn', 'desc', 'customer', 'destination', 'qty', 'cartons', 'nw', 'gw',
  'dims', 'coo', 'hts', 'battery', 'shipDate', 'carrier', 'plates', 'truckHour', 'incoterm', 'seal', 'dock', 'serials', 'printed', 'prueba', 'creada'];
export function validateTarima(b) {
  const t = b?.tarima;
  if (!t || typeof t !== 'object' || Array.isArray(t)) return { error: 'Se esperaba { tarima }' };
  const pallet = typeof t.pallet === 'string' ? t.pallet.trim().toUpperCase() : '';
  if (!/^PAL[A-Z]{0,4}\d{3,}$/.test(pallet)) return { error: 'Pallet # inválido (como PALFX98195)' };
  for (const k of TARIMA) if (t[k] != null && !corto(t[k], k === 'serials' ? 40000 : 400)) return { error: `Campo ${k} inválido` };
  if (b.antes != null && !corto(b.antes, 40)) return { error: 'Pallet # anterior inválido' };
  return { pallet, antes: b.antes ? b.antes.trim().toUpperCase() : null, datos: Object.fromEntries(TARIMA.map((k) => [k, k === 'pallet' ? pallet : t[k] ?? ''])) };
}

// Items de Pallets (un DN cada uno). Sin `price`: los precios no se guardan en la base.
const ITEM = ['dn', 'po', 'to', 'pnSfc', 'archivo', 'usuario', 'creado', 'editado', 'so', 'pnNvidia', 'shipped', 'custPo', 'custDn', 'project', 'model', 'hazmat', 'coo'];
const opcional = (v, n) => v == null || corto(v, n);
export function validateItems(b) {
  if (!b || !Array.isArray(b.items) || !b.items.length || b.items.length > 500) return { error: 'Se esperaba { items: [...] } con 1 a 500 items' };
  const items = [];
  for (const it of b.items) {
    const dn = typeof it?.dn === 'string' ? it.dn.trim() : '';
    if (!/^[A-Za-z0-9-]{1,40}$/.test(dn)) return { error: `DN inválido: ${String(it?.dn).slice(0, 40)}` };
    if (items.some((x) => x.dn === dn)) return { error: `DN ${dn} repetido` };
    if (!ITEM.every((k) => opcional(it[k], 300))) return { error: `DN ${dn}: un campo es muy largo` };
    if (!Array.isArray(it.piezas) || it.piezas.length > 500) return { error: `DN ${dn}: piezas inválidas` };
    const piezas = [];
    for (const p of it.piezas) {
      if (!p || !['serial', 'sn', 'carton', 'pallet', 'estado'].every((k) => opcional(p[k], 60)) || typeof p.serial !== 'string' || !p.serial) return { error: `DN ${dn}: pieza inválida` };
      piezas.push({ serial: p.serial, sn: p.sn ?? '', carton: p.carton ?? '', pallet: p.pallet ?? '', estado: p.estado ?? '', ...(p.manual ? { manual: true } : {}) });
    }
    const liberados = it.liberados ?? [];
    if (!Array.isArray(liberados) || liberados.length > 500 || !liberados.every((x) => corto(x, 60))) return { error: `DN ${dn}: pallets liberados inválidos` };
    const piso = it.piso ?? [];
    const filaOk = (f) => f && opcional(f.serial, 60) && opcional(f.carton, 60);
    if (!Array.isArray(piso) || piso.length > 500 || !piso.every((b) => b && opcional(b.pallet, 60) && Array.isArray(b.filas) && b.filas.length <= 50 && b.filas.every(filaOk))) return { error: `DN ${dn}: tabla de piso inválida` };
    items.push({ ...Object.fromEntries(ITEM.map((k) => [k, it[k] ?? ''])), dn, piezas, liberados,
      piso: piso.map((b) => ({ pallet: b.pallet ?? '', filas: b.filas.map((f) => ({ serial: f.serial ?? '', carton: f.carton ?? '' })) })) });
  }
  return { items };
}

// WIP: un corte con su resumen por estación × modelo (no se guardan piezas ni seriales).
const num = (v, max = 1e6) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max;
export function validateCorte(b) {
  if (!b || !corto(b.archivo, 300) || !b.archivo.trim()) return { error: 'Nombre de archivo inválido' };
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(b.corte ?? '')) return { error: 'Corte inválido (AAAA-MM-DD HH:MM)' };
  if (!entero(b.piezas) || !entero(b.terminadas)) return { error: 'Piezas inválidas' };
  if (!Array.isArray(b.resumen) || b.resumen.length > 5000) return { error: 'Resumen inválido' };
  const resumen = [];
  for (const r of b.resumen) {
    if (!r || !corto(r.estacion, 80) || !corto(r.modelo ?? '', 80) || !entero(r.piezas) || !entero(r.bloqueadas) || !num(r.horas) || !num(r.max)) return { error: 'Fila del resumen inválida' };
    resumen.push({ estacion: r.estacion, modelo: r.modelo ?? '', piezas: r.piezas, bloqueadas: r.bloqueadas, horas: r.horas, max: r.max });
  }
  // piezas en proceso con su serial (opcional: los cortes de antes de 0.45 no las traen)
  const det = b.detalle ?? [];
  // ~170 bytes por pieza: 25,000 caben en los 5 MB del cuerpo (más dan 413 antes de llegar aquí)
  if (!Array.isArray(det) || det.length > 25000) return { error: 'Demasiadas piezas en proceso para guardar el corte (máximo 25,000)' };
  const detalle = [];
  for (const p of det) {
    if (!p || !corto(p.serial, 60) || !p.serial || !['model', 'mo', 'station', 'prev'].every((k) => corto(p[k] ?? '', 80)) || !corto(p.at ?? '', 20) || !num(p.hours) || typeof (p.blocked ?? false) !== 'boolean') return { error: 'Pieza del detalle inválida' };
    detalle.push({ serial: p.serial, model: p.model ?? '', mo: p.mo ?? '', station: p.station ?? '', prev: p.prev ?? '', at: p.at ?? '', hours: p.hours, blocked: !!p.blocked });
  }
  return { archivo: b.archivo.trim(), corte: b.corte, piezas: b.piezas, terminadas: b.terminadas, resumen, detalle };
}

// WIP: estructura de flujo; solo esas cuatro columnas, en orden.
export function validateFlujo(b) {
  if (!b || !corto(b.archivo, 300) || !b.archivo.trim()) return { error: 'Nombre de archivo inválido' };
  if (!Array.isArray(b.pasos) || !b.pasos.length || b.pasos.length > 2000) return { error: 'Entre 1 y 2000 estaciones' };
  const pasos = [];
  for (const p of b.pasos) {
    if (!p || !['stage', 'board', 'model', 'station'].every((k) => corto(p[k], 80)) || !p.station.trim() || !p.stage.trim()) return { error: 'Estación inválida en la estructura' };
    pasos.push({ stage: p.stage, board: p.board, model: p.model, station: p.station });
  }
  return { archivo: b.archivo.trim(), pasos };
}
