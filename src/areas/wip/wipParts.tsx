// Piezas del WIP que comparten la página y el reporte HTML (sin Motion: el HTML se dibuja sin JavaScript).
import { Fragment, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Badge, KpiTile } from '../../components/ui.tsx';
import { modelKey, pctText } from '../../lib/tcqs.ts';
import { estadoOf, nivel, readWip, urgente, type Estado, type ordenes, type Pieza, type stations } from '../../lib/wip.ts';
import { UnitIcon } from '../../components/flow.tsx';
import { useApp, useData } from '../../store.ts';

import { num as n } from '../../lib/chart.ts';
export { n };
/** 45 min · 5.2 h · 6 d 4 h */
export const dur = (h: number) => (h < 1 ? `${Math.round(h * 60)} min` : h < 48 ? `${h.toFixed(1)} h` : `${Math.floor(Math.round(h) / 24)} d ${Math.round(h) % 24} h`);
export const TONE: Record<Estado, 'neutral' | 'warn' | 'bad' | 'info'> = { Línea: 'neutral', Hold: 'warn', Reparación: 'info', Bonpile: 'bad' };
export type St = ReturnType<typeof stations>[number];
export type Orden = ReturnType<typeof ordenes>[number];

/** Horas en la estación con su color; las urgentes (> 100 h) laten. */
export const Hours = ({ h }: { h: number }) => (
  <span className={`app-wip-h${urgente(h) ? ' is-urgent' : ''}`}>
    <UnitIcon tone={nivel(h)} urgent={urgente(h)} label={urgente(h) ? 'Urgente: más de 100 h en la estación' : `${dur(h)} en la estación`} />{dur(h)}
  </span>
);

/** Leyenda con el mismo ícono de producto que la tabla. */
export const Legend = () => (
  <span className="app-wip-legend" aria-label="Tiempo en la estación">
    <UnitIcon tone="ok" label="Menos de 2 h" /> &lt; 2 h <UnitIcon tone="warn" label="Menos de 20 h" /> &lt; 20 h <UnitIcon tone="bad" label="20 h o más" /> 20 h o más
    <UnitIcon tone="bad" urgent label="Urgente: más de 100 h" /> urgente &gt; 100 h
  </span>
);
const NIVEL = { ok: 'menos de 2 h', warn: 'menos de 20 h', bad: '20 h o más' } as const;

export const kpisOf = (ps: Pieza[]) => {
  const c = (e: Estado) => ps.filter((p) => p.estado === e).length;
  return [
    { label: 'En línea', value: c('Línea') }, { label: 'Hold', value: c('Hold') }, { label: 'Reparación y bonpile', value: c('Reparación') + c('Bonpile') },
    { label: 'Bloqueadas', value: ps.filter((p) => p.blocked).length }, { label: 'Urgentes (> 100 h)', value: ps.filter((p) => urgente(p.hours)).length },
  ];
};
export const Kpis = ({ ps }: { ps: Pieza[] }) => <div className="yc-grid-kpi">{kpisOf(ps).map((k) => <KpiTile key={k.label} label={k.label} value={n(k.value)} />)}</div>;

/** Flujo por estación agrupado por sección. Con `units` la fila se abre con sus piezas (página); sin él es fija (HTML).
 * `onPick`: clic en el ícono de un nivel de tiempo (abre esos seriales). */
export function FlowTable({ st, open, onOpen, units, onPick }: { st: St[]; open?: string; onOpen?: (s: string | undefined) => void; units?: (s: St) => ReactNode; onPick?: (station: string, nivel: 'ok' | 'warn' | 'bad') => void }) {
  const cols = onOpen ? 6 : 5;
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
                <td><span className="app-wip-units-row">
                  {(['ok', 'warn', 'bad'] as const).map((k) => s[k] > 0 && (
                    <UnitIcon key={k} tone={k} n={s[k]} urgent={k === 'bad' && s.urgent > 0} label={`${s.name}: ${s[k]} piezas con ${NIVEL[k]}${k === 'bad' && s.urgent ? `, ${s.urgent} urgentes` : ''}${onPick ? '. Ver seriales' : ''}`}
                      onClick={onPick ? () => onPick(s.name, k) : undefined} />
                  ))}
                </span></td>
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

/** Lo que muestra la ventana de seriales (una pieza del WIP o del corte guardado). */
type Serial = { serial: string; model: string; mo: string; station: string; hours: number; blocked: boolean };
/** Lista de seriales con su tiempo (ventana). */
export function Seriales({ titulo, ps, onClose }: { titulo: string; ps: Serial[]; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return (
    <dialog ref={ref} className="yc-card app-det app-ser" aria-labelledby="ser-t" onClose={onClose} onClick={(e) => e.target === ref.current && ref.current?.close()}>
      <header className="app-det-head">
        <div><span className="app-item-k">{ps.length} {ps.length === 1 ? 'pieza' : 'piezas'}</span><h2 id="ser-t">{titulo}</h2></div>
        <button type="button" className="yc-btn yc-btn-quiet" onClick={() => ref.current?.close()}>Cerrar</button>
      </header>
      <div className="yc-table-wrap app-ser-t">
        <table className="yc-table">
          <thead><tr><th>Serial</th><th className="num">Tiempo ahí</th><th>Estación</th><th>Estado</th><th>Modelo</th><th>Orden</th></tr></thead>
          <tbody>{[...ps].sort((a, b) => b.hours - a.hours).map((p) => (
            <tr key={p.serial}><td className="code app-ser-sn">{p.serial}</td><td className="num"><Hours h={p.hours} /></td><td className="code">{p.station}</td>
              <td>{p.blocked ? <Badge tone="bad">Bloqueada</Badge> : <Badge tone="neutral">{estadoOf(p.station)}</Badge>}</td><td className="code">{p.model}</td><td className="code">{p.mo}</td></tr>
          ))}</tbody>
        </table>
      </div>
    </dialog>
  );
}

