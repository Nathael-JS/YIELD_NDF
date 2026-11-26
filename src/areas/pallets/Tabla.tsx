// Tabla de Pallets (PISO): lo que hay físicamente en cada pallet de un DN, renglón por renglón (serial y carton), junto a lo que
// dice el sistema (las piezas del SFC de ese pallet). Se escanea, se escribe, se pega desde Excel o se carga un archivo.
// La comparación con estados por renglón es PISO vs SISTEMA (T2).
import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Badge, Button, Segmented, Select, type Tone } from '../../components/ui.tsx';
import { download } from '../../lib/download.ts';
import { parseFile } from '../../lib/files.ts';
import { bloques, comparar, grupos, pegar, POR_PALLET, type Bloque, type Cuadre, type Item } from '../../lib/sfc.ts';
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
/** Estado de cada renglón con ícono y texto (no solo color). */
const CUADRE: Record<Cuadre, [Tone, string]> = { ok: ['ok', '✓ Cuadra'], movido: ['warn', '⚠ Movido'], carton: ['warn', '⚠ Carton'], sobra: ['bad', '✗ Sobra'], repetido: ['bad', '✗ Repetido'] };
type Vista = 'captura' | 'dif' | 'faltan';
const col = (hs: string[], ...names: string[]) => hs.findIndex((h) => names.includes(h.trim().toLowerCase()));

function TablaDn({ it }: { it: Item }) {
  const { update, push, items } = usePallets(), cambio = useRef(false), raiz = useRef<HTMLDivElement>(null);
  const [msg, setMsg] = useState<string>(), [vista, setVista] = useState<Vista>('captura'), [foco, setFoco] = useState<[number, number]>();
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

  // «Ir» desde Diferencias: enfoca el renglón cuando la captura ya está en pantalla
  useEffect(() => { if (foco && vista === 'captura') { ir(foco[0], foco[1], 'serial'); setFoco(undefined); } });
  const llenos = bs.reduce((n, b) => n + b.filas.filter((f) => f.serial).length, 0);
  // PISO vs SISTEMA: contra las piezas de todos los DN (así se ve si una pieza está en otro DN)
  const cmp = comparar(it, items), porFila = new Map(cmp.filas.map((r) => [`${r.b}-${r.i}`, r])), dif = cmp.filas.filter((r) => r.estado !== 'ok');
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
      <section className="yc-card app-cmp" aria-label="PISO vs SISTEMA">
        <div>
          <p className="app-item-k">PISO vs SISTEMA</p>
          <ul className="app-cx-sum">
            <li><b>{cmp.ok}</b> cuadran</li><li><b>{cmp.movido}</b> movidos</li><li><b>{cmp.carton}</b> carton distinto</li>
            <li><b>{cmp.sobra}</b> sobran en piso</li><li><b>{cmp.repetido}</b> repetidos</li><li><b>{cmp.faltan.length}</b> faltan en piso</li>
          </ul>
        </div>
        <Segmented label="Ver" value={vista} onChange={setVista} options={[{ value: 'captura', label: 'Captura' }, { value: 'dif', label: `Diferencias (${dif.length})` }, { value: 'faltan', label: `Faltan en piso (${cmp.faltan.length})` }]} />
      </section>
      {vista === 'dif' && (!dif.length ? <p className="yc-card app-empty">{cmp.filas.length ? 'Todo lo escaneado cuadra con el sistema.' : 'Aún no hay nada escaneado.'}</p> : (
        <div className="yc-table-wrap"><table className="yc-table">
          <thead><tr><th>Pallet (piso)</th><th className="num">Renglón</th><th>Physical</th><th>Carton</th><th>Estado</th><th>Detalle</th><th /></tr></thead>
          <tbody>{dif.map((r) => (
            <tr key={`${r.b}-${r.i}`}><td className="code">{r.pallet || '—'}</td><td className="num">{r.i + 1}</td><td className="code">{r.serial}</td><td className="code">{r.carton || '—'}</td>
              <td><Badge tone={CUADRE[r.estado][0]}>{CUADRE[r.estado][1]}</Badge></td><td className="app-muted">{r.nota}</td>
              <td><Button variant="quiet" onClick={() => { setVista('captura'); setFoco([r.b, r.i]); }}>Ir</Button></td></tr>
          ))}</tbody>
        </table></div>
      ))}
      {vista === 'faltan' && (!cmp.faltan.length ? <p className="yc-card app-empty">Todas las piezas del sistema están escaneadas en piso.</p> : (
        <div className="yc-table-wrap"><table className="yc-table">
          <thead><tr><th>Serial (sistema)</th><th>SN</th><th>Carton</th><th>Pallet ID</th></tr></thead>
          <tbody>{cmp.faltan.map((p) => <tr key={p.serial}><td className="code">{p.serial}</td><td className="code">{p.sn || '—'}</td><td className="code">{p.carton || '—'}</td><td className="code">{p.pallet || '—'}</td></tr>)}</tbody>
        </table></div>
      ))}
      {vista === 'captura' && <>
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
              <thead><tr><th className="num">#</th><th>File (sistema)</th><th>Physical (piso)</th><th>Carton ID (piso)</th><th>Piso vs sistema</th></tr></thead>
              <tbody>{b.filas.map((f, i) => (
                <tr key={i} className={i === POR_PALLET - 1 ? 'is-cierre' : ''}>
                  <td className="num">{i + 1}</td>
                  <td className="code app-tb-sis">{sis[i]?.serial ?? ''}</td>
                  <td><input className="yc-input code app-cell-in" data-c={`${bi}-${i}-serial`} aria-label={`Pallet ${b.pallet || bi + 1}, renglón ${i + 1}: serial`} value={f.serial} autoComplete="off"
                    onChange={(e) => fila(bi, i, 'serial', e.target.value)} onKeyDown={enter(bi, i, 'serial')} onPaste={pega(bi, i)} /></td>
                  <td><input className="yc-input code app-cell-in" data-c={`${bi}-${i}-carton`} aria-label={`Pallet ${b.pallet || bi + 1}, renglón ${i + 1}: carton`} value={f.carton} autoComplete="off"
                    onChange={(e) => fila(bi, i, 'carton', e.target.value)} onKeyDown={enter(bi, i, 'carton')} onPaste={pega(bi, i)} /></td>
                  <td>{porFila.get(`${bi}-${i}`) && <Badge tone={CUADRE[porFila.get(`${bi}-${i}`)!.estado][0]} title={porFila.get(`${bi}-${i}`)!.nota || undefined}>{CUADRE[porFila.get(`${bi}-${i}`)!.estado][1]}</Badge>}</td>
                </tr>
              ))}</tbody>
            </table></div>
          </section>
        );
      })}
      <Button onClick={() => guardar([...bs, { pallet: '', filas: [] }])}>+ Agregar pallet</Button>
      <p className="app-muted">Enter pasa al siguiente campo (sirve con el escáner). Para pegar desde Excel, copia las columnas Physical · palet · # carton (o Physical · # carton) y pégalas en el primer renglón.</p>
      </>}
    </div>
  );
}

export default function Tabla() {
  const { items, sync } = usePallets(), [params, setParams] = useSearchParams();
  useEffect(() => { sync(); }, [sync]);
  const it = items.find((x) => x.dn === params.get('dn')) ?? items[0];
  return (
    <>
      <PageHead title="Tabla de Pallets" sub="Lo que hay en piso, pallet por pallet: escanea o escribe el serial y el carton de cada renglón. Se une al DN cargado (sistema) para compararlo en PISO vs SISTEMA: cada renglón dice si cuadra, si la pieza está en otro pallet o DN, si sobra o si el carton es otro." />
      {!it ? <p className="yc-card app-empty">Aún no hay DN. Crea uno con <Link to="/pallets/carga">Nuevo Pallet / Shipping Order</Link>.</p> : (
        <>
          <div className="app-tb-dn"><Select label="DN" value={it.dn} onChange={(dn) => setParams({ dn }, { replace: true })} options={items.map((x) => ({ value: x.dn, label: `${x.dn} · ${x.piezas.length} piezas` }))} /></div>
          <TablaDn key={it.dn} it={it} />
        </>
      )}
    </>
  );
}
