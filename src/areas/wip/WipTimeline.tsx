// Línea de tiempo del WIP: una fila por estación en el orden del flujo; cada punto junta las piezas con un tiempo parecido
// en la estación (escala logarítmica: minutos y semanas en la misma línea). Animada con Motion; respeta «reducir movimiento».
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { nivel, urgente } from '../../lib/wip.ts';
import { dur, n, type St } from './wipParts.tsx';

const BINS = 32;
const TICKS: [number, string][] = [[0, '0'], [2, '2 h'], [20, '20 h'], [100, '100 h'], [168, '1 sem'], [720, '30 d'], [2160, '90 d']];

export default function WipTimeline({ st, open, onPick }: { st: St[]; open?: string; onPick: (s: string) => void }) {
  const D = Math.max(200, ...st.map((s) => s.max)), L = Math.log1p(D);
  const x = (h: number) => Math.log1p(h) / L, at = (p: number) => Math.expm1(p * L); // posición 0–1 ↔ horas
  const zones = `linear-gradient(90deg, var(--wip-ok-bg) 0 ${x(2) * 100}%, var(--wip-warn-bg) 0 ${x(20) * 100}%, var(--wip-bad-bg) 0 ${x(100) * 100}%, var(--wip-urgent-bg) 0)`;
  const lanes = st.map((s) => {
    const c = new Array<number>(BINS).fill(0);
    for (const p of s.piezas) c[Math.min(BINS - 1, Math.floor(x(p.hours) * BINS))]++;
    return { s, c, top: Math.max(...c) };
  });
  return (
    <MotionConfig reducedMotion="user">
      <div className="app-tl" role="list" aria-label="Línea de tiempo por estación: tiempo de las piezas en cada estación">
        <div className="app-tl-axis" aria-hidden>
          <span />
          <div className="app-tl-ticks">{TICKS.filter(([h]) => h <= D).map(([h, t]) => <span key={t} style={{ left: `${x(h) * 100}%` }}>{t}</span>)}</div>
        </div>
        <AnimatePresence initial>
          {lanes.map(({ s, c, top }, i) => (
            <motion.div key={s.name} role="listitem" layout className={`app-tl-lane${s.name === open ? ' is-open' : ''}`}
              initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.35, delay: Math.min(i, 16) * 0.03, ease: [0.2, 0.7, 0.2, 1] }}>
              {s.section !== lanes[i - 1]?.s.section && <span className="app-tl-sec">{s.section}</span>}
              <button type="button" className="app-tl-name" onClick={() => onPick(s.name)} aria-label={`${s.name}: ${s.n} piezas, la más antigua ${dur(s.max)}. Ver piezas`}>
                <span className="code">{s.name}</span><span className="app-muted">{n(s.n)}</span>
              </button>
              <div className="app-tl-track" style={{ backgroundImage: zones }}>
                {c.map((k, b) => {
                  if (!k) return null;
                  const h = at((b + 0.5) / BINS), size = 8 + 16 * Math.sqrt(k / top);
                  return (
                    <motion.span key={b} className={`app-tl-dot is-${nivel(h)}${urgente(at(b / BINS)) ? ' is-urgent' : ''}`}
                      style={{ left: `${((b + 0.5) / BINS) * 100}%` }} title={`${k} pieza${k === 1 ? '' : 's'} · ${dur(at(b / BINS))} – ${dur(at((b + 1) / BINS))}`}
                      initial={{ scale: 0 }} animate={{ scale: 1, width: size, height: size }}
                      transition={{ type: 'spring', stiffness: 320, damping: 22, delay: Math.min(i, 16) * 0.03 + b * 0.006 }} />
                  );
                })}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
