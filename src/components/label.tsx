// Etiqueta de tarima 4×6 in, en blanco y negro para impresora térmica. Escala con su contenedor (unidades cqw);
// al imprimir mide 4×6 in exactas. El QR y el Code128 son DE MUESTRA (patrón fijo): los reales llegan en la fase B.

export interface PalletLabelData {
  pallet: string; customer: string; destination: string; ref: string; dn: string; so: string; po: string; to: string;
  pn: string; desc?: string; qty: number; cartons: number; nw: string; gw: string; dims: string; coo: string; hts: string;
  battery?: string; shipDate: string; index: number; total: number;
}
/** qr: QR grande y menos texto · text: más datos y QR mediano. */
export type LabelVariant = 'qr' | 'text';

/** Patrón estable a partir de un texto (para que la muestra no cambie en cada pintada). */
function bits(seed: string, n: number) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return Array.from({ length: n }, () => ((h = Math.imul(h ^ (h >>> 13), 1274126177)) >>> 0) % 7 < 3);
}

/** QR de muestra: 25×25 con los tres cuadros de posición; no se puede escanear. */
export function SampleQr({ seed }: { seed: string }) {
  const N = 25, on = bits(seed, N * N);
  const finder = (x: number, y: number) => { const d = Math.max(Math.abs(x - 3), Math.abs(y - 3)); return d === 3 || d <= 1; };
  const cell = (x: number, y: number) => {
    if (x < 8 && y < 8) return x < 7 && y < 7 && finder(x, y);
    if (x > N - 9 && y < 8) return x > N - 8 && y < 7 && finder(x - (N - 7), y);
    if (x < 8 && y > N - 9) return x < 7 && y > N - 8 && finder(x, y - (N - 7));
    return on[y * N + x];
  };
  const rects = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (cell(x, y)) rects.push(<rect key={`${x}.${y}`} x={x} y={y} width={1.02} height={1.02} />);
  return <svg className="yc-label-qr" viewBox={`-4 -4 ${N + 8} ${N + 8}`} role="img" aria-label="Código QR de muestra">{rects}</svg>;
}

/** Code128 de muestra: barras de ancho 1–4 a partir del texto, con margen blanco de 10 módulos. */
export function SampleBarcode({ text }: { text: string }) {
  const w = bits(text, 60).map((b, i) => 1 + ((b ? 2 : 0) + (i % 3 === 0 ? 1 : 0)));
  let x = 10;
  const bars = w.map((bw, i) => { const r = i % 2 === 0 ? <rect key={i} x={x} y={0} width={bw} height={40} /> : null; x += bw; return r; });
  return <svg className="yc-label-bar" viewBox={`0 0 ${x + 10} 40`} preserveAspectRatio="none" role="img" aria-label={`Código de barras de muestra: ${text}`}>{bars}</svg>;
}

const Field = ({ k, v, wide }: { k: string; v: string | number; wide?: boolean }) => (
  <div className={`yc-label-f${wide ? ' is-wide' : ''}`}><span>{k}</span><b>{v}</b></div>
);

export function PalletLabel({ d, variant = 'qr', sample = true }: { d: PalletLabelData; variant?: LabelVariant; sample?: boolean }) {
  const all = variant === 'text';
  return (
    <article className={`yc-label is-${variant}`} aria-label={`Etiqueta de la tarima ${d.pallet}`}>
      <header className="yc-label-head">
        <div><span className="yc-label-k">Cliente</span><strong>{d.customer}</strong></div>
        <div className="is-right"><span className="yc-label-k">Destino</span><strong>{d.destination}</strong></div>
      </header>
      <section className="yc-label-pallet">
        <span className="yc-label-k">Pallet #</span>
        <strong>{d.pallet}</strong>
        <SampleBarcode text={d.pallet} />
      </section>
      <section className="yc-label-grid">
        <Field k="Internal Ref" v={d.ref} wide />
        <Field k="DN" v={d.dn} /><Field k="SO" v={d.so} />
        <Field k="PO" v={d.po} /><Field k="T/O" v={d.to} />
        <Field k="Part number" v={d.pn} wide />
        {all && d.desc && <Field k="Descripción" v={d.desc} wide />}
        <Field k="Piezas" v={d.qty} /><Field k="Cajas" v={d.cartons} />
        <Field k="Peso neto" v={`${d.nw} kg`} /><Field k="Peso bruto" v={`${d.gw} kg`} />
        {all && <><Field k="Medidas (cm)" v={d.dims} /><Field k="COO" v={d.coo} /><Field k="HTS" v={d.hts} /><Field k="Fecha de envío" v={d.shipDate} /></>}
      </section>
      <footer className="yc-label-foot">
        <div className="yc-label-side">
          {d.battery && <p className="yc-label-battery">{d.battery}</p>}
          {!all && <p className="yc-label-k">COO {d.coo} · HTS {d.hts} · {d.dims} cm</p>}
          <p className="yc-label-count">Tarima <b>{d.index}</b> de <b>{d.total}</b></p>
        </div>
        <div className="yc-label-code"><SampleQr seed={`${d.pallet}|${d.dn}|${d.qty}`} />{sample && <span className="yc-label-sample">MUESTRA</span>}</div>
      </footer>
    </article>
  );
}
