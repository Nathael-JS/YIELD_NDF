import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, KpiTile } from '../components/ui.tsx';
import { loadSummary } from '../lib/db.ts';
import { by, byFpy, change, countOrders, fromDb, pctText, readTcqs, shortDay, totals, type DbRow } from '../lib/tcqs.ts';
import { useData } from '../store.ts';
import { PageHead } from './Layout.tsx';

const n = (v: number) => v.toLocaleString('es-MX');
const dayBefore = (iso: string) => new Date(Date.parse(iso) - 864e5).toISOString().slice(0, 10);
/** Cambio en puntos con su tono: ±2 pts o más se marca. */
function delta(d: number | undefined) {
  if (d == null) return <Badge tone="neutral" title="Menos de 10 entradas en alguno de los dos días">Datos insuficientes</Badge>;
  return <Badge tone={d >= 2 ? 'ok' : d <= -2 ? 'bad' : 'neutral'}>{d > 0 ? '▲ ' : d < 0 ? '▼ ' : ''}{Math.abs(d)} pts</Badge>;
}

/** Un día contra el anterior, los dos leídos de la base (lo que se guardó al cargar cada TCQS). */
export default function Comparativas() {
  const { to } = useData();
  const go = useNavigate();
  const [day, setDay] = useState(to ?? new Date().toISOString().slice(0, 10)); // por defecto, el último día cargado
  const [rows, setRows] = useState<DbRow[]>();
  const [fail, setFail] = useState<string>();
  const prev = dayBefore(day);
  useEffect(() => {
    setRows(undefined); setFail(undefined);
    loadSummary(prev, day).then(setRows).catch((e) => setFail(e.message));
  }, [day, prev]);

  const recs = (d: string) => readTcqs(fromDb((rows ?? []).filter((r) => r.fecha === d))).records;
  const a = recs(prev), b = recs(day), ta = totals(a), tb = totals(b);
  const missing = rows && [!a.length && prev, !b.length && day].filter(Boolean) as string[];
  const kpi = (label: string, key: 'fpy' | 'final' | 'retest', worse = false) => {
    const d = change(tb, ta, key);
    return <KpiTile key={key} label={label} value={pctText(tb[key])} unit="%" delta={d} deltaUnit=" pts" good={d == null || (worse ? d <= 0 : d >= 0)} />;
  };
  const before = new Map(by(a, (r) => r.group).map((s) => [s.name, s]));
  const stations = by(b, (r) => r.group).filter((s) => s.input > 0).sort(byFpy);
  const orders = countOrders(b);

  return (
    <>
      <PageHead title="Comparativas" sub={`${shortDay(day)} contra el día anterior (${shortDay(prev)}), con lo guardado en la base.`}>
        <label className="yc-field">Día<input className="yc-input" type="date" value={day} max={new Date().toISOString().slice(0, 10)} onChange={(e) => e.target.value && setDay(e.target.value)} /></label>
      </PageHead>
      {fail && <p className="app-muted" role="alert"><Badge tone="bad">Error</Badge> No se pudo leer la base: {fail}</p>}
      {!rows && !fail && <p className="app-muted" role="status">Leyendo la base…</p>}
      {missing && missing.length > 0 && (
        <section className="yc-card yc-pad app-sec" role="status">
          <h2 className="app-h3">Faltan datos <Badge tone="warn">{missing.map(shortDay).join(' y ')}</Badge></h2>
          <p className="app-muted">La base no tiene información de {missing.map(shortDay).join(' ni del ')}: nunca se cargó o se borró. Carga el TCQS que incluya {missing.length > 1 ? 'esos días' : 'ese día'} y se guarda solo; luego vuelve aquí.</p>
          <Button variant="primary" onClick={() => go('/carga')}>Ir a Carga de datos</Button>
        </section>
      )}
      {rows && b.length > 0 && a.length > 0 && (
        <>
          <div className="yc-grid-kpi">
            <KpiTile label={orders ? 'Entradas / órdenes' : 'Entradas'} value={n(tb.input)} unit={orders ? ` / ${n(orders)} órdenes` : undefined}
              delta={tb.input - ta.input} good={tb.input >= ta.input} />
            {kpi('FPY', 'fpy')}
            {kpi('Final Yield', 'final')}
            {kpi('A retest', 'retest', true)}
          </div>
          <div className="yc-table-wrap">
            <table className="yc-table">
              <thead><tr>
                <th>Estación</th><th className="num">Entradas</th>
                <th className="num">FPY {shortDay(prev)}</th><th className="num">FPY {shortDay(day)}</th><th>Cambio FPY</th>
                <th className="num">Final {shortDay(prev)}</th><th className="num">Final {shortDay(day)}</th><th>Cambio Final</th>
              </tr></thead>
              <tbody>
                {stations.map((s) => {
                  const p = before.get(s.name);
                  return (
                    <tr key={s.name}>
                      <td className="code">{s.name}</td>
                      <td className="num">{n(s.input)}</td>
                      <td className="num">{p ? `${pctText(p.fpy)} %` : '—'}</td><td className="num">{pctText(s.fpy)} %</td><td>{delta(p && change(s, p, 'fpy'))}</td>
                      <td className="num">{p ? `${pctText(p.final)} %` : '—'}</td><td className="num">{pctText(s.final)} %</td><td>{delta(p && change(s, p, 'final'))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
