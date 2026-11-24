// Etiqueta de tarima 4×6 in, en blanco y negro para impresora térmica. Escala con su contenedor (unidades cqw);
// al imprimir mide 4×6 in exactas. QR con todos los datos (`qr`) y Code128 del Pallet #.
import qrcode from 'qrcode-generator';
import { code128 } from '../lib/code128.ts';

export interface PalletLabelData {
  pallet: string; customer: string; destination: string; ref: string; dn: string; nvdn?: string; so: string; po: string; to: string;
  pn: string; desc?: string; qty: number; cartons: number; nw: string; gw: string; dims: string; coo: string; hts: string;
  battery?: string; shipDate: string; index: number; total: number;
  /** Etiqueta de prueba (modo ×9): sale con la marca PRUEBA, también impresa. */
  test?: boolean;
}
/** qr: QR grande y menos texto · text: más datos y QR mediano. */
export type LabelVariant = 'qr' | 'text';

/** Módulos del QR (nivel M: aguanta ~15 % de daño); `null` si el texto no cabe. */
export function qrModules(text: string) {
  try {
    const q = qrcode(0, 'M'); q.addData(text); q.make();
    const n = q.getModuleCount();
    return Array.from({ length: n }, (_, y) => Array.from({ length: n }, (_, x) => q.isDark(y, x)));
  } catch { return null; }
}

/** QR real con margen blanco de 4 módulos. */
export function Qr({ text }: { text: string }) {
  const m = qrModules(text);
  if (!m) return <p className="yc-label-k">QR: demasiados datos</p>;
  const n = m.length, rects = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (m[y][x]) rects.push(<rect key={`${x}.${y}`} x={x} y={y} width={1.02} height={1.02} />);
  return <svg className="yc-label-qr" viewBox={`-4 -4 ${n + 8} ${n + 8}`} role="img" aria-label="Código QR con los datos de la tarima">{rects}</svg>;
}

/** Code128 real con margen blanco de 10 módulos; si el texto trae algo que Code128 B no admite, no dibuja barras. */
export function Barcode({ text }: { text: string }) {
  let w: number[];
  try { w = code128(text); } catch { return <p className="yc-label-k">Código de barras: solo letras y números sin acento</p>; }
  let x = 10;
  const bars = w.map((bw, i) => { const r = i % 2 === 0 ? <rect key={i} x={x} y={0} width={bw} height={40} /> : null; x += bw; return r; });
  return <svg className="yc-label-bar" viewBox={`0 0 ${x + 10} 40`} preserveAspectRatio="none" role="img" aria-label={`Código de barras: ${text}`}>{bars}</svg>;
}

const Field = ({ k, v, wide }: { k: string; v: string | number; wide?: boolean }) => (
  <div className={`yc-label-f${wide ? ' is-wide' : ''}`}><span>{k}</span><b>{v}</b></div>
);

/** `qr`: el texto del QR (todos los datos y los seriales). `sample`: sello «MUESTRA» (no se imprime), para ejemplos. */
export function PalletLabel({ d, qr, variant = 'qr', sample = false }: { d: PalletLabelData; qr: string; variant?: LabelVariant; sample?: boolean }) {
  const all = variant === 'text';
  return (
    <article className={`yc-label is-${variant}`} aria-label={`Etiqueta de la tarima ${d.pallet}`}>
      <header className="yc-label-head">
        <div><span className="yc-label-k">Cliente</span><strong>{d.customer}</strong></div>
        <div className="is-right"><span className="yc-label-k">Destino</span><strong>{d.destination}</strong></div>
      </header>
      <section className="yc-label-pallet">
        <span className="yc-label-k">Pallet #</span>
        <strong>{d.pallet || '—'}</strong>
        {d.pallet ? <Barcode text={d.pallet} /> : <span className="yc-label-bar" aria-hidden />}
      </section>
      <section className="yc-label-grid">
        <Field k="Internal Ref" v={d.ref} wide />
        <Field k="DN" v={d.dn} /><Field k="NVIDIA DN" v={d.nvdn || '—'} />
        <Field k="SO" v={d.so} /><Field k="PO" v={d.po} />
        <Field k="Part number" v={d.pn} wide />
        {all && d.desc && <Field k="Descripción" v={d.desc} wide />}
        <Field k="Piezas" v={d.qty} /><Field k="Cajas" v={d.cartons} />
        <Field k="Peso neto" v={`${d.nw} kg`} /><Field k="Peso bruto" v={`${d.gw} kg`} />
        {all && <><Field k="T/O" v={d.to} /><Field k="Medidas (cm)" v={d.dims} /><Field k="COO" v={d.coo} /><Field k="HTS" v={d.hts} /><Field k="Fecha de envío" v={d.shipDate} wide /></>}
      </section>
      <footer className="yc-label-foot">
        <div className="yc-label-side">
          {d.battery && <p className="yc-label-battery">{d.battery}</p>}
          {!all && <p className="yc-label-k">COO {d.coo} · HTS {d.hts} · {d.dims} cm</p>}
          <p className="yc-label-count">Tarima <b>{d.index}</b> de <b>{d.total}</b>{d.test && <span className="yc-label-test">PRUEBA</span>}</p>
        </div>
        <div className="yc-label-code"><Qr text={qr} />{sample && <span className="yc-label-sample">MUESTRA</span>}</div>
      </footer>
    </article>
  );
}

/** El QR como imagen PNG (fondo blanco, margen de 4 módulos), para pegarlo o probar el lector. */
export function qrPng(text: string, px = 10): Promise<Blob> {
  const m = qrModules(text);
  if (!m) return Promise.reject(new Error('demasiados datos para un QR'));
  const n = m.length, size = (n + 8) * px, c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff'; g.fillRect(0, 0, size, size); g.fillStyle = '#000';
  m.forEach((r, y) => r.forEach((on, x) => on && g.fillRect((x + 4) * px, (y + 4) * px, px, px)));
  return new Promise((ok, ko) => c.toBlob((b) => (b ? ok(b) : ko(new Error('no se pudo crear la imagen'))), 'image/png'));
}

/** Lee el QR de una imagen (foto o captura). `null` si no encuentra uno. */
export async function readQrImage(file: File): Promise<string | null> {
  const { default: jsQR } = await import('jsqr');
  const img = await createImageBitmap(file), k = Math.min(1, 1600 / Math.max(img.width, img.height)); // fotos grandes: más rápido y igual de legible
  const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  const g = c.getContext('2d')!; g.drawImage(img, 0, 0, c.width, c.height);
  return jsQR(g.getImageData(0, 0, c.width, c.height).data, c.width, c.height)?.data ?? null;
}
