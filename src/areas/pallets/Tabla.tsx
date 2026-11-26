// Tabla de Pallets (PISO): lo que hay físicamente en cada pallet de un DN, renglón por renglón (serial y carton), junto a lo que
// dice el sistema (las piezas del SFC de ese pallet). Se escanea, se escribe, se pega desde Excel o se carga un archivo.
// La comparación con estados por renglón es PISO vs SISTEMA (T2).
import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Badge, Button, Select } from '../../components/ui.tsx';
import { download } from '../../lib/download.ts';
import { parseFile } from '../../lib/files.ts';
import { bloques, grupos, pegar, POR_PALLET, type Bloque, type Item } from '../../lib/sfc.ts';
import { local } from '../../lib/wip.ts';
import { PageHead } from '../../pages/Layout.tsx';
import { usePallets } from './items.ts';

/** Guarda sin los renglones vacíos del final (bloques() vuelve a poner los 9). */
const compacto = (bs: Bloque[]) => bs.map((b) => {
  let n = b.filas.length;
  while (n && !b.filas[n - 1].serial && !b.filas[n - 1].carton) n--;
  return { pallet: b.pallet, filas: b.filas.slice(0, n) };
});
const csv = (rows: string[][]) => '﻿' + rows.map((r) => r.map((c) => (/[",\n;]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',')).join('\r\n');
const col = (hs: string[], ...names: string[]) => hs.findIndex((h) => names.includes(h.trim().toLowerCase()));

function TablaDn({ it }: { it: Item }) {
  const { update, push } = usePallets(), cambio = useRef(false), raiz = useRef<HTMLDivElement>(null);
  const [msg, setMsg] = useState<string>();
  useEffect(() => () => { if (cambio.current) push([it.dn]); }, [it.dn, push]); // se sube al salir o al cambiar de DN
  const bs = bloques(it), sistema = new Map(grupos(it).map((g) => [g.pallet, g.piezas]));
  const guardar = (nuevo: Bloque[]) => { cambio.current = true; update(it.dn, { piso: compacto(nuevo), editado: local() }); };
  const fila = (b: number, i: number, k: 'serial' | 'carton', v: string) =>
    guardar(bs.map((x, j) => (j !== b ? x : { ...x, filas: x.filas.map((f, n) => (n === i ? { ...f, [k]: v.trim().toUpperCase() } : f)) })));
  // Enter (sufijo del escáner): serial → carton → serial del renglón siguiente
  const ir = (b: number, i: number, k: 'serial' | 'carton') => raiz.current?.querySelector<HTMLInputElement>(`[data-c="${b}-${i}-${k}"]`)?.focus();
  const enter = (b: number, i: number, k: 'serial' | 'carton') => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (k === 'serial') return ir(b, i, 'carton');
    if (i + 1 < bs[b].filas.length) return ir(b, i + 1, 'serial');
    ir(b + 1, 0, 'serial');
  };
  const pega = (b: number, i: number) => (e: ClipboardEvent<HTMLInputElement>) => {
    const t = e.clipboardData.getData('text');
    if (!/[\n\t]/.test(t.trim())) return; // un solo código: pegado normal
    e.preventDefault();
    const n = t.trim().split('\n').length;
    guardar(pegar(bs, b, i, t)); setMsg(`Se pegaron ${n} ${n === 1 ? 'renglón' : 'renglones'}.`);
  };
  async function cargar(file: File) {
    try {
      const f = await parseFile(file), hs = f.headers;
      const s = col(hs, 'physical', 'piso', 'serial', 'serial_number1'), p = col(hs, 'palet', 'pallet', 'pallet id', 'imei'), c = col(hs, '# carton', 'carton', 'carton id', 'mcarton_no');
      if (s < 0) return setMsg(`${file.name}: falta la columna Physical (o Serial).`);
      const lineas = f.rows.map((r) => [r[s], p >= 0 ? r[p] : '', c >= 0 ? r[c] : ''].map((x) => String(x ?? '').trim())).filter((r) => r[0]);
      if (!lineas.length) return setMsg(`${file.name}: no trae seriales.`);
      if (bs.some((b) => b.filas.some((x) => x.serial)) && !confirm(`¿Reemplazar la tabla de piso del DN ${it.dn} con los ${lineas.length} renglones de ${file.name}?`)) return;
      const vacios = bloques({ piezas: it.piezas });
      guardar(pegar(vacios, 0, 0, lineas.map((r) => (p >= 0 ? r.join('\t') : `${r[0]}\t${r[2]}`)).join('\n')));
      setMsg(`${file.name}: ${lineas.length} renglones cargados.`);
    } catch (e) { setMsg(`${file.name}: ${(e as Error).message}`); }
  }
  const exportar = () => download(`tabla-pallets-${it.dn}.csv`, new Blob([csv([['DN', 'Pallet', 'File (sistema)', 'Physical (piso)', '# carton'],
    ...bs.flatMap((b) => b.filas.map((f, i) => [it.dn, b.pallet, sistema.get(b.pallet)?.[i]?.serial ?? '', f.serial, f.carton])).filter((r) => r[2] || r[3] || r[4])])], { type: 'text/csv' }));

  const llenos = bs.reduce((n, b) => n + b.filas.filter((f) => f.serial).length, 0);
  return (
    <div ref={raiz} className="app-tb">
      <div className="app-tb-bar">
        <p className="app-muted"><b className="app-tb-n">{llenos}</b> {llenos === 1 ? 'serial escaneado' : 'seriales escaneados'} en piso · sistema: {it.piezas.length} piezas · {bs.length} {bs.length === 1 ? 'pallet' : 'pallets'}</p>
        <span className="yc-row">
          <label className="yc-btn yc-btn-secondary">Cargar archivo<input type="file" accept=".xlsx,.csv" className="yc-sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) cargar(f); }} /></label>
          <Button onClick={exportar} disabled={!llenos}>Exportar CSV</Button>
        </span>
      </div>
      {msg && <p className="app-muted" role="status"><Badge tone="info">Tabla</Badge> {msg}</p>}
      {bs.map((b, bi) => {
        const sis = sistema.get(b.pallet) ?? [], n = b.filas.filter((f) => f.serial).length;
        return (
          <section key={bi} className="yc-card app-tb-block" aria-label={`Pallet ${b.pallet || bi + 1}`}>
            <header>
              <label className="app-tb-pallet"><span className="app-item-k">Pallet ID (piso)</span>
                <input className="yc-input code" value={b.pallet} placeholder="Escanea el Pallet ID" onChange={(e) => guardar(bs.map((x, j) => (j === bi ? { ...x, pallet: e.target.value.trim().toUpperCase() } : x)))} /></label>
              <span className="app-tb-meta">
                <span className="app-grp-n">{n} / {POR_PALLET}</span>
                {n >= POR_PALLET ? <Badge tone="ok">Lleno</Badge> : <Badge tone="neutral">Faltan {POR_PALLET - n}</Badge>}
                <span className="app-muted">{sis.length ? `Sistema: ${sis.length} piezas` : 'No está en el sistema'}</span>
                <Button variant="quiet" onClick={() => guardar(bs.map((x, j) => (j === bi ? { ...x, filas: [...x.filas, { serial: '', carton: '' }] } : x)))}>+ Renglón</Button>
                {!sis.length && <Button variant="quiet" onClick={() => confirm(`¿Quitar el pallet ${b.pallet || bi + 1} de la tabla?`) && guardar(bs.filter((_, j) => j !== bi))}>Quitar</Button>}
              </span>
            </header>
            <div className="yc-table-wrap"><table className="yc-table app-tb-t">
              <thead><tr><th className="num">#</th><th>File (sistema)</th><th>Physical (piso)</th><th>Carton ID (piso)</th></tr></thead>
              <tbody>{b.filas.map((f, i) => (
                <tr key={i} className={i === POR_PALLET - 1 ? 'is-cierre' : ''}>
                  <td className="num">{i + 1}</td>
                  <td className="code app-tb-sis">{sis[i]?.serial ?? ''}</td>
                  <td><input className="yc-input code app-cell-in" data-c={`${bi}-${i}-serial`} aria-label={`Pallet ${b.pallet || bi + 1}, renglón ${i + 1}: serial`} value={f.serial} autoComplete="off"
                    onChange={(e) => fila(bi, i, 'serial', e.target.value)} onKeyDown={enter(bi, i, 'serial')} onPaste={pega(bi, i)} /></td>
                  <td><input className="yc-input code app-cell-in" data-c={`${bi}-${i}-carton`} aria-label={`Pallet ${b.pallet || bi + 1}, renglón ${i + 1}: carton`} value={f.carton} autoComplete="off"
                    onChange={(e) => fila(bi, i, 'carton', e.target.value)} onKeyDown={enter(bi, i, 'carton')} onPaste={pega(bi, i)} /></td>
                </tr>
              ))}</tbody>
            </table></div>
          </section>
        );
      })}
      <Button onClick={() => guardar([...bs, { pallet: '', filas: [] }])}>+ Agregar pallet</Button>
      <p className="app-muted">Enter pasa al siguiente campo (sirve con el escáner). Para pegar desde Excel, copia las columnas Physical · palet · # carton (o Physical · # carton) y pégalas en el primer renglón.</p>
    </div>
  );
}

export default function Tabla() {
  const { items, sync } = usePallets(), [params, setParams] = useSearchParams();
  useEffect(() => { sync(); }, [sync]);
  const it = items.find((x) => x.dn === params.get('dn')) ?? items[0];
  return (
    <>
      <PageHead title="Tabla de Pallets" sub="Lo que hay en piso, pallet por pallet: escanea o escribe el serial y el carton de cada renglón. Se une al DN cargado (sistema) para compararlo después en PISO vs SISTEMA." />
      {!it ? <p className="yc-card app-empty">Aún no hay DN. Crea uno con <Link to="/pallets/carga">Nuevo Pallet / Shipping Order</Link>.</p> : (
        <>
          <div className="app-tb-dn"><Select label="DN" value={it.dn} onChange={(dn) => setParams({ dn }, { replace: true })} options={items.map((x) => ({ value: x.dn, label: `${x.dn} · ${x.piezas.length} piezas` }))} /></div>
          <TablaDn key={it.dn} it={it} />
        </>
      )}
    </>
  );
}
