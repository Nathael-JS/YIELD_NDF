import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Badge, Button, KpiTile, PeriodTabs, Select } from '../components/ui.tsx';
import { by, byFpy, change, diagnose, pctText, periodOf, periodsOf, rty, shortDay, toWatch, totals, type Grain, type Rec } from '../lib/tcqs.ts';
import { useApp, useData } from '../store.ts';
import { NeedTcqs, PageHead } from './Layout.tsx';
import { download } from '../lib/download.ts';
import { slides } from './slides.tsx';

const ALL = 'Todos los modelos';
const WHOLE = 'todo';
const p1 = (n: number) => (Number.isFinite(n) ? `${n.toFixed(1)} %` : '—');
const GRAINS = [
  { id: 'dia' as const, label: 'Día', hint: 'Un punto por día' },
  { id: 'semana' as const, label: 'Semana', hint: 'Lunes a domingo' },
  { id: 'mes' as const, label: 'Mes', hint: 'Mes calendario' },
];

export default function Yield() {
  const { records, from, to } = useData();
  const period = useApp((s) => s.period), setPeriod = useApp((s) => s.setPeriod);
  const [model, setModel] = useState(ALL);
  const [pick, setPick] = useState<string>(); // clave del periodo; sin elegir = el último con datos
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState<string>();
  // estación que llega desde «Dónde mirar primero» (/yield#FT): se resalta y se lleva a la vista
  const focus = decodeURIComponent(useLocation().hash.slice(1));
  useEffect(() => {
    if (focus) document.querySelector(`[data-station="${CSS.escape(focus)}"]`)?.scrollIntoView({ block: 'center' });
  }, [focus]);
  if (!records.length) return <><PageHead title="Yield" /><NeedTcqs /></>;

  const rs = model === ALL ? records : records.filter((r) => r.model === model);
  const ps = periodsOf(rs, period);
  const cur = pick === WHOLE ? undefined : ps.find(([k]) => k === pick) ?? ps.at(-1);
  const i = cur ? ps.indexOf(cur) : -1;
  const { st, sl, kpiList, table, scope } = view(rs, period, cur?.[0], ps[i - 1]?.[0], model === ALL ? 'todas las estaciones' : model, focus);
  const chart = (id: string) => sl.find((s) => s.id === id)?.content;
  const sub = cur ? `Juliet · ${cur[1]}${i > 0 ? ` · comparado con ${ps[i - 1][1]}` : ''}` : `Juliet · ${shortDay(from!)} – ${shortDay(to!)}`;
  const kpis = <>{kpiList.map((k) => <KpiTile key={k.label} {...k} />)}</>;
  const file = `yield-juliet-${(cur?.[1] ?? 'rango').replace(/\s+/g, '-').toLowerCase()}`;
  const title = `Yield de Juliet · ${cur?.[1] ?? 'todo el rango'}`;
  // los dos reportes se cargan al pedirlos: react-pdf y el renderizado a HTML pesan más que la app
  const exportPdf = async () => {
    setBusy(true);
    setFail(undefined);
    try {
      const { reportPdf } = await import('./pdf.tsx');
      const periods = by(rs, (r) => periodOf(r.date, period)[0]).filter((p) => p.input > 0).sort((a, b) => (a.name < b.name ? -1 : 1));
      download(`${file}.pdf`, await reportPdf({
        title, sub: `${sub} · ${scope}`, kpis: kpiList, stations: st, watch: toWatch(st),
        pareto: st.filter((x) => x.ff > 0).map((x) => ({ label: x.name, value: x.ff })),
        trend: periods.map((p) => ({ label: ps.find(([k]) => k === p.name)![1], fpy: p.fpy, final: p.final })),
      }));
    } catch (e) {
      setFail(`No se pudo generar el PDF: ${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy(false);
    }
  };
  const exportHtml = async () => {
    const { reportHtml } = await import('./report.tsx');
    // todos los modelos en un solo archivo (el lector elige en la lista); mismo periodo que en pantalla.
    // Lo que se ve primero es lo que hay en pantalla; sin datos en el periodo, el modelo no aparece.
    const views = [ALL, ...[...new Set(records.map((r) => r.model))].sort()].map((m) => {
      // como en pantalla: se compara con el periodo anterior con datos de ese modelo
      const mrs = m === ALL ? records : records.filter((r) => r.model === m), keys = periodsOf(mrs, period), at = cur ? keys.findIndex(([k]) => k === cur[0]) : -1;
      const v = view(mrs, period, cur?.[0], at > 0 ? keys[at - 1][0] : undefined, m === ALL ? 'todas las estaciones' : m);
      return { name: m, kpis: <>{v.kpiList.map((k) => <KpiTile key={k.label} {...k} />)}</>, slides: v.sl, table: v.table, input: v.t.input };
    }).filter((v) => v.input > 0).sort((a, b) => Number(b.name === model) - Number(a.name === model));
    download(`${file}.html`, new Blob([reportHtml({ title, sub, views })], { type: 'text/html' }));
  };
  return (
    <>
      <PageHead title="Yield" sub={sub}>
        <PeriodTabs value={period} onChange={setPeriod} options={GRAINS} />
        <Select label="Periodo" value={cur?.[0] ?? WHOLE} onChange={setPick} options={[...[...ps].reverse().map(([value, label]) => ({ value, label })), { value: WHOLE, label: 'Todo el rango' }]} />
        <Select label="Modelo" value={model} onChange={setModel} options={[ALL, ...new Set(records.map((r) => r.model))]} />
      </PageHead>
      <div className="yc-grid-kpi">{kpis}</div>
      <div className="yc-row">
        <Button onClick={exportHtml}>Descargar reporte HTML</Button>
        <Button onClick={exportPdf} disabled={busy}>{busy ? 'Generando PDF…' : 'Descargar PDF'}</Button>
        {fail && <span className="app-muted" role="alert"><Badge tone="bad">Error</Badge> {fail}</span>}
      </div>
      {chart('estaciones')}
      {table}
      <div className="app-charts">{slides(rs, period, scope).find((s) => s.id === 'tendencia')?.content}{chart('pareto')}</div>
    </>
  );
}

/** KPIs, gráficas y tabla de unas filas (un modelo o todos) en un periodo, comparado con el anterior. */
function view(rs: Rec[], period: Grain, key: string | undefined, prevKey: string | undefined, scope: string, focus = '') {
  const inPeriod = (k: string) => rs.filter((r) => periodOf(r.date, period)[0] === k);
  const now = key ? inPeriod(key) : rs;
  const prevRs = prevKey ? inPeriod(prevKey) : undefined;
  const t = totals(now), st = by(now, (r) => r.group).sort(byFpy);
  // RTY va aparte de totals(): sale del FPY de cada estación
  const cmp = { ...t, rty: rty(st) }, prev = prevRs && { ...totals(prevRs), rty: rty(by(prevRs, (r) => r.group)) };
  const sl = slides(now, period, scope);
  // ▲/▼ contra el periodo anterior; `worse` = el cambio es malo si sube (retest)
  const kpiData = (label: string, key: 'input' | 'fpy' | 'final' | 'retest' | 'recovered' | 'rty', worse = false) => {
    const d = change(cmp, prev, key), pct = key !== 'input';
    return { label, value: pct ? pctText(cmp[key]) : t.input.toLocaleString('es-MX'), unit: pct ? '%' : undefined,
      delta: d, deltaUnit: pct ? ' pts' : '', good: d == null || !pct || (worse ? d <= 0 : d >= 0) };
  };
  const kpiList = [kpiData('Entradas', 'input'), kpiData('FPY', 'fpy'), kpiData('Final Yield', 'final'),
    kpiData('A retest', 'retest', true), kpiData('Recuperado en retest', 'recovered', true), kpiData('RTY', 'rty')];
  const table = (
    <div className="yc-table-wrap">
      <table className="yc-table">
        <thead><tr><th>Estación</th><th className="num">Entradas</th><th className="num">1ra falla</th><th className="num">FPY</th><th className="num">Final Yield</th><th className="num">Retest</th><th>Diagnóstico</th></tr></thead>
        <tbody>
          {st.map((s) => {
            const [text, tone] = diagnose(s);
            return (
              <tr key={s.name} data-station={s.name} className={s.name === focus ? 'is-focus' : undefined} aria-current={s.name === focus || undefined}>
                <td className="code">{s.name}</td>
                <td className="num">{s.input.toLocaleString('es-MX')}</td>
                <td className="num">{s.ff.toLocaleString('es-MX')}</td>
                <td className="num">{p1(s.fpy)}</td>
                <td className="num">{p1(s.final)}</td>
                <td className="num">{p1(s.retest)}</td>
                <td><Badge tone={tone}>{text}</Badge></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
  return { t, st, sl, kpiList, table, scope };
}
