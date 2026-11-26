// Item ampliado: todo lo que llenó el SFC, los campos a mano, los datos del modelo y las piezas (con escáner, en pruebas).
import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button } from '../../components/ui.tsx';
import { completas, conEtiqueta, escanear, faltan, MANUAL, ocho, PLANTILLA, POR_DN, type Item } from '../../lib/sfc.ts';
import { local } from '../../lib/wip.ts';
import { usePallets } from './items.ts';

const Dato = ({ k, v }: { k: string; v: string | number }) => <div className="app-dato"><dt>{k}</dt><dd>{v === '' ? '—' : v}</dd></div>;

/** Qué le falta: primero las piezas (se ven en la barra), luego los datos a mano. */
export function Estado({ it }: { it: Item }) {
  const n = completas(it), f = faltan(it);
  if (n < POR_DN) return <Badge tone="warn">Faltan {POR_DN - n} {POR_DN - n === 1 ? 'pieza' : 'piezas'}</Badge>;
  if (it.piezas.length > POR_DN) return <Badge tone="warn">{it.piezas.length - POR_DN} de más</Badge>;
  return f.length ? <Badge tone="info" title={f.join(' · ')}>Faltan datos</Badge> : <Badge tone="ok">Listo</Badge>;
}

export default function ItemDetalle({ it, onClose }: { it: Item; onClose: () => void }) {
  const update = usePallets((s) => s.update), ref = useRef<HTMLDialogElement>(null), carton = useRef<HTMLInputElement>(null), pallet = useRef<HTMLInputElement>(null);
  const [sn, setSn] = useState(''), [ct, setCt] = useState(''), [pl, setPl] = useState('');
  const push = usePallets((s) => s.push), cambio = useRef(false);
  // se sube a la base al cerrar (no en cada tecla); si falla, queda en el equipo y se reintenta al abrir Pallets
  useEffect(() => { ref.current?.showModal(); return () => { if (cambio.current) push([it.dn]); }; }, [it.dn, push]);
  const set = (patch: Partial<Item>) => { cambio.current = true; update(it.dn, { ...patch, editado: local() }); };
  const f = faltan(it), n = completas(it), qty = it.piezas.length, total = Number(it.price) * qty;
  const pallets = [...new Set(it.piezas.map((p) => p.pallet).filter(Boolean))];
  const agregar = () => { if (!sn.trim()) return; set({ piezas: escanear(it.piezas, sn, ct, pl) }); setSn(''); setCt(''); setPl(''); };
  // escáner con sufijo Enter: serial → carton → Pallet ID → agrega
  const sigue = (next: RefObject<HTMLInputElement | null>) => (e: KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); next.current?.focus(); } };
  const filas = [...it.piezas, ...Array.from({ length: Math.max(0, POR_DN - qty) }, () => null)];
  const campo = (k: (typeof MANUAL)[number][0] | (typeof PLANTILLA)[number][0], label: string) => {
    const v = it[k], mal = (k === 'custPo' || k === 'custDn') && v.trim() !== '' && !ocho.test(v.trim());
    return (
      <label key={k} className="yc-field">{label}
        <input className="yc-input" value={v} type={k === 'shipped' ? 'date' : 'text'} inputMode={k === 'custPo' || k === 'custDn' || k === 'price' ? 'decimal' : undefined}
          aria-invalid={mal || undefined} onChange={(e) => set({ [k]: e.target.value })} />
        {mal && <span className="app-dato-err">Deben ser 8 dígitos</span>}
      </label>
    );
  };

  return (
    <dialog ref={ref} className="yc-card app-det" aria-labelledby="app-det-t" onClose={onClose} onClick={(e) => e.target === ref.current && ref.current?.close()}>
      <header className="app-det-head">
        <div>
          <span className="app-item-k">DN</span>
          <h2 id="app-det-t">{it.dn}</h2>
          <p className="app-muted">Creado {it.creado.slice(0, 16)} por {it.usuario || '—'}{it.editado ? ` · editado ${it.editado.slice(0, 16)}` : ''} · {it.archivo}</p>
        </div>
        <span className="yc-row"><Estado it={it} />{conEtiqueta(it) && <Link className="yc-btn yc-btn-secondary" to={`/pallets/etiquetas?dn=${encodeURIComponent(it.dn)}`}>Ver etiqueta</Link>}<Button variant="quiet" onClick={() => ref.current?.close()} aria-label="Cerrar">Cerrar</Button></span>
      </header>
      {!!f.length && <ul className="app-det-faltan" aria-label="Falta">{f.map((x) => <li key={x}>{x}</li>)}</ul>}

      <div className="app-det-body">
        <section aria-labelledby="det-sfc">
          <h3 id="det-sfc" className="app-h3">Del SFC</h3>
          <dl className="app-datos">
            <Dato k="delivery" v={it.dn} /><Dato k="PO" v={it.po} /><Dato k="T/O" v={it.to} /><Dato k="Part number SFC" v={it.pnSfc} />
            <Dato k="qty" v={qty} /><Dato k="Pallet ID" v={pallets.join(' · ')} />
          </dl>
        </section>
        <section aria-labelledby="det-mano">
          <h3 id="det-mano" className="app-h3">A mano</h3>
          <div className="app-det-form">{MANUAL.map(([k, l]) => campo(k, l))}</div>
        </section>
        <section aria-labelledby="det-modelo">
          <h3 id="det-modelo" className="app-h3">Datos del modelo <span className="app-muted">se copian al siguiente item del mismo PN · el precio solo se guarda en este equipo</span></h3>
          <div className="app-det-form">{PLANTILLA.map(([k, l]) => campo(k, l))}<Dato k="Total price USD" v={total ? total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''} /></div>
        </section>
        <section aria-labelledby="det-piezas" className="app-det-piezas">
          <h3 id="det-piezas" className="app-h3">Piezas <span className="app-muted">{n} / {POR_DN} con serial, carton y Pallet ID · el estado en línea está en Conexión con WIP</span></h3>
          <div className="yc-table-wrap">
            <table className="yc-table">
              <thead><tr><th className="num">#</th><th>Serial</th><th>SN</th><th>Carton ID</th><th>Pallet ID</th><th /></tr></thead>
              <tbody>{filas.map((p, i) => (
                <tr key={p?.serial ?? `f${i}`} className={p ? '' : 'is-falta'}>
                  <td className="num">{i + 1}</td>
                  <td className="code">{p?.serial || '—'}</td><td className="code">{p?.sn || '—'}</td>
                  <td className="code">{p?.carton || (p ? <Badge tone="warn">Sin carton</Badge> : '—')}</td><td className="code">{p?.pallet || (p ? <Badge tone="warn">Sin pallet</Badge> : '—')}</td>
                  <td>{!p ? <Badge tone="bad">Falta</Badge> : p.manual ? <Badge tone="info">Escaneada</Badge> : null}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <form className="app-det-scan" onSubmit={(e) => { e.preventDefault(); agregar(); }} aria-label="Escanear faltantes">
            <p className="app-h3">Escanear faltantes <Badge tone="info">En pruebas</Badge></p>
            <p className="app-muted">Escanea (o escribe) el serial, su carton y su Pallet ID. Un serial que ya está toma los datos nuevos; uno nuevo se agrega.</p>
            <div className="yc-row">
              <label className="yc-field">Serial<input className="yc-input code" value={sn} onChange={(e) => setSn(e.target.value)} autoComplete="off"
                onKeyDown={sigue(carton)} /></label>
              <label className="yc-field">Carton ID<input ref={carton} className="yc-input code" value={ct} onChange={(e) => setCt(e.target.value)} autoComplete="off" onKeyDown={sigue(pallet)} /></label>
              <label className="yc-field">Pallet ID<input ref={pallet} className="yc-input code" value={pl} onChange={(e) => setPl(e.target.value)} autoComplete="off" /></label>
              <Button type="submit" disabled={!sn.trim()}>Agregar</Button>
            </div>
          </form>
        </section>
      </div>
    </dialog>
  );
}
