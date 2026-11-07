import { Link } from 'react-router-dom';
import { BarChart, Histogram, ParetoChart, ScatterPlot } from '../components/charts.tsx';
import { Badge, ChartCarousel, FileChip, KpiTile } from '../components/ui.tsx';
import * as demo from '../data/demo.ts';
import { FILE_TYPES, useApp } from '../store.ts';
import { PageHead } from './Layout.tsx';

export default function Inicio() {
  const { files } = useApp();
  return (
    <>
      <PageHead title="Resumen de la semana 43" sub="Vista simple de los datos cargados. Elige un paso del menú para comparar, validar o hacer match.">
        <Badge tone="info">Datos de ejemplo</Badge>
      </PageHead>
      <div className="yc-grid-kpi">
        <KpiTile label="Yield" value="97.4" unit="%" delta={1.2} deltaUnit=" pts" />
        <KpiTile label="WIP" value="418" delta={36} good={false} />
        <KpiTile label="Unidades" value="2,960" delta={140} />
        <KpiTile label="Porcentaje liberado" value="88.1" unit="%" delta={-0.6} deltaUnit=" pts" good={false} />
      </div>
      <ChartCarousel slides={[
        { kind: 'Líneas y barras', title: 'Pareto 1er nivel', content: <ParetoChart title="Fallas por estación funcional" level={1} data={demo.fails} /> },
        { kind: 'Líneas y barras', title: 'Pareto 2do nivel · FT', content: <ParetoChart title="Error codes en FT" level={2} data={demo.ftErrors} /> },
        { kind: 'Barras', title: 'Resultados por estación', content: <BarChart title="Resultados por estación" subtitle="Semana 43 · estaciones funcionales" yLabel="Unidades" categories={demo.stations} series={demo.results} /> },
        { kind: 'Histograma', title: 'Tiempo en LC245', content: <Histogram title="Tiempo de unidades en LC245" subtitle="Distribución por corrida · 60 unidades" xLabel="Horas en estación" values={demo.lc245Hours} /> },
        { kind: 'Dispersión', title: 'Relación TCQS · DATA ANALYSIS · QM', content: <ScatterPlot title="Unidades vs. fallas por estación" subtitle="Cómo coinciden los 3 archivos · cada punto es una estación" xLabel="Unidades registradas" yLabel="Fallas" series={demo.scatter} /> },
      ]} />
      <section className="app-files" aria-label="Archivos de la sesión">
        {FILE_TYPES.map((t) => (
          <Link key={t} to="/carga" className="app-file-link">
            <FileChip type={t} status={files[t] ? 'loaded' : 'empty'} meta={files[t] ? `${files[t].rows.length} filas · ${files[t].name}` : 'Sin cargar · ir a Carga de datos'} />
          </Link>
        ))}
      </section>
    </>
  );
}
