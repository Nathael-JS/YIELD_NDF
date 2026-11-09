import { useState } from 'react';
import { shortDay } from '../lib/tcqs.ts';
import { useData } from '../store.ts';
import ChartZoom from './ChartZoom.tsx';
import { NeedTcqs, PageHead } from './Layout.tsx';
import { slides, type Slide } from './slides.tsx';

export default function Graficos() {
  const { records, from, to } = useData();
  const [open, setOpen] = useState<Slide>();
  const list = records.length ? slides(records, 'dia', 'todas las estaciones') : [];
  return (
    <>
      <PageHead title="Gráficos" sub="Pareto · Barras · Líneas · Histograma · Dispersión, con los datos de Juliet. «Ampliar» abre la gráfica con sus datos y comentarios." />
      {list.length ? (
        <div className="app-charts">
          {list.map((s) => (
            <div key={s.id} className="app-zoomable">
              {s.content}
              <button type="button" className="yc-btn yc-btn-secondary app-zoom-btn" onClick={() => setOpen(s)} aria-label={`Ampliar: ${s.title}`}>⤢ Ampliar</button>
            </div>
          ))}
        </div>
      ) : <NeedTcqs />}
      {/* los comentarios van por gráfica y rango de fechas: con otro TCQS son otros datos */}
      {open && <ChartZoom slide={open} range={`${shortDay(from!)} – ${shortDay(to!)}`} grafica={`${open.id}|${from}|${to}`} onClose={() => setOpen(undefined)} />}
    </>
  );
}
