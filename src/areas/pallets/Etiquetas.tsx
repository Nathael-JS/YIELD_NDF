// Etiquetas: los DN completos (9 piezas con serial, carton y Pallet ID): una etiqueta 4×6 in por Pallet ID (PDF para la térmica)
// y la hoja con todos sus datos; «Editar» abre el item.
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Badge, Button } from '../../components/ui.tsx';
import { PalletLabel } from '../../components/label.tsx';
import { download } from '../../lib/download.ts';
import { conEtiqueta, etiquetas, faltan, type Item } from '../../lib/sfc.ts';
import { PageHead } from '../../pages/Layout.tsx';
import ItemDetalle from './Item.tsx';
import { usePallets } from './items.ts';

const usd = (n: number) => (n ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '');

function Hoja({ it, onEdit }: { it: Item; onEdit: () => void }) {
  const qty = it.piezas.length, f = faltan(it), ls = etiquetas(it);
  const [busy, setBusy] = useState(false), [err, setErr] = useState<string>();
  const pdf = async () => {
    setBusy(true); setErr(undefined);
    try { const { labelsPdf } = await import('../../pages/pdf.tsx'); download(`etiquetas-${it.dn}.pdf`, await labelsPdf(ls)); }
    catch (e) { setErr(`No se pudo crear el PDF: ${(e as Error).message}`); } finally { setBusy(false); }
  };
  const datos: [string, string | number][] = [
    ['Shipped day', it.shipped], ['PO', it.po], ['Sales Order', it.so], ['Project', it.project], ['Model', it.model], ['delivery', it.dn],
    ['partnumber', it.pnNvidia], ['PN SFC', it.pnSfc], ['qty', qty], ['Unit price USD', it.price], ['Total price USD', usd(Number(it.price) * qty)],
  ];
  return (
    <article className="yc-card app-tag" aria-labelledby="app-tag-t">
      <header className="app-tag-head">
        <div><span className="app-item-k">DN</span><h2 id="app-tag-t">{it.dn}</h2></div>
        <span className="yc-row">{f.length ? <Badge tone="info" title={f.join(' · ')}>Faltan datos</Badge> : <Badge tone="ok">Completa</Badge>}<Button onClick={onEdit}>Editar</Button></span>
      </header>
      {!!f.length && <p className="app-muted app-tag-falta">Falta: {f.join(' · ')}. Se puede ver la etiqueta, pero el PDF se descarga cuando esté completa.</p>}
      <section className="app-tag-labels" aria-labelledby="app-tag-l">
        <div className="app-tag-labels-head">
          <h3 id="app-tag-l" className="app-h3">{ls.length} {ls.length === 1 ? 'etiqueta' : 'etiquetas'} 4×6 in <span className="app-muted">una por Pallet ID · sin precios</span></h3>
          <Button variant="primary" disabled={!!f.length || busy} onClick={pdf}>{busy ? 'Creando PDF…' : `Descargar PDF (${ls.length})`}</Button>
        </div>
        {err && <p className="app-muted" role="alert"><Badge tone="bad">PDF</Badge> {err}</p>}
        <ul className="app-tag-strip">{ls.map((l) => <li key={l.d.pallet} className="yc-label-wrap"><PalletLabel d={l.d} qr={l.qr} /></li>)}</ul>
        <p className="app-muted">Imprime el PDF en tamaño real (100 %) con papel 4×6 in. Antes de usarlo en piso, escanea el código de barras y el QR de una etiqueta impresa.</p>
      </section>
      <dl className="app-tag-grid">
        {datos.map(([k, v]) => <div key={k} className="app-dato"><dt>{k}</dt><dd>{v === '' ? '—' : v}</dd></div>)}
        <div className="app-dato is-wide"><dt>hazmat</dt><dd>{it.hazmat || '—'}</dd></div>
      </dl>
      <div className="yc-table-wrap">
        <table className="yc-table">
          <thead><tr><th className="num">#</th><th>Serial</th><th>SN</th><th>Carton ID</th><th>Pallet ID</th></tr></thead>
          <tbody>{it.piezas.map((p, i) => <tr key={p.serial}><td className="num">{i + 1}</td><td className="code">{p.serial}</td><td className="code">{p.sn || '—'}</td><td className="code">{p.carton}</td><td className="code">{p.pallet}</td></tr>)}</tbody>
        </table>
      </div>
    </article>
  );
}

export default function Etiquetas() {
  const items = usePallets((s) => s.items), listos = items.filter(conEtiqueta);
  const [params, setParams] = useSearchParams(), [editar, setEditar] = useState<string>();
  const it = listos.find((x) => x.dn === params.get('dn')) ?? listos[0], ed = items.find((x) => x.dn === editar);
  return (
    <>
      <PageHead title="Etiquetas" sub="Los DN con sus 9 piezas completas (serial, carton y Pallet ID): una etiqueta 4×6 in por Pallet ID y todos sus datos." />
      {!listos.length ? (
        <p className="yc-card app-empty">Aún no hay DN completos. {items.length ? <>Complétalos en <Link to="/pallets">Pallets</Link> o revisa los pendientes en <Link to="/pallets/wip">Conexión con WIP</Link>.</> : <>Crea uno con <Link to="/pallets/carga">Nuevo Pallet / Shipping Order</Link>.</>}</p>
      ) : (
        <div className="app-tags">
          <nav className="yc-card app-tags-list" aria-label="DN completos">
            <p className="app-item-k">{listos.length} {listos.length === 1 ? 'DN completo' : 'DN completos'}{items.length > listos.length ? ` · ${items.length - listos.length} sin completar` : ''}</p>
            <ul>{listos.map((x) => (
              <li key={x.dn}><button type="button" aria-current={x.dn === it.dn || undefined} onClick={() => setParams({ dn: x.dn }, { replace: true })}>
                <b>{x.dn}</b><span>{[...new Set(x.piezas.map((p) => p.pallet))].length} pallets · {x.so || 'sin SO'}</span>
              </button></li>
            ))}</ul>
          </nav>
          <Hoja key={it.dn} it={it} onEdit={() => setEditar(it.dn)} />
        </div>
      )}
      {/* se busca en todos los items: si la edición lo deja incompleto, el diálogo sigue en el mismo DN */}
      {ed && <ItemDetalle it={ed} onClose={() => setEditar(undefined)} />}
    </>
  );
}
