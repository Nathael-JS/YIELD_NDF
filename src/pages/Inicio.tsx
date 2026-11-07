import { Link, useNavigate } from 'react-router-dom';
import { Badge, Button, ChartCarousel, KpiTile } from '../components/ui.tsx';
import { by, byFpy, diagnose, pctText, rty, shortDay, totals } from '../lib/tcqs.ts';
import { useData } from '../store.ts';
import { PageHead } from './Layout.tsx';
import { slides } from './slides.tsx';

const n = (v: number) => v.toLocaleString('es-MX');
const ACTION = { bad: 'Falla real del proceso: revisar la estación.', warn: 'Se recupera en retest sin reparar: revisar fixture, puntas o tester.' };

export default function Inicio() {
  const { records, models, from, to } = useData();
  const go = useNavigate();
  if (!records.length) return (
    <>
      <PageHead title="Yield Control" sub="Carga el TCQS y el Excel de modelos del proyecto para ver yield, fallas y tendencias." />
      <section className="yc-card app-start">
        <h2 className="app-h3">Empieza en tres pasos</h2>
        <ol className="app-muted">
          <li>Carga el TCQS (.csv o .xlsx) y el Excel con los modelos de Juliet.</li>
          <li>Revisa en Validación qué filas y modelos entran.</li>
          <li>Ve el yield por estación, el Pareto y la tendencia.</li>
        </ol>
        <Button variant="primary" onClick={() => go('/carga')}>Cargar archivos</Button>
      </section>
    </>
  );
  const t = totals(records);
  const st = by(records, (r) => r.group).filter((s) => s.input > 0);
  // primero lo crítico, luego las posibles falsas fallas; dentro, peor FPY primero
  const watch = st.map((s) => ({ ...s, dx: diagnose(s) })).filter((s) => s.dx[1] === 'bad' || s.dx[1] === 'warn')
    .sort((a, b) => (a.dx[1] === b.dx[1] ? byFpy(a, b) : a.dx[1] === 'bad' ? -1 : 1)).slice(0, 3);
  return (
    <>
      <section className="app-hero">
        <span className="app-eyebrow">Proyecto Juliet · {shortDay(from!)} – {shortDay(to!)}</span>
        <h1>FPY de <span className="app-hero-num">{pctText(t.fpy)}%</span> en {n(t.input)} entradas</h1>
        <p>Final Yield {pctText(t.final)} %: {pctText(t.retest)} % se recupera en retest. {watch.length ? `${watch.length === 1 ? 'Una estación pide' : `${watch.length} estaciones piden`} atención.` : 'Todas las estaciones con muestra suficiente están en meta.'}</p>
        <div className="yc-row">
          <Button variant="primary" onClick={() => go('/yield')}>Ver yield por estación</Button>
          <Button onClick={() => go('/carga')}>Cargar otro TCQS</Button>
          {!models && <Badge tone="warn">Sin filtro de proyecto</Badge>}
        </div>
      </section>

      <div className="yc-grid-kpi">
        <KpiTile label="Entradas" value={n(t.input)} />
        <KpiTile label="FPY" value={pctText(t.fpy)} unit="%" />
        <KpiTile label="Final Yield" value={pctText(t.final)} unit="%" />
        <KpiTile label="RTY" value={pctText(rty(st))} unit="%" />
      </div>

      {watch.length > 0 && (
        <section aria-labelledby="watch">
          <h2 id="watch" className="app-section-title">Dónde mirar primero</h2>
          <div className="app-watch">
            {watch.map((s) => (
              <Link key={s.name} to={{ pathname: '/yield', hash: encodeURIComponent(s.name) }} className="yc-card app-watch-card">
                <span className="app-watch-head"><span className="app-mono">{s.name}</span><Badge tone={s.dx[1]}>{s.dx[0]}</Badge></span>
                <span className="yc-kpi-value">{pctText(s.fpy)}<span className="yc-kpi-unit">% FPY</span></span>
                <span className="app-muted">{n(s.ff)} primeras fallas de {n(s.input)} entradas · Final {pctText(s.final)} %</span>
                <span className="app-muted">{ACTION[s.dx[1] as 'bad' | 'warn']}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="charts">
        <h2 id="charts" className="app-section-title">Gráficas</h2>
        <ChartCarousel slides={slides(records, 'dia', 'todas las estaciones')} />
      </section>
    </>
  );
}
