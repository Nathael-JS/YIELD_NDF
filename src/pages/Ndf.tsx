import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, KpiTile } from '../components/ui.tsx';
import { ParetoChart } from '../components/charts.tsx';
import { byLabel, classify, readFails, top80 } from '../lib/fails.ts';
import { by, modelKey, pctText } from '../lib/tcqs.ts';
import { useApp, useData } from '../store.ts';
import { NeedTcqs, PageHead } from './Layout.tsx';

const n = (v: number) => (Number.isFinite(v) ? v.toLocaleString('es-MX', { maximumFractionDigits: 1 }) : '—');

/** NDF (no defect found): cuántas del TCQS y por qué, con los códigos del reporte de primeras fallas. */
export default function Ndf() {
  const { records, models } = useData();
  const file = useApp((s) => s.files.FALLAS);
  const [pick, setPick] = useState<string>();
  // por estación: NDF = 2do pase, real = FAIL_QTY (falló el retest), pendiente = lo que falta re-probar
  const stations = useMemo(() => by(records, (r) => r.group).filter((s) => s.ff > 0).map((s) => {
    const real = records.reduce((a, r) => (r.group === s.name ? a + (r.fail ?? NaN) : a), 0);
    return { ...s, ndf: s.sp, real, pend: Math.max(0, s.ff - s.sp - real) };
  }).sort((a, b) => b.ndf - a.ndf), [records]);
  const read = useMemo(() => file && readFails(file), [file]);
  const marked = useMemo(() => read && classify(read.fails.filter((f) => !models || models.has(modelKey(f.model))), records), [read, records, models]);
  if (!records.length) return <><PageHead title="NDF" /><NeedTcqs /></>;

  const sum = (k: 'input' | 'ff' | 'ndf' | 'real' | 'pend') => stations.reduce((a, s) => a + s[k], 0);
  const station = pick ?? stations[0]?.name;
  const mine = marked?.marked.filter((m) => m.group === station) ?? [];
  const codes = byLabel(mine, (m) => m.code).map((c) => ({ ...c, est: mine.filter((m) => m.code === c.name).reduce((a, m) => a + m.ndf, 0) }));
  const top = top80(codes), topSet = new Set(top.map((c) => c.name));
  const testers = byLabel(mine.filter((m) => topSet.has(m.code)), (m) => m.tester);
  return (
    <>
      <PageHead title="NDF" sub="No defect found: fallaron la primera vez y pasaron al re-probar sin reparación (2do pase del TCQS). Los códigos vienen del reporte de primeras fallas." />
      <div className="yc-grid-kpi">
        <KpiTile label="Primeras fallas" value={n(sum('ff'))} />
        <KpiTile label="NDF" value={n(sum('ndf'))} unit={` · ${pctText((sum('ndf') / sum('ff')) * 100)} % de las fallas`} />
        <KpiTile label="Reales (a reparación)" value={n(sum('real'))} />
        <KpiTile label="Pendientes de re-probar" value={n(sum('pend'))} />
        <KpiTile label="SPY (NDF / entradas)" value={pctText((sum('ndf') / sum('input')) * 100)} unit="%" />
      </div>
      <div className="yc-table-wrap">
        <table className="yc-table">
          <thead><tr><th>Estación</th><th className="num">Entradas</th><th className="num">1ra falla</th><th className="num">NDF</th><th className="num">Real</th><th className="num">Pendiente</th><th className="num">SPY</th><th /></tr></thead>
          <tbody>
            {stations.map((s) => (
              <tr key={s.name} className={s.name === station ? 'is-focus' : undefined} aria-current={s.name === station || undefined}>
                <td className="code">{s.name}</td><td className="num">{n(s.input)}</td><td className="num">{n(s.ff)}</td>
                <td className="num">{n(s.ndf)}</td><td className="num">{n(s.real)}</td><td className="num">{n(s.pend)}</td>
                <td className="num">{pctText((s.ndf / s.input) * 100)} %</td>
                <td><Button variant="quiet" onClick={() => setPick(s.name)}>Ver códigos</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section className="yc-card yc-pad app-sec" aria-labelledby="codigos">
        <h2 id="codigos" className="app-h3">Por qué fallan · <span className="app-mono">{station}</span></h2>
        {!read ? (
          <p className="app-muted">Carga el reporte de <strong>primeras fallas</strong> (FirstFail) en <Link to="/carga">Carga de datos</Link> para ver los códigos de error y los testers.</p>
        ) : read.missing.length ? (
          <p className="app-muted"><Badge tone="bad">Faltan columnas</Badge> El archivo no trae <span className="app-mono">{read.missing.join(', ')}</span>.</p>
        ) : (
          <>
            <p className="app-muted">
              <Badge tone={marked!.distintos ? 'warn' : 'ok'}>{marked!.distintos ? 'Revisar' : 'Cuadra'}</Badge>{' '}
              El archivo cuadra con FIRST_FAIL_QTY del TCQS en {n(marked!.grupos - marked!.distintos)} de {n(marked!.grupos)} grupos (día × orden × estación × tester).
              {' '}«NDF estimado» reparte el 2do pase de cada orden × estación entre sus fallas: el TCQS dice cuántas pasaron al re-probar, no cuáles.
            </p>
            {!codes.length ? <p className="app-muted">Sin primeras fallas de {station} en el archivo.</p> : (
              <>
                <div className="app-charts">
                  <ParetoChart title={`Primeras fallas por código · ${station}`} level={1} subtitle="1er nivel · las de la izquierda suman el 80 %" data={codes.map((c) => ({ label: c.name, value: c.total }))} />
                  <ParetoChart title="Testers de los códigos del 80 %" level={2} subtitle={`2do nivel · ${top.length} código${top.length === 1 ? '' : 's'}`} data={testers.map((t) => ({ label: t.name, value: t.total }))} />
                </div>
                <div className="yc-table-wrap">
                  <table className="yc-table">
                    <thead><tr><th>Código</th><th>Descripción</th><th className="num">Primeras fallas</th><th className="num">NDF estimado</th><th className="num">NDF seguro</th><th className="num">Real seguro</th><th>Pareto 80 %</th></tr></thead>
                    <tbody>{codes.map((c) => (
                      <tr key={c.name}>
                        <td className="code">{c.name}</td><td className="app-desc" title={c.desc}>{c.desc}</td>
                        <td className="num">{n(c.total)}</td><td className="num">{n(c.est)}</td><td className="num">{n(c.NDF)}</td><td className="num">{n(c.Real)}</td>
                        <td>{topSet.has(c.name) ? <Badge tone="warn">Sí</Badge> : <span className="app-muted">No</span>}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </section>
    </>
  );
}
