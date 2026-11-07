import { useNavigate } from 'react-router-dom';
import { Badge, Button, ChartCarousel, KpiTile } from '../components/ui.tsx';
import { by, rty, shortDay, totals } from '../lib/tcqs.ts';
import { useData } from '../store.ts';
import { PageHead } from './Layout.tsx';
import { slides } from './slides.tsx';

const p1 = (n: number) => n.toFixed(1);

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
  return (
    <>
      <PageHead title="Resumen de Juliet" sub={`${shortDay(from!)} – ${shortDay(to!)} · ${records.length.toLocaleString('es-MX')} registros del TCQS`}>
        {!models && <Badge tone="warn">Sin filtro de proyecto</Badge>}
        <Button onClick={() => go('/yield')}>Ver detalle</Button>
      </PageHead>
      <div className="yc-grid-kpi">
        <KpiTile label="Entradas" value={t.input.toLocaleString('es-MX')} />
        <KpiTile label="FPY" value={p1(t.fpy)} unit="%" />
        <KpiTile label="Final Yield" value={p1(t.final)} unit="%" />
        <KpiTile label="RTY" value={p1(rty(by(records, (r) => r.group)))} unit="%" />
      </div>
      <ChartCarousel slides={slides(records, 'dia', 'todas las estaciones')} />
    </>
  );
}
