import { BarChart, Histogram, ParetoChart, ScatterPlot, TrendChart } from '../components/charts.tsx';
import { Badge } from '../components/ui.tsx';
import * as demo from '../data/demo.ts';
import { PageHead } from './Layout.tsx';

export default function Graficos() {
  return (
    <>
      <PageHead title="Gráficos" sub="Barras · Líneas y barras · Histograma · Dispersión"><Badge tone="info">Datos de ejemplo</Badge></PageHead>
      <div className="app-charts">
        <ParetoChart title="Fallas por estación funcional" level={1} data={demo.fails} />
        <ParetoChart title="Error codes en FT" level={2} data={demo.ftErrors} />
        <BarChart title="Resultados por estación" subtitle="Semana 43 · estaciones funcionales" yLabel="Unidades" categories={demo.stations} series={demo.results} />
        <TrendChart title="Evolución de FPY" subtitle="Últimas 6 semanas" yLabel="%" categories={demo.weeks} lines={demo.trendLines} targets={[{ value: 95, label: 'Meta FPY 95 %' }]} />
        <Histogram title="Tiempo de unidades en LC245" subtitle="Distribución por corrida · 60 unidades" xLabel="Horas en estación" values={demo.lc245Hours} />
        <ScatterPlot title="Unidades vs. fallas por estación" subtitle="Cada punto es una estación" xLabel="Unidades registradas" yLabel="Fallas" series={demo.scatter} />
      </div>
    </>
  );
}
