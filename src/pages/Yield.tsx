import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Badge, KpiTile, PeriodTabs, Select } from '../components/ui.tsx';
import { by, byFpy, diagnose, pctText, rty, shortDay, totals } from '../lib/tcqs.ts';
import { useApp, useData } from '../store.ts';
import { NeedTcqs, PageHead } from './Layout.tsx';
import { slides } from './slides.tsx';

const ALL = 'Todos los modelos';
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
  // estación que llega desde «Dónde mirar primero» (/yield#FT): se resalta y se lleva a la vista
  const focus = decodeURIComponent(useLocation().hash.slice(1));
  useEffect(() => {
    if (focus) document.querySelector(`[data-station="${CSS.escape(focus)}"]`)?.scrollIntoView({ block: 'center' });
  }, [focus]);
  if (!records.length) return <><PageHead title="Yield" /><NeedTcqs /></>;

  const rs = model === ALL ? records : records.filter((r) => r.model === model);
  const t = totals(rs), st = by(rs, (r) => r.group).sort(byFpy);
  const sl = slides(rs, period, model === ALL ? 'todas las estaciones' : model);
  const chart = (id: string) => sl.find((s) => s.id === id)?.content;
  return (
    <>
      <PageHead title="Yield" sub={`Juliet · ${shortDay(from!)} – ${shortDay(to!)}`}>
        <PeriodTabs value={period} onChange={setPeriod} options={GRAINS} />
        <Select label="Modelo" value={model} onChange={setModel} options={[ALL, ...new Set(records.map((r) => r.model))]} />
      </PageHead>
      <div className="yc-grid-kpi">
        <KpiTile label="Entradas" value={t.input.toLocaleString('es-MX')} />
        <KpiTile label="FPY" value={pctText(t.fpy)} unit="%" />
        <KpiTile label="Final Yield" value={pctText(t.final)} unit="%" />
        <KpiTile label="A retest" value={pctText(t.retest)} unit="%" />
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
      <div className="app-charts">{chart('tendencia')}{chart('pareto')}</div>
    </>
  );
}
