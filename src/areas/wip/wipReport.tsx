// Reporte WIP descargable en HTML: resumen y semáforo, flujo por estación, urgentes y bloqueadas, y por orden.
import { renderToStaticMarkup } from 'react-dom/server';
import type { Pieza } from '../../lib/wip.ts';
import { htmlDoc } from '../../pages/report.tsx';
import { FlowTable, Kpis, Legend, OrderTable, UnitTable, type Orden, type St } from './wipParts.tsx';

export interface WipReport { title: string; sub: string; ps: Pieza[]; st: St[]; criticas: Pieza[]; os: Orden[]; nota: string }

// lo único con JavaScript: buscar en las tablas (serial, orden, estación), sin distinguir mayúsculas
const SCRIPT = `document.querySelector('[data-filter]').oninput = (e) => { const q = e.target.value.trim().toLowerCase(); document.querySelectorAll('[data-search] tbody tr:not(.app-wip-sec)').forEach((r) => r.hidden = q && !r.textContent.toLowerCase().includes(q)); };`;

export function wipHtml({ title, sub, ps, st, criticas, os, nota }: WipReport) {
  const body = renderToStaticMarkup(
    <main className="app-main">
      <header className="app-head">
        <div><span className="app-eyebrow">Yield Control · reporte WIP</span><h1>{title}</h1><p>{sub}</p></div>
        <label className="yc-field">Buscar<input className="yc-input" data-filter placeholder="Serial, orden, estación… (flujo y urgentes)" /></label>
      </header>
      <Kpis ps={ps} />
      <section className="yc-card app-wip" aria-label="Flujo por estación" data-search>
        <header className="app-wip-head"><h2 className="app-h3">Flujo por estación</h2><Legend /></header>
        <FlowTable st={st} />
      </section>
      <section className="yc-card app-wip" aria-label="Urgentes y bloqueadas" data-search>
        <header className="app-wip-head"><h2 className="app-h3">Urgentes (&gt; 100 h) y bloqueadas · {criticas.length}</h2></header>
        {criticas.length ? <div className="yc-table-wrap"><UnitTable ps={criticas} station /></div> : <p className="app-muted">Ninguna.</p>}
      </section>
      <section className="yc-card app-wip" aria-label="Por orden">
        <header className="app-wip-head"><h2 className="app-h3">Por orden</h2></header>
        <OrderTable os={os} />
      </section>
      <p className="app-muted">{nota} Generado el {new Date().toLocaleString('es-MX')}.</p>
    </main>,
  );
  return htmlDoc(title, body, SCRIPT);
}
