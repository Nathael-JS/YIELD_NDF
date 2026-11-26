// Historial de Pallets: los items de la base por día de creación, con quién los creó y quién los editó al último.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Select } from '../../components/ui.tsx';
import { completas } from '../../lib/sfc.ts';
import { PageHead } from '../../pages/Layout.tsx';
import { Estado } from './Item.tsx';
import { usePallets } from './items.ts';

export default function HistorialPallets() {
  const { items, sync, db } = usePallets(), [dia, setDia] = useState('');
  useEffect(() => { sync(); }, [sync]);
  const dias = [...new Set(items.map((x) => x.creado.slice(0, 10)))];
  const grupos = (dia ? [dia] : dias).map((d) => [d, items.filter((x) => x.creado.startsWith(d))] as const);
  return (
    <>
      <PageHead title="Historial · Pallets" sub="Cada item (un DN del SFC) guardado en la base, por día de creación: quién lo creó y quién lo editó al último." />
      {db && <p className="app-muted" role="status"><Badge tone={db[0]}>Base</Badge> {db[1]}</p>}
      {!items.length ? <p className="yc-card app-empty">Aún no hay items. Crea uno con <Link to="/pallets/carga">Nuevo Pallet / Shipping Order</Link>.</p> : (
        <>
          <div className="app-hist-bar"><Select label="Día" value={dia} onChange={setDia} options={[{ value: '', label: `Todos (${dias.length} ${dias.length === 1 ? 'día' : 'días'})` }, ...dias.map((d) => ({ value: d, label: d }))]} /></div>
          {grupos.map(([d, xs]) => (
            <section key={d} className="yc-card app-hist-day" aria-label={`Items del ${d}`}>
              <header><h2 className="app-h3">{d}</h2><span className="app-muted">{xs.length} {xs.length === 1 ? 'item' : 'items'}</span></header>
              <div className="yc-table-wrap">
                <table className="yc-table">
                  <thead><tr><th>Hora</th><th>DN</th><th className="num">Piezas</th><th>Estado</th><th>Creó</th><th>Última edición</th><th>Archivo</th><th /></tr></thead>
                  <tbody>{xs.map((x) => (
                    <tr key={x.dn}>
                      <td className="code">{x.creado.slice(11, 16)}</td><td className="code">{x.dn}</td><td className="num">{completas(x)} / {x.piezas.length}</td>
                      <td><Estado it={x} /></td><td>{x.usuario || '—'}</td>
                      <td>{x.editado ? <>{x.edito || x.usuario} <span className="app-muted">{x.editado.slice(0, 16)}</span></> : <span className="app-muted">Sin editar</span>}</td>
                      <td className="app-muted">{x.archivo}</td>
                      <td><Link className="yc-btn yc-btn-quiet" to={`/pallets?dn=${encodeURIComponent(x.dn)}`}>Abrir</Link></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </section>
          ))}
        </>
      )}
    </>
  );
}
