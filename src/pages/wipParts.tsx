// Piezas del WIP que comparten la página y el reporte HTML (sin Motion: el HTML se dibuja sin JavaScript).
import { Fragment, useMemo, type ReactNode } from 'react';
import { Badge, KpiTile } from '../components/ui.tsx';
import { modelKey, pctText } from '../lib/tcqs.ts';
import { nivel, readWip, urgente, type Estado, type ordenes, type Pieza, type stations } from '../lib/wip.ts';
import { useApp, useData } from '../store.ts';

export const n = (v: number) => v.toLocaleString('es-MX');
/** 45 min · 5.2 h · 6 d 4 h */
export const dur = (h: number) => (h < 1 ? `${Math.round(h * 60)} min` : h < 48 ? `${h.toFixed(1)} h` : `${Math.floor(Math.round(h) / 24)} d ${Math.round(h) % 24} h`);
export const TONE: Record<Estado, 'neutral' | 'warn' | 'bad' | 'info'> = { Línea: 'neutral', Hold: 'warn', Reparación: 'info', Bonpile: 'bad' };
export type St = ReturnType<typeof stations>[number];
export type Orden = ReturnType<typeof ordenes>[number];

/** Horas en la estación con su color; las urgentes (> 100 h) laten. */
export const Hours = ({ h }: { h: number }) => (
  <span className={`app-wip-h is-${nivel(h)}${urgente(h) ? ' is-urgent' : ''}`} title={urgente(h) ? 'Urgente: más de 100 h en la estación' : undefined}>{dur(h)}</span>
);

export const Legend = () => (
  <span className="app-wip-legend" aria-label="Tiempo en la estación">
    <i className="is-ok" /> &lt; 2 h <i className="is-warn" /> &lt; 20 h <i className="is-bad" /> 20 h o más <i className="is-urgent" /> urgente &gt; 100 h
  </span>
);

export const kpisOf = (ps: Pieza[]) => {
  const c = (e: Estado) => ps.filter((p) => p.estado === e).length;
  return [
    { label: 'En línea', value: c('Línea') }, { label: 'Hold', value: c('Hold') }, { label: 'Reparación y bonpile', value: c('Reparación') + c('Bonpile') },
    { label: 'Bloqueadas', value: ps.filter((p) => p.blocked).length }, { label: 'Urgentes (> 100 h)', value: ps.filter((p) => urgente(p.hours)).length },
  ];
};
export const Kpis = ({ ps }: { ps: Pieza[] }) => <div className="yc-grid-kpi">{kpisOf(ps).map((k) => <KpiTile key={k.label} label={k.label} value={n(k.value)} />)}</div>;

/** Flujo por estación agrupado por sección. Con `units` la fila se abre con sus piezas (página); sin él es fija (HTML). */
export function FlowTable({ st, open, onOpen, units }: { st: St[]; open?: string; onOpen?: (s: string | undefined) => void; units?: (s: St) => ReactNode }) {
  const top = Math.max(1, ...st.map((s) => s.n)), cols = onOpen ? 6 : 5;
  return (
    <div className="yc-table-wrap">
      <table className="yc-table app-wip-table">
        <thead><tr><th>Estación</th><th className="num">Piezas</th><th>Tiempo en la estación</th><th className="num">Más antigua</th><th className="num">FPY (TCQS)</th>{onOpen && <th />}</tr></thead>
        <tbody>
          {st.map((s, i) => (
            <Fragment key={s.name}>
              {s.section !== st[i - 1]?.section && <tr className="app-wip-sec"><th colSpan={cols} scope="colgroup">{s.section}</th></tr>}
              <tr id={`wip-${s.name}`} className={s.name === open ? 'is-focus' : undefined} style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
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
                {onOpen && <td><button type="button" className="yc-btn yc-btn-quiet" aria-expanded={s.name === open} onClick={() => onOpen(s.name === open ? undefined : s.name)}>{s.name === open ? 'Ocultar' : 'Ver piezas'}</button></td>}
              </tr>
              {s.name === open && units && <tr className="app-wip-units"><td colSpan={cols}>{units(s)}</td></tr>}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Piezas con su serial, orden, estación y tiempo (más antiguas primero). */
export function UnitTable({ ps, station }: { ps: Pieza[]; station?: boolean }) {
  return (
    <table className="yc-table">
      <thead><tr><th>Serial</th><th>Orden</th><th>Modelo</th>{station && <th>Estación</th>}<th>Llegó</th><th className="num">En la estación</th><th /></tr></thead>
      <tbody>{ps.map((p) => (
        <tr key={p.serial}>
          <td className="code">{p.serial}</td><td className="code">{p.mo}</td><td className="code">{p.model}</td>{station && <td className="code">{p.station}</td>}<td>{p.at.slice(5, 16)}</td>
          <td className="num"><Hours h={p.hours} /></td><td>{p.blocked && <Badge tone="warn">Bloqueada</Badge>}</td>
        </tr>
      ))}</tbody>
    </table>
  );
}

/** Por orden: en proceso por estado, terminadas y la más antigua. */
export function OrderTable({ os, onPick }: { os: Orden[]; onPick?: (mo: string) => void }) {
  return (
    <div className="yc-table-wrap">
      <table className="yc-table">
        <thead><tr><th>Orden</th><th>Modelo</th><th className="num">En proceso</th><th className="num">Línea</th><th className="num">Hold</th><th className="num">Rep. y bonpile</th><th className="num">Bloqueadas</th><th className="num">Terminadas</th><th className="num">Más antigua</th>{onPick && <th />}</tr></thead>
        <tbody>{os.map((o) => (
          <tr key={o.mo}>
            <td className="code">{o.mo}</td><td className="code">{o.model}</td><td className="num">{n(o.n)}</td><td className="num">{n(o.linea)}</td><td className="num">{n(o.hold)}</td>
            <td className="num">{n(o.rep)}</td><td className="num">{n(o.blocked)}</td><td className="num">{n(o.terminadas)}</td>
            <td className="num">{o.n ? <Hours h={o.max} /> : '—'}{o.urgent > 0 && <span className="app-muted"> · {o.urgent} urg.</span>}</td>
            {onPick && <td><button type="button" className="yc-btn yc-btn-quiet" onClick={() => onPick(o.mo)}>Ver flujo</button></td>}
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

/** Urgentes (> 100 h) y bloqueadas, las más antiguas primero. */
export const criticas = (ps: Pieza[]) => ps.filter((p) => urgente(p.hours) || p.blocked).sort((a, b) => b.hours - a.hours);

/** El WIP leído y filtrado al proyecto (lo usan la página y Descargas). */
export function useWip() {
  const file = useApp((s) => s.files.WIP);
  const { records, models } = useData();
  const read = useMemo(() => file && readWip(file, file.cargado), [file]);
  const mine = (l: Pieza[]) => l.filter((p) => !models || models.has(modelKey(p.model)));
  return { file, read, records, mine };
}
