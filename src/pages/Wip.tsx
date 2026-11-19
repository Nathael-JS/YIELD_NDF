import { Fragment, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, KpiTile, Segmented, Select } from '../components/ui.tsx';
import { modelKey, pctText } from '../lib/tcqs.ts';
import { cruce, desde, nivel, readWip, stations, urgente, type Estado, type Pieza, type Ventana } from '../lib/wip.ts';
import { useApp, useData } from '../store.ts';
import { PageHead } from './Layout.tsx';

const n = (v: number) => v.toLocaleString('es-MX');
/** 45 min · 5.2 h · 6 d 4 h */
const dur = (h: number) => (h < 1 ? `${Math.round(h * 60)} min` : h < 48 ? `${h.toFixed(1)} h` : `${Math.floor(Math.round(h) / 24)} d ${Math.round(h) % 24} h`);
const VENTANAS: { value: Ventana; label: string }[] = [
  { value: 'hora', label: 'Hora' }, { value: 'turno', label: 'Turno' }, { value: 'dia', label: 'Día' }, { value: 'semana', label: 'Semana' }, { value: 'todo', label: 'Todo' },
];
const TONE: Record<Estado, 'neutral' | 'warn' | 'bad' | 'info'> = { Línea: 'neutral', Hold: 'warn', Reparación: 'info', Bonpile: 'bad' };
const MAX_UNITS = 100; // piezas por estación a la vista (las más antiguas primero)

/** Horas en la estación con su color; las urgentes (> 100 h) laten. */
const Hours = ({ h }: { h: number }) => (
  <span className={`app-wip-h is-${nivel(h)}${urgente(h) ? ' is-urgent' : ''}`} title={urgente(h) ? 'Urgente: más de 100 h en la estación' : undefined}>{dur(h)}</span>
);

export default function Wip() {
  const file = useApp((s) => s.files.WIP);
  const { records, models } = useData();
  const read = useMemo(() => file && readWip(file), [file]);
  const [model, setModel] = useState(''), [mo, setMo] = useState(''), [q, setQ] = useState(''), [win, setWin] = useState<Ventana>('todo');
  const [open, setOpen] = useState<string>();

  if (!read) return (
    <>
      <PageHead title="WIP" sub="Dónde está cada pieza y desde hace cuánto." />
      <p className="yc-card app-empty">Carga el reporte WIP en <Link to="/carga">Carga de datos</Link> para ver esta página.</p>
    </>
  );
  if (read.missing.length) return (
    <>
      <PageHead title="WIP" sub="Dónde está cada pieza y desde hace cuánto." />
      <p className="yc-card app-empty">Al archivo le faltan columnas: {read.missing.join(', ')}.</p>
    </>
  );

  // del proyecto (lista de modelos de la base, como el TCQS)
  const mine = read.piezas.filter((p) => !models || models.has(modelKey(p.model)));
  const from = desde(read.corte, win), term = q.trim().toUpperCase();
  const keep = (p: Pieza) => (!model || p.model === model) && (!mo || p.mo === mo) && (!term || p.serial.toUpperCase().includes(term)) && p.at >= from;
  const ps = mine.filter(keep);
  const fuera = (l: Pieza[]) => n(l.filter((p) => (!models || models.has(modelKey(p.model))) && keep(p)).length);
  const st = stations(ps, records), top = Math.max(1, ...st.map((s) => s.n));
  const x = cruce(mine, records);
  const count = (e: Estado) => ps.filter((p) => p.estado === e).length;
  const orders = [...new Set(mine.filter((p) => !model || p.model === model).map((p) => p.mo))].sort();

  return (
    <>
      <PageHead title="WIP" sub={`Dónde está cada pieza y desde hace cuánto · corte ${read.corte.slice(0, 16)} · ${file!.name}`} />
      <section className="yc-card app-wip-filters" aria-label="Filtros">
        <Select label="Modelo" value={model} onChange={(v) => { setModel(v); setMo(''); }} options={[{ value: '', label: 'Todos' }, ...[...new Set(mine.map((p) => p.model))].sort()]} />
        <Select label="Orden" value={mo} onChange={setMo} options={[{ value: '', label: 'Todas' }, ...orders]} />
        <label className="yc-field">Serial<input className="yc-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" /></label>
        <Segmented label="Llegaron en la última" options={VENTANAS} value={win} onChange={setWin} />
      </section>

      <div className="yc-grid-kpi">
        <KpiTile label="En línea" value={n(count('Línea'))} />
        <KpiTile label="Hold" value={n(count('Hold'))} />
        <KpiTile label="Reparación y bonpile" value={n(count('Reparación') + count('Bonpile'))} />
        <KpiTile label="Bloqueadas" value={n(ps.filter((p) => p.blocked).length)} />
        <KpiTile label="Urgentes (> 100 h)" value={n(ps.filter((p) => urgente(p.hours)).length)} />
      </div>

      <section className="yc-card app-wip" aria-labelledby="wip-flow">
        <header className="app-wip-head">
          <h2 id="wip-flow" className="app-h3">Flujo por estación</h2>
          <span className="app-wip-legend" aria-label="Tiempo en la estación">
            <i className="is-ok" /> &lt; 2 h <i className="is-warn" /> &lt; 20 h <i className="is-bad" /> 20 h o más <i className="is-urgent" /> urgente &gt; 100 h
          </span>
        </header>
        {st.length ? (
          <div className="yc-table-wrap">
            <table className="yc-table app-wip-table">
              <thead><tr><th>Estación</th><th className="num">Piezas</th><th>Tiempo en la estación</th><th className="num">Más antigua</th><th className="num">FPY (TCQS)</th><th /></tr></thead>
              <tbody>
                {st.map((s, i) => (
                  <Fragment key={s.name}>
                    {s.section !== st[i - 1]?.section && <tr className="app-wip-sec"><th colSpan={6} scope="colgroup">{s.section}</th></tr>}
                    <tr className={s.name === open ? 'is-focus' : undefined} style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
                      <td><div className="app-wip-name">
                        <span className="code">{s.name}</span>
                        {s.estado !== 'Línea' && <Badge tone={TONE[s.estado]}>{s.estado}</Badge>}
                        {s.cuello && <Badge tone="bad" title="FPY bajo la meta y 10 o más piezas esperando">Cuello de botella</Badge>}
                        {s.blocked > 0 && <Badge tone="warn">{s.blocked} bloqueada{s.blocked === 1 ? '' : 's'}</Badge>}
                      </div></td>
                      <td className="num">{n(s.n)}</td>
                      <td>
                        <span className="app-wip-bar" style={{ width: `${(s.n / top) * 100}%` }} role="img" aria-label={`${s.ok} < 2 h · ${s.warn} < 20 h · ${s.bad} de 20 h o más`} title={`${s.ok} < 2 h · ${s.warn} < 20 h · ${s.bad} de 20 h o más`}>
                          {(['ok', 'warn', 'bad'] as const).map((k) => s[k] > 0 && <span key={k} className={`is-${k}`} style={{ flexGrow: s[k] }} />)}
                        </span>
                      </td>
                      <td className="num"><Hours h={s.max} />{s.urgent > 0 && <span className="app-muted"> · {s.urgent} urg.</span>}</td>
                      <td className="num">{Number.isFinite(s.fpy) ? `${pctText(s.fpy)} %` : '—'}</td>
                      <td><button type="button" className="yc-btn yc-btn-quiet" aria-expanded={s.name === open} onClick={() => setOpen(s.name === open ? undefined : s.name)}>{s.name === open ? 'Ocultar' : 'Ver piezas'}</button></td>
                    </tr>
                    {s.name === open && (
                      <tr className="app-wip-units"><td colSpan={6}>
                        <table className="yc-table">
                          <thead><tr><th>Serial</th><th>Orden</th><th>Modelo</th><th>Llegó</th><th className="num">En la estación</th><th /></tr></thead>
                          <tbody>{s.piezas.slice(0, MAX_UNITS).map((p) => (
                            <tr key={p.serial}>
                              <td className="code">{p.serial}</td><td className="code">{p.mo}</td><td className="code">{p.model}</td><td>{p.at.slice(5, 16)}</td>
                              <td className="num"><Hours h={p.hours} /></td><td>{p.blocked && <Badge tone="warn">Bloqueada</Badge>}</td>
                            </tr>
                          ))}</tbody>
                        </table>
                        {s.n > MAX_UNITS && <p className="app-muted">Se muestran las {MAX_UNITS} más antiguas de {n(s.n)}; filtra por orden o serial para ver otras.</p>}
                      </td></tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="app-muted">Ninguna pieza con estos filtros.</p>}
        <p className="app-muted">
          {fuera(read.terminadas)} terminadas (STOCKIN) y {fuera(read.ocultas)} en empaque (FG, PACK_CTN, PACK_PALT) no se muestran.
          {records.length ? ` Cruce con el TCQS: ${x.soloWip.length} órdenes con piezas en proceso no están en el TCQS; ${x.soloTcqs.length} del TCQS no tienen piezas en proceso.` : ' Carga el TCQS para ver el FPY de cada estación.'}
          {read.bad.length > 0 && ` ${read.bad.length} filas sin serial, estación u hora se ignoraron.`}
        </p>
      </section>
    </>
  );
}
