import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Badge, KpiTile, PeriodTabs, Select } from '../components/ui.tsx';
import { by, byFpy, change, diagnose, pctText, periodOf, periodsOf, rty, shortDay, totals } from '../lib/tcqs.ts';
import { useApp, useData } from '../store.ts';
import { NeedTcqs, PageHead } from './Layout.tsx';
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
  const { period, setPeriod } = useApp();
  const [model, setModel] = useState(ALL);
  const [pick, setPick] = useState<string>(); // clave del periodo; sin elegir = el último con datos
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
  const inPeriod = (k: string) => rs.filter((r) => periodOf(r.date, period)[0] === k);
  const now = cur ? inPeriod(cur[0]) : rs;
  const prev = i > 0 ? totals(inPeriod(ps[i - 1][0])) : undefined;
  const t = totals(now), st = by(now, (r) => r.group).sort(byFpy);
  const scope = model === ALL ? 'todas las estaciones' : model;
  const sl = slides(now, period, scope);
  const chart = (id: string) => sl.find((s) => s.id === id)?.content;
  // ▲/▼ contra el periodo anterior; `worse` = el cambio es malo si sube (retest)
  const kpi = (label: string, key: 'input' | 'fpy' | 'final' | 'retest', worse = false) => {
    const d = change(t, prev, key), pct = key !== 'input';
    return <KpiTile label={label} value={pct ? pctText(t[key]) : t.input.toLocaleString('es-MX')} unit={pct ? '%' : undefined}
      delta={d} deltaUnit={pct ? ' pts' : ''} good={d == null || !pct || (worse ? d <= 0 : d >= 0)} />;
  };
  return (
    <>
      <PageHead title="Yield" sub={cur ? `Juliet · ${cur[1]}${i > 0 ? ` · comparado con ${ps[i - 1][1]}` : ''}` : `Juliet · ${shortDay(from!)} – ${shortDay(to!)}`}>
        <PeriodTabs value={period} onChange={setPeriod} options={GRAINS} />
        <Select label="Periodo" value={cur?.[0] ?? WHOLE} onChange={setPick} options={[...[...ps].reverse().map(([value, label]) => ({ value, label })), { value: WHOLE, label: 'Todo el rango' }]} />
        <Select label="Modelo" value={model} onChange={setModel} options={[ALL, ...new Set(records.map((r) => r.model))]} />
      </PageHead>
      <div className="yc-grid-kpi">
        {kpi('Entradas', 'input')}
        {kpi('FPY', 'fpy')}
        {kpi('Final Yield', 'final')}
        {kpi('A retest', 'retest', true)}
        <KpiTile label="Recuperado en retest" value={pctText(t.recovered)} unit="%" />
        <KpiTile label="RTY" value={pctText(rty(st))} unit="%" />
      </div>
      {chart('estaciones')}
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
      <div className="app-charts">{slides(rs, period, scope).find((s) => s.id === 'tendencia')?.content}{chart('pareto')}</div>
    </>
  );
}
