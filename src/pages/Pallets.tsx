// Pallets · FASE A (diseño): datos de ejemplo tomados del listado (download) y del shipping report.
// shortcut: todo es de muestra y vive en memoria; la lectura de archivos, la base y el QR real son la fase B.
import { useState } from 'react';
import { Badge, Button, Segmented, SerialInput } from '../components/ui.tsx';
import { PalletLabel, type LabelVariant, type PalletLabelData } from '../components/label.tsx';
import { PageHead } from './Layout.tsx';

type Entrega = { dn: string; so: string; to: string; po: string; model: string; desc: string; qty: number; customer: string; destination: string; loose: string };
// del listado de entregas (download_25.xlsx) y del shipping report (FINISH GOOD)
const ENTREGAS: Entrega[] = [
  { dn: '5278000047', so: '2683000058', to: '1687795', po: '73593605', model: 'SA029400', desc: 'JULIET NSO GB300 SWITCH MANAGED SA PS VI', qty: 36, customer: 'NVIDIA', destination: 'Yokneam · IL', loose: '1 caja suelta' },
  { dn: '5278000048', so: '2683000059', to: '1687796', po: '73593605', model: 'SA029400', desc: 'JULIET NSO GB300 SWITCH MANAGED SA PS VI', qty: 21, customer: 'NVIDIA', destination: 'Yokneam · IL', loose: '1 caja suelta' },
  { dn: '5276000000', so: '2682000001', to: '1618133', po: '87728644', model: '692-9K33R-00MV-GDL', desc: 'Switch 692-9K33R', qty: 7, customer: 'NVIDIA', destination: 'Israel · IL', loose: '1 tarima · 7 cajas' },
];

type Campo = { key: string; label: string; listado?: boolean; req?: boolean; mono?: boolean };
/** Las áreas del shipping report (renglón 1 del Excel): quién llena cada campo. */
const AREAS: { id: string; name: string; hint: string; campos: Campo[] }[] = [
  { id: 'shipping', name: 'Shipping', hint: 'Solicitud, transporte y cierre', campos: [
    { key: 'ref', label: 'Internal Ref', req: true, mono: true }, { key: 'to', label: 'T/O', listado: true, mono: true }, { key: 'truckHour', label: 'Hora de solicitud de truck' },
    { key: 'carrier', label: 'Carrier' }, { key: 'plates', label: 'Truck # / placas' }, { key: 'hts', label: 'HTS code', req: true, mono: true },
  ] },
  { id: 'fulfillment', name: 'Fulfillment', hint: 'Orden, producto y cantidades', campos: [
    { key: 'dn', label: 'FXNN DN', listado: true, req: true, mono: true }, { key: 'so', label: 'FXNN SO', listado: true, req: true, mono: true }, { key: 'po', label: 'PO del cliente', listado: true, req: true, mono: true },
    { key: 'pn', label: 'Part number', listado: true, req: true, mono: true }, { key: 'qty', label: 'Piezas', listado: true, req: true }, { key: 'cartons', label: 'Cajas', req: true },
    { key: 'coo', label: 'COO', req: true }, { key: 'battery', label: 'Nota de batería' }, { key: 'incoterm', label: 'Incoterm' },
  ] },
  { id: 'itc', name: 'ITC', hint: 'Tarima, medidas, pesos y sellos', campos: [
    { key: 'pallet', label: 'Pallet #', req: true, mono: true }, { key: 'dims', label: 'Medidas L×A×H (cm)', req: true }, { key: 'nw', label: 'Peso neto (kg)', req: true },
    { key: 'gw', label: 'Peso bruto (kg)', req: true }, { key: 'seal', label: 'Sello Foxconn' }, { key: 'dock', label: 'Dock #' }, { key: 'shipDate', label: 'Fecha de envío', req: true },
  ] },
];
const VARIANTES = [{ value: 'qr' as const, label: 'QR grande' }, { value: 'text' as const, label: 'Más texto' }];

const inicial = (e: Entrega): Record<string, string> => ({
  dn: e.dn, so: e.so, to: e.to, po: e.po, pn: e.model, qty: String(e.qty), coo: 'MX', hts: '8517.62.0090', ref: '', cartons: '', pallet: '',
  dims: '120 × 80 × 115', nw: '', gw: '', battery: 'Contiene batería · UN3091, PI 970, Section II', shipDate: '2026-11-24', incoterm: 'FCA Factory',
});
// tarima de ejemplo casi completa (PALFX98195 del shipping report), para ver el estado «lista»
const EJEMPLO = { ref: 'FGNS-20260805-001', cartons: '7', pallet: 'PALFX98195', nw: '158.2', gw: '175', carrier: 'DUARTE', dock: '19' };
const SERIALES = ['MT262770000T', 'MT262770000L', 'MT262770000M', 'MT262770000N', 'MT262770000P', 'MT262770000R'];

export default function Pallets() {
  const [q, setQ] = useState(''), [sel, setSel] = useState(2);
  const [v, setV] = useState<Record<string, string>>(() => ({ ...inicial(ENTREGAS[2]), ...EJEMPLO }));
  const [serials, setSerials] = useState<string[]>(SERIALES);
  const [variant, setVariant] = useState<LabelVariant>('qr'), [printed, setPrinted] = useState(false);
  const e = ENTREGAS[sel];
  const pick = (i: number) => { setSel(i); setV(inicial(ENTREGAS[i])); setSerials([]); setPrinted(false); };
  const set = (k: string, val: string) => { setV((o) => ({ ...o, [k]: val })); setPrinted(false); };
  const qty = Number(v.qty) || 0;
  const faltan = AREAS.flatMap((a) => a.campos).filter((c) => c.req && !v[c.key]?.trim());
  const pesoMal = Number(v.gw) > 0 && Number(v.nw) > Number(v.gw);
  const listo = !faltan.length && serials.length === qty && !pesoMal;
  const estado: [string, 'ok' | 'warn' | 'info'] = printed ? ['Impresa', 'info'] : listo ? ['Lista para imprimir', 'ok'] : ['Incompleta', 'warn'];
  const label: PalletLabelData = {
    pallet: v.pallet || 'PALFX—', customer: e.customer, destination: e.destination, ref: v.ref || '—', dn: v.dn, so: v.so, po: v.po, to: v.to, pn: v.pn, desc: e.desc,
    qty, cartons: Number(v.cartons) || 0, nw: v.nw || '—', gw: v.gw || '—', dims: v.dims, coo: v.coo, hts: v.hts, battery: v.battery, shipDate: v.shipDate, index: 1, total: 1,
  };
  const list = ENTREGAS.map((x, i) => [x, i] as const).filter(([x]) => !q || `${x.dn} ${x.model} ${x.so}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <PageHead title="Pallets" sub="Arma la tarima con los datos del listado de entregas, captura sus seriales e imprime la etiqueta 4×6 in.">
        <Badge tone="info">Diseño · datos de ejemplo</Badge>
      </PageHead>
      <div className="app-pal">
        <aside className="yc-card app-pal-list" aria-label="Entregas del listado">
          <header><h2 className="app-h3">Entregas</h2><span className="app-muted">{ENTREGAS.length} del listado</span></header>
          <label className="yc-field"><span className="yc-sr-only">Buscar entrega</span><input className="yc-input" type="search" placeholder="DN, SO o modelo…" value={q} onChange={(x) => setQ(x.target.value)} /></label>
          <ul>
            {list.map(([x, i]) => (
              <li key={x.dn}>
                <button type="button" className="app-pal-dn" aria-current={i === sel || undefined} onClick={() => pick(i)}>
                  <span className="app-mono">DN {x.dn}</span>
                  <strong>{x.model}</strong>
                  <span className="app-muted">{x.qty} pzas · {x.destination}</span>
                  <span className="app-muted">{x.loose}</span>
                </button>
              </li>
            ))}
            {!list.length && <li className="app-muted">Ninguna entrega con «{q}».</li>}
          </ul>
        </aside>

        <section className="app-pal-form" aria-label="Tarima">
          <header className="yc-card app-pal-status">
            <div>
              <span className="yc-kpi-label">Tarima de la entrega</span>
              <strong className="app-mono">DN {e.dn}</strong>
              <span className="app-muted">{e.desc}</span>
            </div>
            <Badge tone={estado[1]}>{estado[0]}</Badge>
          </header>
          {AREAS.map((a, n) => {
            const done = a.campos.filter((c) => v[c.key]?.trim()).length;
            return (
              <details key={a.id} className="yc-card app-pal-area" open={n < 2}>
                <summary>
                  <span><strong>{a.name}</strong><span className="app-muted"> · {a.hint}</span></span>
                  <span className="app-pal-prog" aria-label={`${done} de ${a.campos.length} campos`}>
                    <span className="app-pal-bar"><i style={{ width: `${(done / a.campos.length) * 100}%` }} /></span>{done} / {a.campos.length}
                  </span>
                </summary>
                <div className="app-pal-fields">
                  {a.campos.map((c) => (
                    <label key={c.key} className={`yc-field${c.listado ? ' is-listado' : ''}`}>
                      <span>{c.label}{c.req && <span className="app-pal-req" aria-label="obligatorio"> *</span>}{c.listado && <Badge tone="info">del listado</Badge>}</span>
                      <input className={`yc-input${c.mono ? ' yc-mono' : ''}`} value={v[c.key] ?? ''} onChange={(x) => set(c.key, x.target.value)} aria-invalid={(c.key === 'nw' && pesoMal) || undefined} />
                    </label>
                  ))}
                  {a.id === 'itc' && pesoMal && <p className="app-pal-err" role="alert">El peso neto no puede ser mayor que el bruto.</p>}
                </div>
              </details>
            );
          })}
          <section className="yc-card app-pal-area app-pal-serials" aria-label="Seriales">
            <SerialInput key={sel} value={serials} onChange={(s) => { setSerials(s); setPrinted(false); }} expected={qty} label="Seriales de la tarima" />
            {qty > 0 && serials.length !== qty && <p className="app-muted">{serials.length < qty ? `Faltan ${qty - serials.length} seriales para cuadrar con las piezas.` : `Sobran ${serials.length - qty} seriales.`}</p>}
          </section>
        </section>

        <aside className="app-pal-preview" aria-label="Vista previa de la etiqueta">
          <div className="yc-card app-pal-side">
            <header><h2 className="app-h3">Etiqueta 4×6 in</h2><Segmented label="Variante" options={VARIANTES} value={variant} onChange={setVariant} /></header>
            <div className="yc-label-wrap yc-label-print" key={JSON.stringify(label) + variant}><PalletLabel d={label} variant={variant} /></div>
            {!listo && <p className="app-muted">{faltan.length ? `Faltan ${faltan.length} campos obligatorios: ${faltan.slice(0, 3).map((c) => c.label).join(', ')}${faltan.length > 3 ? '…' : ''}.` : serials.length !== qty ? 'Los seriales no cuadran con las piezas.' : 'Revisa los pesos.'}</p>}
            <div className="yc-row">
              <Button variant="primary" disabled={!listo} onClick={() => { window.print(); setPrinted(true); }}>Imprimir</Button>
              <Button disabled title="Fase B: PDF del tamaño exacto">Descargar PDF</Button>
            </div>
            <p className="app-muted">El QR y el código de barras son de muestra; los reales llevan todos los datos y los seriales.</p>
          </div>
        </aside>
      </div>
    </>
  );
}
