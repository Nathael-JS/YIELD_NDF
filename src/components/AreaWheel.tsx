// Menú giratorio de áreas: tarjetas en carrusel; la del frente se abre con clic o Enter, las de los lados giran al frente.
// ← → giran; con «reducir movimiento» cambian sin girar. Las poses salen de lib/wheel.ts (probadas aparte).
import { useState, type KeyboardEvent } from 'react';
import { pose, step } from '../lib/wheel.ts';

export interface WheelArea { id: string; name: string; hint: string; icon: string; meta?: string }

export function AreaWheel({ areas, onEnter, start = 0, label = 'Áreas' }: { areas: WheelArea[]; onEnter: (id: string) => void; start?: number; label?: string }) {
  const [front, setFront] = useState(start), n = areas.length;
  const keys = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); setFront(step(front, e.key === 'ArrowRight' ? 1 : -1, n)); }
    if (e.key === 'Enter' && e.target === e.currentTarget) onEnter(areas[front].id);
  };
  return (
    <section className="yc-wheel" aria-roledescription="carrusel" aria-label={`${label}: ← → para girar, Enter para entrar`} tabIndex={0} onKeyDown={keys}>
      <div className="yc-wheel-stage">
        {areas.map((a, i) => {
          const p = pose(i, front, n), isFront = p.d === 0;
          return (
            <button key={a.id} type="button" className={`yc-wheel-card${isFront ? ' is-front' : ''}`} aria-current={isFront || undefined}
              aria-label={isFront ? `Entrar a ${a.name}` : `Girar a ${a.name}`} tabIndex={isFront ? 0 : -1}
              style={{ transform: `translateX(${p.x}%) translateZ(${p.z}px) rotateY(${p.rotate}deg) scale(${p.scale})`, opacity: p.opacity, zIndex: p.zIndex }}
              onClick={() => (isFront ? onEnter(a.id) : setFront(i))}>
              <svg viewBox="0 0 24 24" width="36" height="36" aria-hidden><path d={a.icon} /></svg>
              <strong>{a.name}</strong>
              <span className="yc-wheel-hint">{a.hint}</span>
              {a.meta && <span className="yc-wheel-meta">{a.meta}</span>}
              <span className="yc-wheel-go" aria-hidden>{isFront ? 'Entrar →' : 'Girar'}</span>
            </button>
          );
        })}
      </div>
      <div className="yc-wheel-dots" role="group" aria-label="Elegir área">
        <button type="button" className="yc-icon-btn" aria-label="Anterior" onClick={() => setFront(step(front, -1, n))}>‹</button>
        {areas.map((a, i) => <button key={a.id} type="button" className={`yc-dot${i === front ? ' is-on' : ''}`} aria-label={a.name} aria-current={i === front || undefined} onClick={() => setFront(i)} />)}
        <button type="button" className="yc-icon-btn" aria-label="Siguiente" onClick={() => setFront(step(front, 1, n))}>›</button>
      </div>
    </section>
  );
}
