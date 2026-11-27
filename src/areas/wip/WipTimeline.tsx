// Línea de tiempo del WIP: una fila por estación (agrupadas por etapa · board, en el orden del flujo) y una columna por rango de tiempo
// en la estación, de «< 2 h» a «> 2 sem». Cada celda es un ícono de semáforo con su conteo; un clic abre esos seriales.
import { motion, MotionConfig } from 'motion/react';
import { UnitIcon } from '../../components/flow.tsx';
import { nivel, RANGOS, urgente, type Pieza } from '../../lib/wip.ts';
import { dur, n, type St } from './wipParts.tsx';

const desde = (i: number) => (i ? RANGOS[i - 1][1] : 0);
/** Color del rango por su límite de arriba (el mismo semáforo: < 2 h, < 20 h, 20 h o más). */
const tono = (i: number) => nivel(Math.min(RANGOS[i][1], 1e6) - 1e-9);

export default function WipTimeline({ st, open, onPick, onVer }: {
  st: St[]; open?: string; onPick: (s: string) => void; onVer: (titulo: string, ps: Pieza[]) => void;
}) {
  return (
    <MotionConfig reducedMotion="user">
      <div className="yc-table-wrap app-tl">
        <table className="yc-table app-tl-t" aria-label="Línea de tiempo: piezas por estación y tiempo en la estación">
          <thead><tr>
            <th>Estación</th><th className="num">Piezas</th>
            {RANGOS.map(([l], i) => <th key={l} className={`app-tl-h is-${tono(i)}`}>{l}</th>)}
          </tr></thead>
          <tbody>
            {st.map((s, i) => {
              const celdas = RANGOS.map((_, k) => s.piezas.filter((p) => p.hours >= desde(k) && p.hours < RANGOS[k][1]));
              return [
                s.section !== st[i - 1]?.section && <tr key={`g-${s.section}`} className="app-wip-sec"><th colSpan={RANGOS.length + 2} scope="colgroup">{s.section}</th></tr>,
                <motion.tr key={s.name} className={s.name === open ? 'is-focus' : undefined}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2, delay: Math.min(i * 0.01, 0.25) }}>
                  <td><button type="button" className="app-tl-name code" onClick={() => onPick(s.name)} aria-label={`${s.name}: ${s.n} piezas, la más antigua ${dur(s.max)}. Ir a la estación`}>{s.name}</button></td>
                  <td className="num">{n(s.n)}</td>
                  {celdas.map((xs, k) => (
                    <td key={k} className="app-tl-c">{xs.length > 0 && (
                      <UnitIcon tone={tono(k)} n={xs.length} urgent={xs.some((p) => urgente(p.hours))}
                        label={`${s.name} · ${RANGOS[k][0]}: ${xs.length} piezas. Ver seriales`} onClick={() => onVer(`${s.name} · ${RANGOS[k][0]} en la estación`, xs)} />
                    )}</td>
                  ))}
                </motion.tr>,
              ];
            })}
          </tbody>
        </table>
      </div>
    </MotionConfig>
  );
}
