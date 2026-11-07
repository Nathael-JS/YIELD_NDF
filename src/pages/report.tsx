// Reporte HTML descargable: un solo archivo con estilos y datos dentro; carrusel y buscador funcionan sin internet.
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import appCss from '../styles/app.css?inline';
import tokensCss from '../styles/tokens.css?inline';
import ycCss from '../styles/yc.css?inline';
import type { Slide } from './slides.tsx';

// Lo único con JavaScript en el archivo: mover el carrusel (botones, puntos, ← →) y filtrar la tabla.
const SCRIPT = `(() => {
  const slides = [...document.querySelectorAll('[data-slide]')], dots = [...document.querySelectorAll('[data-dot]')];
  const kind = document.querySelector('[data-show-kind]'), title = document.querySelector('[data-show-title]'), count = document.querySelector('[data-count]');
  let i = 0;
  function show(k) {
    const dir = k < i ? 'is-prev' : 'is-next';
    i = (k + slides.length) % slides.length;
    slides.forEach((s, j) => { s.hidden = j !== i; s.classList.remove('is-next', 'is-prev'); });
    void slides[i].offsetWidth; slides[i].classList.add(dir);
    dots.forEach((d, j) => { d.classList.toggle('is-on', j === i); d.setAttribute('aria-current', j === i ? 'true' : 'false'); });
    kind.textContent = slides[i].dataset.kind; title.textContent = slides[i].dataset.title; count.textContent = (i + 1) + ' / ' + slides.length;
  }
  // como en la app: arrastrar más de 60 px cambia de gráfica; un clic sin arrastrar avanza o retrocede según el lado
  const track = document.querySelector('.yc-carousel-track');
  let from = null;
  const drag = (x) => { const s = slides[i]; s.classList.toggle('is-dragging', !!x); s.style.transform = x ? 'translateX(' + x + 'px)' : ''; };
  track.onpointerdown = (e) => { from = e.clientX; track.setPointerCapture(e.pointerId); };
  track.onpointermove = (e) => { if (from != null) drag(e.clientX - from); };
  track.onpointerup = (e) => {
    if (from == null) return;
    const d = e.clientX - from, box = track.getBoundingClientRect();
    from = null; drag(0);
    if (Math.abs(d) > 60) show(d < 0 ? i + 1 : i - 1);
    else if (Math.abs(d) < 6) show(e.clientX > box.left + box.width / 2 ? i + 1 : i - 1);
  };
  dots.forEach((d, j) => d.onclick = () => show(j));
  document.querySelector('.yc-carousel').onkeydown = (e) => { if (e.key === 'ArrowRight') show(i + 1); if (e.key === 'ArrowLeft') show(i - 1); };
  // sin distinguir mayúsculas ni acentos: «critico» encuentra «Crítico»
  const plain = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const rows = [...document.querySelectorAll('tbody tr')];
  document.querySelector('[data-filter]').oninput = (e) => { const q = plain(e.target.value.trim()); rows.forEach((r) => r.hidden = !plain(r.textContent).includes(q)); };
})();`;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export function reportHtml({ title, sub, kpis, slides, table }: { title: string; sub: string; kpis: ReactNode; slides: Slide[]; table: ReactNode }) {
  const body = renderToStaticMarkup(
    <main className="app-main">
      <header className="app-head"><div><span className="app-eyebrow">Yield Control · reporte</span><h1>{title}</h1><p>{sub}</p></div></header>
      <div className="yc-grid-kpi">{kpis}</div>
      <section className="yc-carousel" aria-roledescription="carrusel" aria-label="Gráficas: arrastra, haz clic a un lado o usa ← →" tabIndex={0}>
        <header className="yc-carousel-head">
          <div><span className="yc-carousel-kind" data-show-kind>{slides[0]?.kind}</span><h3 className="yc-carousel-title" data-show-title>{slides[0]?.title}</h3></div>
          <div className="yc-carousel-ctrl">
            <span className="yc-carousel-hint" aria-hidden>Arrastra o haz clic a un lado</span>
            <span className="yc-carousel-count" aria-live="polite" data-count>1 / {slides.length}</span>
          </div>
        </header>
        <div className="yc-carousel-track">
          {slides.map((s, k) => <div key={s.id} className="yc-carousel-body" data-slide data-kind={s.kind} data-title={s.title} hidden={k > 0}>{s.content}</div>)}
        </div>
        <div className="yc-carousel-dots">
          {slides.map((s, k) => <button key={s.id} type="button" className={`yc-dot${k ? '' : ' is-on'}`} aria-label={s.title} data-dot />)}
        </div>
      </section>
      <label className="yc-field">Buscar estación<input className="yc-input" data-filter placeholder="FT, J_TAG, Crítico…" /></label>
      {table}
      <p className="app-muted">Generado el {new Date().toLocaleString('es-MX')} · Fórmulas según la guía YieldRateSFC y RetestRate.</p>
    </main>,
  );
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title><style>${tokensCss}${ycCss}${appCss}</style></head>
<body>${body}<script>${SCRIPT}</script></body></html>`;
}
