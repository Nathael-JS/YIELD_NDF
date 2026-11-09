// Gráficas del TCQS; las usan Inicio (carrusel), Gráficos (cuadrícula) y Yield.
import { BarChart, Histogram, ParetoChart, ScatterPlot, TrendChart } from '../components/charts.tsx';
import type { CarouselSlide } from '../components/ui.tsx';
import { by, byFpy, META_FPY, periodOf, type Grain, type Rec } from '../lib/tcqs.ts';

const r1 = (n: number) => Math.round(n * 10) / 10;
const meta = [{ value: META_FPY, label: `Meta FPY ${META_FPY} %` }];

/** Los datos que dibuja la gráfica, en tabla (vista ampliada de Gráficos). */
export interface Summary { head: string[]; rows: (string | number)[][] }
export type Slide = CarouselSlide & { id: string; summary: Summary };
const pc = (n: number) => (Number.isFinite(n) ? `${r1(n)} %` : '—');
/** Barras del Pareto con su % y % acumulado. */
function paretoRows(d: { label: string; value: number }[]) {
  const total = d.reduce((a, x) => a + x.value, 0) || 1;
  let cum = 0;
  return [...d].sort((a, b) => b.value - a.value).map((x) => { cum += x.value; return [x.label, x.value, pc((x.value / total) * 100), pc((cum / total) * 100)]; });
}

export function slides(rs: Rec[], grain: Grain, scope: string): Slide[] {
  // solo grupos con entradas: entradas 0 es «sin dato», no 0 % (guía, regla 2)
  const st = by(rs, (r) => r.group).filter((s) => s.input > 0).sort(byFpy); // peor estación primero
  const fails = st.filter((s) => s.ff > 0).map((s) => ({ label: s.name, value: s.ff }));
  const top = [...fails].sort((a, b) => b.value - a.value)[0]?.label;
  const testers = top ? by(rs.filter((r) => r.group === top), (r) => r.tester).filter((t) => t.ff > 0).map((t) => ({ label: t.name, value: t.ff })) : [];
  const labels = new Map(rs.map((r) => periodOf(r.date, grain)));
  const periods = by(rs, (r) => periodOf(r.date, grain)[0]).filter((p) => p.input > 0).sort((a, b) => (a.name < b.name ? -1 : 1));
  const testerSt = by(rs, (r) => r.tester).filter((t) => t.input > 0).sort(byFpy), testerFpy = testerSt.map((t) => r1(t.fpy));
  const bars = { title: 'FPY y Final Yield por estación', subtitle: `${scope} · de peor a mejor FPY`, yLabel: '%', categories: st.map((s) => s.name), targets: meta,
    series: [{ name: 'FPY', tone: 'pass' as const, values: st.map((s) => r1(s.fpy)) }, { name: 'Final Yield', tone: 'second' as const, values: st.map((s) => r1(s.final)) }] };
  // apaisada (columnas a lo ancho) en pantallas anchas; en el celular, barras acostadas con el nombre completo.
  // Las dos van en el HTML y el CSS muestra una: así también funciona en el reporte descargable, sin JavaScript.
  const stations = <><div className="app-wide"><BarChart {...bars} /></div><div className="app-narrow"><BarChart horizontal {...bars} /></div></>;
  const out: (Slide | false)[] = [
    fails.length > 0 && { id: 'pareto', kind: 'Líneas y barras', title: 'Pareto 1er nivel',
      content: <ParetoChart title="Primeras fallas por estación" level={1} subtitle={`1er nivel · ${scope}`} data={fails} />,
      summary: { head: ['Estación', '1ras fallas', '%', '% acumulado'], rows: paretoRows(fails) } },
    testers.length > 0 && { id: 'pareto2', kind: 'Líneas y barras', title: `Pareto 2do nivel · ${top}`,
      content: <ParetoChart title={`Primeras fallas por tester en ${top}`} level={2} subtitle="2do nivel · el TCQS no trae error codes; se abre por tester" data={testers} />,
      summary: { head: ['Tester', '1ras fallas', '%', '% acumulado'], rows: paretoRows(testers) } },
    { id: 'estaciones', kind: 'Barras', title: 'FPY y Final Yield por estación', content: stations,
      summary: { head: ['Estación', 'Entradas', 'FPY', 'Final Yield'], rows: st.map((s) => [s.name, s.input, pc(s.fpy), pc(s.final)]) } },
    periods.length > 1 && { id: 'tendencia', kind: 'Líneas y barras', title: 'Evolución del yield',
      content: <TrendChart title="Evolución del yield" subtitle={scope} yLabel="%" categories={periods.map((p) => labels.get(p.name)!)} targets={meta}
        lines={[{ name: 'FPY', tone: 'pass', values: periods.map((p) => r1(p.fpy)) }, { name: 'Final Yield', tone: 'second', values: periods.map((p) => r1(p.final)) }]} />,
      summary: { head: ['Periodo', 'Entradas', 'FPY', 'Final Yield'], rows: periods.map((p) => [labels.get(p.name)!, p.input, pc(p.fpy), pc(p.final)]) } },
    testerFpy.length > 2 && { id: 'testers', kind: 'Histograma', title: 'FPY por tester',
      content: <Histogram title="Cómo se reparte el FPY entre testers" subtitle={`${testerFpy.length} testers · ${scope}`} xLabel="FPY %" yLabel="Testers" tone="pass" values={testerFpy} />,
      summary: { head: ['Tester (peor primero)', 'Entradas', 'FPY'], rows: testerSt.map((t) => [t.name, t.input, pc(t.fpy)]) } },
    { id: 'dispersion', kind: 'Dispersión', title: 'Entradas vs. primeras fallas',
      content: <ScatterPlot title="Entradas vs. primeras fallas por estación" subtitle="Arriba a la izquierda = muchas fallas para poco volumen" xLabel="Entradas" yLabel="Primeras fallas"
        series={[{ name: 'Estaciones', tone: 'fail', points: st.map((s) => ({ label: s.name, x: s.input, y: s.ff })) }]} />,
      summary: { head: ['Estación', 'Entradas', '1ras fallas'], rows: [...st].sort((a, b) => b.ff - a.ff).map((s) => [s.name, s.input, s.ff]) } },
  ];
  return out.filter((s): s is Slide => !!s);
}
