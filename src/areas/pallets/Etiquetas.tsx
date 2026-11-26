// Etiquetas: una etiqueta 4×6 in por Pallet ID de cada DN y la hoja con todos sus datos; «Editar» abre el item.
// Los DN que no están listos se ven como vista previa (sello MUESTRA); el PDF sale con paraImprimir() (pallets completos o liberados y datos llenos).
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Badge, Button } from '../../components/ui.tsx';
import { PalletLabel } from '../../components/label.tsx';
import { download } from '../../lib/download.ts';
import { etiquetas, faltan, paraImprimir, type Item } from '../../lib/sfc.ts';
import { PageHead } from '../../pages/Layout.tsx';
import ItemDetalle from './Item.tsx';
import { usePallets } from './items.ts';

const usd = (n: number) => (n ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '');

function Hoja({ it, onEdit }: { it: Item; onEdit: () => void }) {
  const qty = it.piezas.length, f = faltan(it), ls = etiquetas(it), listo = paraImprimir(it);
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
        <span className="yc-row">{listo ? <Badge tone="ok">Lista para imprimir</Badge> : <Badge tone="warn" title={f.join(' · ')}>Vista previa</Badge>}<Button onClick={onEdit}>Editar</Button></span>
      </header>
      {!listo && <p className="app-muted app-tag-falta">Falta: {f.join(' · ')}. Las etiquetas se ven como muestra y se pueden editar; el PDF se descarga cuando el DN esté completo.</p>}
      <section className="app-tag-labels" aria-labelledby="app-tag-l">
        <div className="app-tag-labels-head">
          <h3 id="app-tag-l" className="app-h3">{ls.length} {ls.length === 1 ? 'etiqueta' : 'etiquetas'} 4×6 in <span className="app-muted">una por Pallet ID · sin precios</span></h3>
          <Button variant="primary" disabled={!listo || busy} onClick={pdf}>{busy ? 'Creando PDF…' : `Descargar PDF (${ls.length})`}</Button>
        </div>
        {err && <p className="app-muted" role="alert"><Badge tone="bad">PDF</Badge> {err}</p>}
        {ls.length ? <ul className="app-tag-strip">{ls.map((l) => <li key={l.d.pallet} className="yc-label-wrap"><PalletLabel d={l.d} qr={l.qr} sample={!listo} /></li>)}</ul>
          : <p className="app-muted">Este DN aún no tiene piezas con Pallet ID. Pónselo con «Editar» o en la Tabla de Pallets.</p>}
        <p className="app-muted">Imprime el PDF en tamaño real (100 %) con papel 4×6 in. Antes de usarlo en piso, escanea el código de barras y el QR de una etiqueta impresa.</p>
      </section>
      <dl className="app-tag-grid">
        {datos.map(([k, v]) => <div key={k} className="app-dato"><dt>{k}</dt><dd>{v === '' ? '—' : v}</dd></div>)}
        <div className="app-dato is-wide"><dt>hazmat</dt><dd>{it.hazmat || '—'}</dd></div>
      </dl>
      <div className="yc-table-wrap">
        <table className="yc-table">
          <thead><tr><th className="num">#</th><th>Serial</th><th>SN</th><th>Carton ID</th><th>Pallet ID</th></tr></thead>
          <tbody>{it.piezas.map((p, i) => <tr key={p.serial}><td className="num">{i + 1}</td><td className="code">{p.serial}</td><td className="code">{p.sn || '—'}</td><td className="code">{p.carton || '—'}</td><td className="code">{p.pallet || '—'}</td></tr>)}</tbody>
        </table>
      </div>
    </article>
  );
}

export default function Etiquetas() {
  const { items, sync } = usePallets(), listos = items.filter(paraImprimir), resto = items.filter((x) => !paraImprimir(x));
  useEffect(() => { sync(); }, [sync]); // los items de la base (otro equipo o sesión nueva)
  const [params, setParams] = useSearchParams(), [editar, setEditar] = useState<string>();
  const it = items.find((x) => x.dn === params.get('dn')) ?? listos[0] ?? items[0], ed = items.find((x) => x.dn === editar);
  return (
    <>
      <PageHead title="Etiquetas" sub="Una etiqueta 4×6 in por pallet de cada DN. Los DN sin completar se ven como vista previa (MUESTRA) y se pueden editar; el PDF sale con el DN completo." />
      {!it ? (
        <p className="yc-card app-empty">Aún no hay DN. Crea uno con <Link to="/pallets/carga">Nuevo Pallet / Shipping Order</Link>.</p>
      ) : (
        <div className="app-tags">
          <nav className="yc-card app-tags-list" aria-label="DN">
            {([['completos', listos], ['vista previa', resto]] as const).map(([t, xs]) => !!xs.length && (
              <div key={t} className="app-tags-sec">
                <p className="app-item-k">{xs.length} {t === 'completos' ? (xs.length === 1 ? 'DN listo para imprimir' : 'DN listos para imprimir') : 'en vista previa'}</p>
                <ul>{xs.map((x) => (
                  <li key={x.dn}><button type="button" aria-current={x.dn === it.dn || undefined} onClick={() => setParams({ dn: x.dn }, { replace: true })}>
                    <b>{x.dn}</b><span>{((n) => `${n} ${n === 1 ? 'pallet' : 'pallets'}`)(new Set(x.piezas.map((p) => p.pallet).filter(Boolean)).size)} · {x.so || 'sin SO'}</span>
                  </button></li>
                ))}</ul>
              </div>
            ))}
          </nav>
          <Hoja key={it.dn} it={it} onEdit={() => setEditar(it.dn)} />
        </div>
      )}
      {/* se busca en todos los items: si la edición lo deja incompleto, el diálogo sigue en el mismo DN */}
      {ed && <ItemDetalle it={ed} onClose={() => setEditar(undefined)} />}
    </>
  );
}
