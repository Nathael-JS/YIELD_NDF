import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { shortDay } from '../lib/tcqs.ts';
import { useData } from '../store.ts';
import ChartZoom from './ChartZoom.tsx';
import { NeedTcqs, PageHead } from './Layout.tsx';
import { slides, type Slide } from './slides.tsx';

/** Cambio de vista animado por el navegador (View Transitions). Sin soporte o con «reducir movimiento», cambia al instante. */
function morph(update: () => void, after = () => {}) {
  if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) { update(); after(); return; }
  document.startViewTransition(update).finished.finally(after);
}

export default function Graficos() {
  const { records, from, to } = useData();
  const [open, setOpen] = useState<Slide>();
  const cards = useRef<Record<string, HTMLDivElement | null>>({});
  const list = records.length ? slides(records, 'dia', 'todas las estaciones') : [];
  // la tarjeta y la gráfica del panel comparten nombre de transición: el navegador anima una hacia la otra
  const name = (id: string, on: boolean) => { const el = cards.current[id]; if (el) el.style.viewTransitionName = on ? 'yc-zoom' : ''; };
  const zoomIn = (s: Slide) => { name(s.id, true); morph(() => { name(s.id, false); flushSync(() => setOpen(s)); }); };
  const zoomOut = () => { if (!open) return; const id = open.id; morph(() => { flushSync(() => setOpen(undefined)); name(id, true); }, () => name(id, false)); };
  return (
    <>
      <PageHead title="Gráficos" sub="Pareto · Barras · Líneas · Histograma · Dispersión, con los datos de Juliet. «Ampliar» abre la gráfica con sus datos y comentarios." />
      {list.length ? (
        <div className="app-charts">
          {list.map((s) => (
            <div key={s.id} ref={(el) => { cards.current[s.id] = el; }} className="app-zoomable">
              {s.content}
              <button type="button" className="yc-btn yc-btn-secondary app-zoom-btn" onClick={() => zoomIn(s)} aria-label={`Ampliar: ${s.title}`}>⤢ Ampliar</button>
            </div>
          ))}
        </div>
      ) : <NeedTcqs />}
      {/* los comentarios van por gráfica y rango de fechas: con otro TCQS son otros datos */}
      {open && <ChartZoom slide={open} range={`${shortDay(from!)} – ${shortDay(to!)}`} grafica={`${open.id}|${from}|${to}`} onClose={zoomOut} />}
    </>
  );
}
