import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, KpiTile, PeriodTabs } from '../components/ui.tsx';
import { loadCargas, loadSummary, type Carga } from '../lib/db.ts';
import { by, byFpy, change, countOrders, fromDb, pctText, ranges, readTcqs, shortDay, totals, type Congruencia, type DbRow } from '../lib/tcqs.ts';
import { useData } from '../store.ts';
import { PageHead } from './Layout.tsx';

const n = (v: number) => v.toLocaleString('es-MX');
type Mode = 'dia' | 'semana';
const label = ([a, b]: [string, string]) => (a === b ? shortDay(a) : `${shortDay(a)} – ${shortDay(b)}`);
const CAMPOS: Record<keyof Congruencia['campos'], string> = {
  entradas: 'Entradas = 1er pase + 1ra falla', fpy: 'FPRATE', retest: 'RETESTRATE', final: 'FINAL_YIELD_RATE', segunda_falla: '2da falla (REFAIL_QTY)',
};
/** Cambio en puntos con su tono: ±2 pts o más se marca. */
function delta(d: number | undefined) {
  if (d == null) return <Badge tone="neutral" title="Menos de 10 entradas en alguno de los dos periodos">Datos insuficientes</Badge>;
  return <Badge tone={d >= 2 ? 'ok' : d <= -2 ? 'bad' : 'neutral'}>{d > 0 ? '▲ ' : d < 0 ? '▼ ' : ''}{Math.abs(d)} pts</Badge>;
}

/** Un día (o semana) contra el anterior, leídos de la base, y lo que no cuadró del TCQS en ese rango. */
export default function Comparativas() {
  const { to } = useData();
  const go = useNavigate();
  const soon = useRef<HTMLDialogElement>(null);
  const [day, setDay] = useState(to ?? new Date().toISOString().slice(0, 10)); // por defecto, el último día cargado
  const [mode, setMode] = useState<Mode>('dia');
  const [rows, setRows] = useState<DbRow[]>();
  const [cargas, setCargas] = useState<Carga[]>([]);
  const [fail, setFail] = useState<string>();
  const [cur, prev] = ranges(day, mode);
  useEffect(() => {
    setRows(undefined); setFail(undefined);
    loadSummary(prev[0], cur[1]).then(setRows).catch((e) => setFail(e.message));
  }, [prev[0], cur[1]]);
  useEffect(() => { loadCargas().then(setCargas).catch(() => {}); }, []);

  const recs = ([a, b]: [string, string]) => readTcqs(fromDb((rows ?? []).filter((r) => r.fecha >= a && r.fecha <= b))).records;
  const ra = recs(prev), rb = recs(cur), ta = totals(ra), tb = totals(rb);
  const missing = rows && [!ra.length && prev, !rb.length && cur].filter(Boolean) as [string, string][];
  const kpi = (title: string, key: 'fpy' | 'final' | 'retest', worse = false) => {
    const d = change(tb, ta, key);
    return <KpiTile key={key} label={title} value={pctText(tb[key])} unit="%" delta={d} deltaUnit=" pts" good={d == null || (worse ? d <= 0 : d >= 0)} />;
  };
  const before = new Map(by(ra, (r) => r.group).map((s) => [s.name, s]));
  const stations = by(rb, (r) => r.group).filter((s) => s.input > 0).sort(byFpy);
  const orders = countOrders(rb);
  // la revisión de congruencia más reciente que cubre el rango elegido (se guarda al cargar cada TCQS)
  const review = cargas.find((c) => c.congruencia && c.desde <= cur[1] && c.hasta >= cur[0]);
  const campos = Object.entries(review?.congruencia?.campos ?? {}) as [keyof Congruencia['campos'], Congruencia['campos'][keyof Congruencia['campos']]][];
  const bad = campos.filter(([, c]) => c!.mal > 0);
  // cargas guardadas antes de 0.19.0 no traen ejemplos (solo n.º de fila)
  const mismatches = bad.flatMap(([k, c]) => (c!.ejemplos ?? []).filter((e) => e.fecha >= cur[0] && e.fecha <= cur[1]).map((e) => ({ k, ...e })));

  return (
    <>
      <PageHead title="Comparativas" sub={`${label(cur)} contra ${mode === 'dia' ? 'el día anterior' : 'la semana anterior'} (${label(prev)}), con lo guardado en la base.`}>
        <PeriodTabs value={mode} onChange={(m) => { setMode(m as Mode); if (m === 'semana') soon.current?.showModal(); }}
          options={[{ id: 'dia', label: 'Día', hint: 'Contra el día anterior' }, { id: 'semana', label: 'Semana', hint: 'Lunes a sábado' }]} />
        <label className="yc-field">{mode === 'dia' ? 'Día' : 'Un día de la semana'}<input className="yc-input" type="date" value={day} max={new Date().toISOString().slice(0, 10)} onChange={(e) => e.target.value && setDay(e.target.value)} /></label>
      </PageHead>
      <dialog ref={soon} className="app-soon" aria-labelledby="soon-title">
        <h2 id="soon-title" className="app-h3">Semana <Badge tone="info">En desarrollo</Badge></h2>
        <p className="app-muted">Ya compara lunes a sábado (sin domingo) contra la semana anterior, con los mismos datos de la base que por día. La vista puede cambiar mientras se termina.</p>
        <form method="dialog"><Button variant="primary" type="submit">Entendido</Button></form>
      </dialog>
      {fail && <p className="app-muted" role="alert"><Badge tone="bad">Error</Badge> No se pudo leer la base: {fail}</p>}
      {!rows && !fail && <p className="app-muted" role="status">Leyendo la base…</p>}
      {missing && missing.length > 0 && (
        <section className="yc-card yc-pad app-sec" role="status">
          <h2 className="app-h3">Faltan datos <Badge tone="warn">{missing.map(label).join(' y ')}</Badge></h2>
          <p className="app-muted">La base no tiene información de {missing.map(label).join(' ni de ')}: nunca se cargó o se borró. Carga el TCQS que la incluya (o restaura su respaldo en Historial) y vuelve aquí.</p>
          <Button variant="primary" onClick={() => go('/carga')}>Ir a Carga de datos</Button>
        </section>
      )}
      {rows && rb.length > 0 && ra.length > 0 && (
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
                <th className="num">FPY {label(prev)}</th><th className="num">FPY {label(cur)}</th><th>Cambio FPY</th>
                <th className="num">Final {label(prev)}</th><th className="num">Final {label(cur)}</th><th>Cambio Final</th>
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
      <section className="yc-card yc-pad app-sec" aria-labelledby="nocuadra">
        <h2 id="nocuadra" className="app-h3">Datos que no cuadran · {label(cur)}</h2>
        {!review ? (
          <>
            <p className="app-muted">No hay revisión del TCQS para este rango: se hace al cargar el archivo. Carga el TCQS que lo incluya y vuelve aquí.</p>
            <Button onClick={() => go('/carga')}>Ir a Carga de datos</Button>
          </>
        ) : !bad.length ? (
          <p className="app-muted"><Badge tone="ok">Todo cuadra</Badge> {review.archivo}: las columnas del archivo coinciden con las fórmulas.</p>
        ) : (
          <>
            <p className="app-muted">En todo {review.archivo} ({review.usuario}, {shortDay(review.desde)} – {shortDay(review.hasta)}) no cuadran: {bad.map(([k, c]) => `${CAMPOS[k]} ${n(c!.mal)} de ${n(c!.ok + c!.mal)} filas`).join(' · ')}. La 2da falla no cuadra cuando hay retests de unidades de otro día: es esperado.</p>
            {!mismatches.length ? <p className="app-muted">Se guardan hasta 10 ejemplos por columna y ninguno es de {label(cur)}: abre el archivo para revisar las filas de estas fechas.</p> : (
            <div className="yc-table-wrap">
              <table className="yc-table">
                <thead><tr><th>Columna</th><th className="num">Fila</th><th>Fecha</th><th>Estación</th><th className="num">Archivo</th><th className="num">Fórmula</th></tr></thead>
                <tbody>{mismatches.map((m) => (
                  <tr key={`${m.k}${m.fila}`}>
                    <td>{CAMPOS[m.k]} {m.k === 'segunda_falla' && <Badge tone="neutral" title="Retest de una unidad que falló otro día">Esperado</Badge>}</td>
                    <td className="num">{m.fila}</td><td className="code">{shortDay(m.fecha)}</td><td className="code">{m.estacion}</td>
                    <td className="num">{n(m.archivo)}</td><td className="num">{n(m.calculado)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            )}
          </>
        )}
      </section>
    </>
  );
}
