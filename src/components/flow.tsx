// Flujo de unidades para piso (sistema de diseño): UnitIcon (ícono de producto con el color del tiempo en la estación, late si hay urgentes)
// y FlowMap (Process Stage → Board → estaciones en el orden de la ruta, con UnitIcon y su conteo). Estilos en yc.css («Flujo de unidades»).

/** ok < 2 h · warn < 20 h · bad ≥ 20 h · idle sin piezas. */
export type UnitTone = 'ok' | 'warn' | 'bad' | 'idle';

/** Ícono de producto (caja) con su conteo. Con `onClick` es un botón (abre los seriales). `urgent`: pulso (respeta «reducir movimiento»). */
export function UnitIcon({ tone, n, urgent = false, label, onClick }: { tone: UnitTone; n?: number; urgent?: boolean; label: string; onClick?: () => void }) {
  const body = (
    <>
      <svg viewBox="0 0 24 24" aria-hidden><path d="M4 8l8-4 8 4-8 4-8-4zm0 0v8l8 4 8-4V8M12 12v8" /></svg>
      {n !== undefined && <b>{n.toLocaleString('es-MX')}</b>}
    </>
  );
  const cls = `yc-unit is-${tone}${urgent ? ' is-urgent' : ''}`;
  return onClick
    ? <button type="button" className={cls} onClick={onClick} aria-label={label} title={label}>{body}</button>
    : <span className={cls} role="img" aria-label={label} title={label}>{body}</span>;
}

export interface FlowStation { station: string; n: number; tone: UnitTone; urgent: number }
export interface FlowBoard { board: string; stations: FlowStation[] }
export interface FlowStage { stage: string; boards: FlowBoard[] }

/** Columnas por etapa; en cada una, una tarjeta por board con sus estaciones en orden. Las estaciones sin piezas se ven tenues. */
export function FlowMap({ stages, onPick }: { stages: FlowStage[]; onPick?: (stage: string, board: string, station: string) => void }) {
  return (
    <div className="yc-flow" role="list" aria-label="Flujo de unidades por etapa">
      {stages.map((s, i) => {
        const total = s.boards.reduce((a, b) => a + b.stations.reduce((x, y) => x + y.n, 0), 0);
        return (
          <section key={s.stage} className="yc-flow-stage" role="listitem" aria-label={`${s.stage}: ${total} piezas`}>
            <header><span className="yc-flow-step">{i + 1}</span><h3>{s.stage}</h3><b>{total.toLocaleString('es-MX')}</b></header>
            {s.boards.map((b) => (
              <div key={b.board} className="yc-flow-board">
                <p>{b.board || '—'}</p>
                <ol>{b.stations.map((st) => (
                  <li key={st.station} className={st.n ? '' : 'is-empty'}>
                    <UnitIcon tone={st.n ? st.tone : 'idle'} n={st.n} urgent={st.urgent > 0}
                      label={`${st.station}: ${st.n} piezas${st.urgent ? `, ${st.urgent} urgentes` : ''}`} onClick={st.n && onPick ? () => onPick(s.stage, b.board, st.station) : undefined} />
                    <span className="yc-flow-name">{st.station}</span>
                  </li>
                ))}</ol>
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}

export interface RouteStop { station: string; n: number; tone: UnitTone; urgent: number }
/** Una estación de la línea; `rep`: su reparación (R_…), que se dibuja debajo. */
export interface RouteNode extends RouteStop { rep?: RouteStop }
/** Encabezado que abarca estaciones seguidas (Process Stage o Board): índices `from`–`to` incluidos. */
export interface RouteBand { label: string; from: number; to: number }

const RW = 124, Y_ARC = 6, Y_LINE = 52, Y_REP = 150, H = 196; // ancho de columna y alturas del dibujo (px)

/** Mapa de ruta (como el diagrama de ruta del MES): bandas de etapa y board arriba, la línea principal con un `UnitIcon` por estación,
 * la reparación de cada una debajo, los retornos de reparación a otra estación (punteados) y los saltos de la línea (arco arriba).
 * `retornos` y `saltos` son pares de índices de `nodes` ([reparación de i, estación j] y [desde, hasta]). Con muchas estaciones, scroll horizontal. */
export function RouteMap({ title, nodes, bands = [], retornos = [], saltos = [], onPick }: {
  title: string; nodes: RouteNode[]; bands?: RouteBand[][]; retornos?: [number, number][]; saltos?: [number, number][]; onPick?: (station: string) => void;
}) {
  const x = (i: number) => i * RW + RW / 2, W = nodes.length * RW;
  const stop = (s: RouteStop, rep: boolean) => (
    <UnitIcon tone={s.n ? s.tone : 'idle'} n={s.n} urgent={s.urgent > 0}
      label={`${s.station}${rep ? ' (reparación)' : ''}: ${s.n} piezas${s.urgent ? `, ${s.urgent} urgentes` : ''}${s.n && onPick ? '. Ver seriales' : ''}`}
      onClick={s.n && onPick ? () => onPick(s.station) : undefined} />
  );
  return (
    <div className="yc-route" role="group" aria-label={title}>
      <div className="yc-route-inner" style={{ width: W }}>
        {bands.map((row, k) => (
          <div key={k} className={`yc-route-bands is-${k ? 'sub' : 'top'}`} style={{ gridTemplateColumns: `repeat(${nodes.length}, ${RW}px)` }}>
            {row.map((b) => <span key={`${b.label}-${b.from}`} style={{ gridColumn: `${b.from + 1} / ${b.to + 2}` }} title={b.label}><b>{b.label || '—'}</b></span>)}
          </div>
        ))}
        <div className="yc-route-track" style={{ height: H }}>
          <svg width={W} height={H} aria-hidden>
            <line className="yc-route-rail" x1={x(0)} x2={x(nodes.length - 1)} y1={Y_LINE} y2={Y_LINE} />
            {nodes.map((s, i) => s.rep && <line key={i} className="yc-route-drop" x1={x(i)} x2={x(i)} y1={Y_LINE} y2={Y_REP} />)}
            {retornos.map(([r, j]) => <line key={`r${r}-${j}`} className="yc-route-back" x1={x(r)} y1={Y_REP} x2={x(j)} y2={Y_LINE} />)}
            {saltos.map(([a, b]) => <path key={`s${a}-${b}`} className="yc-route-skip" d={`M${x(a)} ${Y_LINE} C${x(a)} ${Y_ARC}, ${x(b)} ${Y_ARC}, ${x(b)} ${Y_LINE}`} />)}
          </svg>
          <ol>
            {nodes.map((s, i) => (
              <li key={s.station} style={{ left: i * RW, width: RW }} className={s.n || s.rep?.n ? '' : 'is-empty'}>
                <span className="yc-route-stop" style={{ top: Y_LINE }}>{stop(s, false)}</span>
                <span className="yc-route-name" style={{ top: Y_LINE + 20 }} title={s.station}>{s.station}</span>
                {s.rep && <>
                  <span className="yc-route-stop" style={{ top: Y_REP }}>{stop(s.rep, true)}</span>
                  <span className="yc-route-name is-rep" style={{ top: Y_REP + 20 }} title={s.rep.station}>{s.rep.station}</span>
                </>}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
