// Pallets: un item por DN (creado en Carga desde el SFC), en cuadrícula de 5 × 3; «Ampliar» abre todos sus datos.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Badge, Button, Segmented } from '../../components/ui.tsx';
import { completas, faltan, grupos, POR_PALLET, type Item } from '../../lib/sfc.ts';
import { PageHead } from '../../pages/Layout.tsx';
import { I } from '../../areas.ts';
import { usePallets } from './items.ts';
import ItemDetalle, { Estado } from './Item.tsx';

const POR_PAGINA = 15; // 5 × 3
type Ver = 'todos' | 'incompletos' | 'listos';

export default function Pallets() {
  const { items, sync, db } = usePallets(), go = useNavigate();
  useEffect(() => { sync(); }, [sync]);
  const [q, setQ] = useState(''), [ver, setVer] = useState<Ver>('todos'), [pag, setPag] = useState(0), [abierto, setAbierto] = useState<string>();
  // «Abrir» desde el Historial: /pallets?dn=…
  const [params, setParams] = useSearchParams(), pedido = params.get('dn');
  useEffect(() => { if (pedido) { setAbierto(pedido); setParams({}, { replace: true }); } }, [pedido, setParams]);
  const listo = (it: Item) => !faltan(it).length;
  const vis = items.filter((it) => (ver === 'todos' || listo(it) === (ver === 'listos'))
    && (!q || `${it.dn} ${it.po} ${it.so} ${it.custDn} ${it.piezas.map((p) => `${p.serial} ${p.carton} ${p.pallet}`).join(' ')}`.toLowerCase().includes(q.trim().toLowerCase())));
  const paginas = Math.max(1, Math.ceil(vis.length / POR_PAGINA)), p = Math.min(pag, paginas - 1);
  const filtra = (f: () => void) => { f(); setPag(0); };
  const it = items.find((x) => x.dn === abierto);

  return (
    <>
      <PageHead title="Pallets" sub="Un item por DN, creado desde el export de SFC. Amplía uno para ver todos sus datos y completar lo que falta.">
        <Button variant="primary" onClick={() => go('/pallets/carga')}>Nuevo Pallet / Shipping Order</Button>
      </PageHead>
      {db && <p className="app-muted" role="status"><Badge tone={db[0]}>Base</Badge> {db[1]}</p>}
      {!items.length ? (
        <section className="yc-card app-empty app-items-empty">
          <svg className="app-items-icon" viewBox="0 0 24 24" aria-hidden><path d={I.pal} /></svg>
          <p>Aún no hay items. Crea el primero con <Link to="/pallets/carga">Nuevo Pallet / Shipping Order</Link> y el export de SFC.</p>
        </section>
      ) : (
        <>
          <div className="app-items-bar">
            <label className="yc-field app-items-q">Buscar<input className="yc-input" type="search" value={q} onChange={(e) => filtra(() => setQ(e.target.value))} placeholder="DN, PO, serial, carton, Pallet ID…" /></label>
            <Segmented label="Ver" value={ver} onChange={(v) => filtra(() => setVer(v))} options={[
              { value: 'todos', label: `Todos (${items.length})` }, { value: 'incompletos', label: `Incompletos (${items.filter((x) => !listo(x)).length})` }, { value: 'listos', label: `Listos (${items.filter(listo).length})` }]} />
          </div>
          {!vis.length ? <p className="yc-card app-empty">Ningún item con estos filtros.</p> : (
            <ul className="app-items" aria-label="Items por DN">
              {vis.slice(p * POR_PAGINA, (p + 1) * POR_PAGINA).map((x, i) => {
                const n = completas(x), t = x.piezas.length, ps = grupos(x).filter((g) => g.pallet), [fecha, hora] = (x.editado ?? x.creado).split(' ');
                return (
                  <li key={x.dn} style={{ animationDelay: `${i * 30}ms` }}>
                    <button type="button" className="yc-card app-item" onClick={() => setAbierto(x.dn)} aria-label={`Ampliar DN ${x.dn}`}>
                      <span className="app-item-top"><span className="app-item-k">DN</span><Estado it={x} /></span>
                      <strong className="app-item-dn">{x.dn}</strong>
                      <span className="app-item-bar" aria-label={`${n} de ${t} piezas en pallet`}><i style={{ width: `${t ? (n / t) * 100 : 0}%` }} className={t && n === t ? 'is-full' : ''} /></span>
                      <span className="app-item-meta"><span>{n} / {t} piezas</span><span>{ps.length} {ps.length === 1 ? 'pallet' : 'pallets'} · {ps.filter((g) => g.piezas.length === POR_PALLET).length} de {POR_PALLET}</span></span>
                      <span className="app-item-foot">
                        <span className="app-item-who" aria-hidden>{(x.usuario || '?').slice(0, 1).toUpperCase()}</span>
                        <span><b>{x.usuario || 'Sin usuario'}</b><span>{fecha} · {hora?.slice(0, 5)}{x.editado ? ' · editado' : ''}</span></span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {paginas > 1 && (
            <nav className="yc-row app-items-pag" aria-label="Páginas">
              <Button variant="quiet" disabled={!p} onClick={() => setPag(p - 1)}>Anterior</Button>
              <span className="app-muted">Página {p + 1} de {paginas}</span>
              <Button variant="quiet" disabled={p >= paginas - 1} onClick={() => setPag(p + 1)}>Siguiente</Button>
            </nav>
          )}
        </>
      )}
      {it && <ItemDetalle it={it} onClose={() => setAbierto(undefined)} />}
    </>
  );
}
