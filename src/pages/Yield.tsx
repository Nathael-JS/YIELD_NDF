import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Badge, KpiTile, PeriodTabs, Select } from '../components/ui.tsx';
import { by, byFpy, countOrders, change, diagnose, DX_HINT, pctText, periodOf, periodsOf, rty, shortDay, totals, type Grain, type Rec } from '../lib/tcqs.ts';
import { useApp, useData } from '../store.ts';
import { NeedTcqs, PageHead } from './Layout.tsx';
import { slides } from './slides.tsx';
import { ndfStations } from '../lib/fails.ts';

export const ALL = 'Todos los modelos';
export const WHOLE = 'todo';
const p1 = (n: number) => (Number.isFinite(n) ? `${n.toFixed(1)} %` : '—');
export const GRAINS = [
  { id: 'dia' as const, label: 'Día', hint: 'Un punto por día' },
  { id: 'semana' as const, label: 'Semana', hint: 'Lunes a domingo' },
  { id: 'mes' as const, label: 'Mes', hint: 'Mes calendario' },
];

export default function Yield() {
  const { records, from, to } = useData();
  const period = useApp((s) => s.period), setPeriod = useApp((s) => s.setPeriod);
  const [model, setModel] = useState(ALL);
  const [pick, setPick] = useState<string>(); // clave del periodo; sin elegir = el último con datos
  const db = useApp((s) => s.db);
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
  return (
    <>
      <PageHead title="Yield" sub={sub}>
        <PeriodTabs value={period} onChange={setPeriod} options={GRAINS} />
        <Select label="Periodo" value={cur?.[0] ?? WHOLE} onChange={setPick} options={[...[...ps].reverse().map(([value, label]) => ({ value, label })), { value: WHOLE, label: 'Todo el rango' }]} />
        <Select label="Modelo" value={model} onChange={setModel} options={[ALL, ...new Set(records.map((r) => r.model))]} />
      </PageHead>
      <div className="yc-grid-kpi">{kpis}</div>
      <div className="yc-row">
        <Link className="yc-btn yc-btn-secondary" to="/descargas">Descargar HTML o PDF</Link>
        {/* lo que se ve aquí ya quedó en el historial (se guarda solo al leer el TCQS) */}
        {db && <span className="app-muted" role="status"><Badge tone={db[0]}>Historial</Badge> {db[1]} {db[0] === 'ok' && <Link to="/historial">Ver historial</Link>}</span>}
      </div>
      {chart('estaciones')}
      {table}
      <div className="app-charts">{slides(rs, period, scope).find((s) => s.id === 'tendencia')?.content}{chart('pareto')}</div>
    </>
  );
}

/** KPIs, gráficas y tabla de unas filas (un modelo o todos) en un periodo, comparado con el anterior. */
export function view(rs: Rec[], period: Grain, key: string | undefined, prevKey: string | undefined, scope: string, focus = '') {
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
  // órdenes distintas (MO_NUMBER) del periodo; de la base salen solo si se guardaron desde 0.15.1
  const orders = countOrders(now);
  const nd = ndfStations(now).reduce((a, x) => a + x.ndf, 0);
  const kpiList = [{ ...kpiData(orders ? 'Entradas / órdenes' : 'Entradas', 'input'), unit: orders ? ` / ${orders.toLocaleString('es-MX')} órdenes` : undefined }, kpiData('FPY', 'fpy'), kpiData('Final Yield', 'final'),
    kpiData('A retest', 'retest', true), kpiData('Recuperado en retest', 'recovered', true), kpiData('RTY', 'rty'),
    // NDF = 2do pase (falló y pasó al re-probar sin reparación), sumado por estación como en la página NDF; % sobre las primeras fallas
    { label: 'NDF', value: nd.toLocaleString('es-MX'), unit: ` · ${pctText((nd / t.ff) * 100)} % de 1ra falla`, deltaUnit: '', good: true }];
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
                <td><Badge tone={tone} title={DX_HINT[text]}>{text}</Badge></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
  return { t, st, sl, kpiList, table, scope };
}
