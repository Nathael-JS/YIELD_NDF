// Panel de Novedades: las últimas versiones del CHANGELOG con el título de cada cambio. Se carga solo al abrirlo (el CHANGELOG pesa).
import { useEffect, useRef } from 'react';
import md from '../../CHANGELOG.md?raw';
import { Badge } from '../components/ui.tsx';
import { mayor, novedades } from '../lib/novedades.ts';

export default function Novedades({ visto, onClose }: { visto: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null), lista = novedades(md, 8);
  useEffect(() => { ref.current?.showModal(); }, []);
  return (
    <dialog ref={ref} className="yc-card app-det app-nov" aria-labelledby="nov-t" onClose={onClose} onClick={(e) => e.target === ref.current && ref.current?.close()}>
      <header className="app-det-head">
        <div><span className="app-item-k">Versión {__VERSION__}</span><h2 id="nov-t">Novedades</h2></div>
        <button type="button" className="yc-btn yc-btn-quiet" onClick={() => ref.current?.close()}>Cerrar</button>
      </header>
      <ol className="app-nov-list">
        {lista.map((v) => (
          <li key={v.version} className={visto && mayor(v.version, visto) ? 'is-new' : ''}>
            <header><b>{v.version}</b><span className="app-muted">{v.fecha}</span>{(!visto || mayor(v.version, visto)) && <Badge tone="info">Nuevo</Badge>}</header>
            <ul>{v.cambios.map((c) => <li key={c}>{c}</li>)}</ul>
          </li>
        ))}
      </ol>
    </dialog>
  );
}
