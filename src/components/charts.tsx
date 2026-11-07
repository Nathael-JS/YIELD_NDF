// Gráficas SVG del sistema de diseño (portadas de components/bundle.js).
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { binCounts, fmt, niceRange, sturges } from '../lib/chart.ts';

export type DataTone = 'pass' | 'second' | 'fail' | 'ndf';
export interface Series { name: string; values: number[]; tone?: DataTone }
export interface ChartTarget { value: number; label?: string }
interface Frame { title?: string; subtitle?: string; xLabel?: string; yLabel?: string }

const TONES: DataTone[] = ['pass', 'second', 'fail', 'ndf'];
const toneOf = (s: { tone?: DataTone }, j: number) => s.tone ?? TONES[j % TONES.length];

// Las gráficas dibujan en píxeles reales: el SVG mide su ancho para que el texto quede en 11px.
function useSvgWidth() {
  const ref = useRef<SVGSVGElement>(null);
  const [w, setW] = useState(800);
  // useEffect y no useLayoutEffect: también se dibujan a HTML estático (reporte descargable)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const set = () => { const v = Math.round(el.getBoundingClientRect().width); if (v > 0) setW(v); };
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, w: Math.max(w, 240) };
}

// Marco común: ancho medido × 300px.
const CH = 300, CL = 52, CR = 16, CT = 24, CB = 44, CIH = CH - CT - CB;
type Range = ReturnType<typeof niceRange>;
const yPos = (r: Range, v: number) => CT + CIH - ((v - r.lo) / (r.hi - r.lo)) * CIH;

function YGrid({ r, label, w }: { r: Range; label?: string; w: number }) {
  return (
    <>
      {Array.from({ length: r.n + 1 }, (_, i) => {
        const v = r.lo + i * r.step, y = yPos(r, v);
        return (
          <Fragment key={i}>
            <line className={i ? 'yc-chart-grid' : 'yc-chart-axis'} x1={CL} x2={w - CR} y1={y} y2={y} />
            <text className="yc-chart-y" x={CL - 8} y={y + 4} textAnchor="end">{fmt(v)}</text>
          </Fragment>
        );
      })}
      {label && <text className="yc-chart-label" x={CL - 8} y={CT - 10} textAnchor="end">{label}</text>}
    </>
  );
}
const XLabel = ({ text, w }: { text?: string; w: number }) =>
  text ? <text className="yc-chart-label" x={w - CR} y={CH - 4} textAnchor="end">{text}</text> : null;

/** shape: 0 círculo, 1 cuadrado, 2 triángulo. */
function Mark({ shape, x, y, cls, title }: { shape: number; x: number; y: number; cls: string; title?: string }) {
  const t = title && <title>{title}</title>;
  if (shape === 1) return <rect className={cls} x={x - 4} y={y - 4} width={8} height={8}>{t}</rect>;
  if (shape === 2) return <path className={cls} d={`M${x} ${y - 5}L${x + 5} ${y + 4}L${x - 5} ${y + 4}Z`}>{t}</path>;
  return <circle className={cls} cx={x} cy={y} r={4.5}>{t}</circle>;
}

type LegendItem = { name: string; tone?: DataTone; kind: 'line' | 'target' | number };
function Legend({ items }: { items: LegendItem[] }) {
  if (items.length < 2) return null;
  return (
    <ul className="yc-legend">
      {items.map((it) => (
        <li key={it.name}>
          <svg width={12} height={12} viewBox="0 0 12 12" aria-hidden overflow="visible">
            {it.kind === 'target' ? <line className="yc-chart-target" x1={0} x2={12} y1={6} y2={6} />
              : it.kind === 'line' ? (
                <>
                  <line className={`yc-trend-line yc-stroke-${it.tone}`} x1={0} x2={12} y1={6} y2={6} />
                  <circle className={`yc-line-dot yc-stroke-${it.tone}`} cx={6} cy={6} r={2.5} />
                </>
              ) : <Mark shape={it.kind} x={6} y={6} cls={`yc-mark yc-fill-${it.tone}`} />}
          </svg>
          {it.name}
        </li>
      ))}
    </ul>
  );
}

function ChartFrame({ p, legend, aria, m, children, h = CH }: {
  p: Frame; legend?: ReactNode; aria: string; m: ReturnType<typeof useSvgWidth>; children: ReactNode; h?: number;
}) {
  return (
    <figure className="yc-chart">
      <figcaption className="yc-chart-title">{p.title}{p.subtitle && <span className="yc-chart-sub">{p.subtitle}</span>}</figcaption>
      {legend}
      <svg ref={m.ref} viewBox={`0 0 ${m.w} ${h}`} role="img" aria-label={aria}>{children}</svg>
    </figure>
  );
}

export interface ParetoDatum { label: string; value: number }
export function ParetoChart({ data, title = 'Pareto', level = 1, subtitle }: {
  data: ParetoDatum[]; title?: string; level?: 1 | 2; subtitle?: string;
}) {
  const m = useSvgWidth();
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const total = sorted.reduce((s, d) => s + d.value, 0) || 1;
  const W = m.w, H = 280, L = 40, R = 44, T = 12, B = 36, iw = W - L - R, ih = H - T - B;
  // como en BarChart: cada cuántas etiquetas cabe una, según la más larga (mono 11px ≈ 7px por letra)
  const lw = Math.max(48, 7 * Math.max(0, ...sorted.map((d) => d.label.length)) + 12);
  const max = sorted[0]?.value || 1, bw = iw / Math.max(sorted.length, 1), every = Math.max(1, Math.ceil(lw / bw));
  let cum = 0;
  const pts = sorted.map((d, i) => { cum += d.value; return [L + i * bw + bw / 2, T + ih - (cum / total) * ih] as const; });
  const y80 = T + ih * 0.2;
  const sub = subtitle ?? (level === 2 ? '2do nivel · por tipo de error de la estación' : '1er nivel · todas las estaciones funcionales');
  return (
    <figure className="yc-pareto">
      <figcaption className="yc-pareto-title">{title}<span className="yc-pareto-level">{sub}</span></figcaption>
      <svg ref={m.ref} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}: ${sorted.map((d) => `${d.label} ${d.value}`).join(', ')}`}>
        <line className="yc-pareto-axis" x1={L} x2={W - R} y1={T + ih} y2={T + ih} />
        <line className="yc-pareto-80" x1={L} x2={W - R} y1={y80} y2={y80} />
        <text className="yc-pareto-y" x={W - R + 6} y={y80 + 4}>80%</text>
        <text className="yc-pareto-y" x={W - R + 6} y={T + 4}>100%</text>
        <text className="yc-pareto-y" x={L - 6} y={T + 4} textAnchor="end">{max}</text>
        <text className="yc-pareto-y" x={L - 6} y={T + ih} textAnchor="end">0</text>
        {sorted.map((d, i) => {
          const x = L + i * bw, bh = (d.value / max) * ih;
          return (
            <g key={d.label}>
              <rect className={`yc-pareto-bar${i === 0 ? ' is-top' : ''}`} x={x + bw * 0.15} y={T + ih - bh} width={bw * 0.7} height={bh} rx={2}>
                <title>{`${d.label}: ${d.value} (${Math.round((d.value / total) * 100)}%)`}</title>
              </rect>
              {i % every === 0 && <text className="yc-pareto-x" x={x + bw / 2} y={H - B + 18} textAnchor="middle">{d.label}</text>}
            </g>
          );
        })}
        <polyline className="yc-pareto-line" pathLength={1} points={pts.map((q) => q.join(',')).join(' ')} />
        {pts.map((q, i) => <circle key={i} className="yc-pareto-dot" cx={q[0]} cy={q[1]} r={3} />)}
      </svg>
    </figure>
  );
}

export interface BarChartProps extends Frame {
  categories: string[];
  series?: Series[];
  /** Solo TrendChart: líneas sobre la misma escala. */
  lines?: Series[];
  /** Metas punteadas (p. ej. FPY 95 %). */
  targets?: ChartTarget[];
  /** Solo BarChart: una fila por categoría, para nombres largos (estaciones). */
  horizontal?: boolean;
}
function BarsAndLines({ kind, categories: cats, series = [], lines = [], targets = [], ...p }: BarChartProps & { kind: string }) {
  const m = useSvgWidth(), CW = m.w, CIW = CW - CL - CR, ns = Math.max(series.length, 1);
  const all = [0, ...series.flatMap((s) => s.values), ...lines.flatMap((s) => s.values), ...targets.map((t) => t.value)];
  // cada cuántas etiquetas del eje X cabe una, según la más larga (mono 11px ≈ 7px por letra)
  const lw = Math.max(56, 7 * Math.max(0, ...cats.map((c) => c.length)) + 12);
  const r = niceRange(0, Math.max(...all)), g = CIW / Math.max(cats.length, 1), bw = (g * 0.7) / ns, every = Math.max(1, Math.ceil(lw / g));
  const xc = (i: number) => CL + i * g + g / 2;
  const both = [...series, ...lines];
  const aria = `${p.title || kind}: ` + cats.map((c, i) => `${c} ${both.map((s) => `${s.name} ${fmt(s.values[i] || 0)}`).join(', ')}`).join('; ');
  const legend: LegendItem[] = [
    ...series.map((s, j) => ({ name: s.name, tone: toneOf(s, j), kind: 1 })),
    ...lines.map((s, j) => ({ name: s.name, tone: toneOf(s, series.length + j), kind: 'line' as const })),
    ...targets.map((t) => ({ name: t.label || fmt(t.value), kind: 'target' as const })),
  ];
  return (
    <ChartFrame p={p} legend={<Legend items={legend} />} aria={aria} m={m}>
      <YGrid r={r} label={p.yLabel} w={CW} />
      {cats.map((c, i) => (
        <g key={c}>
          {series.map((s, j) => {
            const v = s.values[i] || 0, bh = CT + CIH - yPos(r, v);
            return (
              <rect key={j} className={`yc-bar yc-fill-${toneOf(s, j)}`} x={CL + i * g + g * 0.15 + j * bw} y={CT + CIH - bh} width={Math.max(bw - (ns > 1 ? 2 : 0), 1)} height={bh} rx={2}>
                <title>{`${c} · ${s.name}: ${fmt(v)}`}</title>
              </rect>
            );
          })}
          {i % every === 0 && <text className="yc-chart-x" x={xc(i)} y={CT + CIH + 18} textAnchor="middle">{c}</text>}
        </g>
      ))}
      {targets.map((t, k) => {
        const y = yPos(r, t.value);
        return <line key={k} className="yc-chart-target" x1={CL} x2={CW - CR} y1={y} y2={y}><title>{t.label || fmt(t.value)}</title></line>;
      })}
      {lines.map((s, j) => {
        const tone = toneOf(s, series.length + j);
        return (
          <g key={`l${j}`}>
            <polyline className={`yc-trend-line yc-stroke-${tone}`} pathLength={1} points={cats.map((_, i) => `${xc(i)},${yPos(r, s.values[i] || 0)}`).join(' ')} />
            {cats.map((c, i) => (
              <circle key={i} className={`yc-line-dot yc-stroke-${tone}`} cx={xc(i)} cy={yPos(r, s.values[i] || 0)} r={3.5}>
                <title>{`${c} · ${s.name}: ${fmt(s.values[i] || 0)}`}</title>
              </circle>
            ))}
          </g>
        );
      })}
      <XLabel text={p.xLabel} w={CW} />
    </ChartFrame>
  );
}
export const BarChart = ({ lines: _omit, horizontal, ...p }: BarChartProps) => (horizontal ? <HBars {...p} /> : <BarsAndLines kind="Barras" {...p} />);

/** Barras horizontales: el nombre completo de cada categoría se lee a la izquierda, sin saltarse etiquetas. */
function HBars({ categories: cats, series = [], targets = [], ...p }: BarChartProps) {
  const m = useSvgWidth(), W = m.w, ns = Math.max(series.length, 1);
  const L = Math.min(W * 0.4, 7 * Math.max(0, ...cats.map((c) => c.length)) + 20), R = 24, T = 8, B = 36;
  const bh = 10, row = ns * bh + 12, H = T + cats.length * row + B;
  const maxChars = Math.floor((L - 20) / 7);
  const r = niceRange(0, Math.max(0, ...series.flatMap((s) => s.values), ...targets.map((t) => t.value)));
  const xp = (v: number) => L + ((v - r.lo) / (r.hi - r.lo)) * (W - L - R);
  const aria = `${p.title || 'Barras'}: ` + cats.map((c, i) => `${c} ${series.map((s) => `${s.name} ${fmt(s.values[i] || 0)}`).join(', ')}`).join('; ');
  const legend: LegendItem[] = [
    ...series.map((s, j) => ({ name: s.name, tone: toneOf(s, j), kind: 1 })),
    ...targets.map((t) => ({ name: t.label || fmt(t.value), kind: 'target' as const })),
  ];
  return (
    <ChartFrame p={p} legend={<Legend items={legend} />} aria={aria} m={m} h={H}>
      {Array.from({ length: r.n + 1 }, (_, i) => {
        const v = r.lo + i * r.step, x = xp(v);
        return (
          <Fragment key={i}>
            <line className={i ? 'yc-chart-grid' : 'yc-chart-axis'} x1={x} x2={x} y1={T} y2={H - B} />
            <text className="yc-chart-x" x={x} y={H - B + 16} textAnchor="middle">{fmt(v)}</text>
          </Fragment>
        );
      })}
      {(p.xLabel || p.yLabel) && <text className="yc-chart-label" x={W - R} y={H - 4} textAnchor="end">{p.xLabel || p.yLabel}</text>}
      {cats.map((c, i) => (
        <g key={c}>
          <text className="yc-chart-x" x={L - 8} y={T + i * row + row / 2 + 4} textAnchor="end">
            {c.length > maxChars ? `${c.slice(0, Math.max(1, maxChars - 1))}…` : c}<title>{c}</title>
          </text>
          {series.map((s, j) => {
            const v = s.values[i] || 0;
            return (
              <rect key={j} className={`yc-bar yc-bar-h yc-fill-${toneOf(s, j)}`} x={L} y={T + i * row + 6 + j * bh} width={Math.max(xp(v) - L, 0)} height={bh - 1} rx={2}>
                <title>{`${c} · ${s.name}: ${fmt(v)}`}</title>
              </rect>
            );
          })}
        </g>
      ))}
      {targets.map((t, k) => <line key={k} className="yc-chart-target" x1={xp(t.value)} x2={xp(t.value)} y1={T} y2={H - B}><title>{t.label || fmt(t.value)}</title></line>)}
    </ChartFrame>
  );
}
export const TrendChart = (p: BarChartProps) => <BarsAndLines kind="Líneas y barras" {...p} />;

export function Histogram({ values, bins, tone = 'second', yLabel = 'Unidades', ...p }: Frame & { values: number[]; bins?: number; tone?: DataTone }) {
  const m = useSvgWidth(), CW = m.w, CIW = CW - CL - CR;
  const vals = values.filter((v) => Number.isFinite(v));
  const r = binCounts(vals, bins || sturges(vals.length)), nb = r.counts.length;
  const yr = niceRange(0, Math.max(1, ...r.counts)), bw = CIW / nb, every = Math.max(nb > 12 ? 2 : 1, Math.ceil(40 / bw));
  const edge = (b: number) => fmt(r.lo + b * r.w);
  const aria = `${p.title || 'Histograma'}: ` + r.counts.map((c, b) => `${edge(b)}–${edge(b + 1)}: ${c}`).join(', ');
  return (
    <ChartFrame p={p} aria={aria} m={m}>
      <YGrid r={yr} label={yLabel} w={CW} />
      {r.counts.map((c, b) => {
        const bh = CT + CIH - yPos(yr, c);
        return <rect key={b} className={`yc-bar yc-fill-${tone}`} x={CL + b * bw + 1} y={CT + CIH - bh} width={bw - 2} height={bh}><title>{`${edge(b)}–${edge(b + 1)}: ${c}`}</title></rect>;
      })}
      {Array.from({ length: Math.floor(nb / every) + 1 }, (_, k) => k * every).map((b) => (
        <text key={b} className="yc-chart-x" x={CL + b * bw} y={CT + CIH + 18} textAnchor="middle">{edge(b)}</text>
      ))}
      <XLabel text={p.xLabel} w={CW} />
    </ChartFrame>
  );
}

export interface ScatterPoint { x: number; y: number; label?: string }
export interface ScatterSeries { name: string; points: ScatterPoint[]; tone?: DataTone }
/** Una serie por archivo; forma por serie: TCQS círculo, DATA ANALYSIS cuadrado, QM triángulo. */
export function ScatterPlot({ series, ...p }: Frame & { series: ScatterSeries[] }) {
  const m = useSvgWidth(), CW = m.w, CIW = CW - CL - CR;
  let xs = series.flatMap((s) => s.points.map((q) => q.x)), ys = series.flatMap((s) => s.points.map((q) => q.y));
  if (!xs.length) { xs = [0, 1]; ys = [0, 1]; }
  const xr = niceRange(Math.min(...xs), Math.max(...xs)), yr = niceRange(Math.min(...ys), Math.max(...ys));
  const xPos = (v: number) => CL + ((v - xr.lo) / (xr.hi - xr.lo)) * CIW;
  const aria = `${p.title || 'Dispersión'}: ` + series.map((s) => `${s.name} ` + s.points.map((q) => `${q.label ? q.label + ' ' : ''}(${fmt(q.x)}, ${fmt(q.y)})`).join(', ')).join('; ');
  return (
    <ChartFrame p={p} legend={<Legend items={series.map((s, j) => ({ name: s.name, tone: toneOf(s, j), kind: j % 3 }))} />} aria={aria} m={m}>
      <YGrid r={yr} label={p.yLabel} w={CW} />
      {Array.from({ length: xr.n + 1 }, (_, i) => (
        <text key={i} className="yc-chart-x" x={xPos(xr.lo + i * xr.step)} y={CT + CIH + 18} textAnchor="middle">{fmt(xr.lo + i * xr.step)}</text>
      ))}
      {series.map((s, j) => (
        <g key={s.name}>
          {s.points.map((q, k) => (
            <Mark key={k} shape={j % 3} x={xPos(q.x)} y={yPos(yr, q.y)} cls={`yc-mark yc-fill-${toneOf(s, j)}`}
              title={`${s.name} · ${q.label ? q.label + ': ' : ''}${fmt(q.x)}, ${fmt(q.y)}`} />
          ))}
        </g>
      ))}
      <XLabel text={p.xLabel} w={CW} />
    </ChartFrame>
  );
}
