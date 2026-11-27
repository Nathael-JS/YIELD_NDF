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
