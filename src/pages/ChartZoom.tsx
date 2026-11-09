import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { Badge, Button } from '../components/ui.tsx';
import { loadComentarios, saveComentario, type Comentario } from '../lib/db.ts';
import { download } from '../lib/download.ts';
import { shortDate } from '../store.ts';
import type { Slide } from './slides.tsx';

/** Gráfica ampliada en pantalla dividida: la gráfica, la tabla con sus datos y comentarios guardados en la base.
 * «Descargar imagen» toma este mismo panel (sin botones ni formulario) como PNG. */
export default function ChartZoom({ slide, range, grafica, onClose }: { slide: Slide; range: string; grafica: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null), shot = useRef<HTMLDivElement>(null);
  const [list, setList] = useState<Comentario[]>([]);
  const [msg, setMsg] = useState<['ok' | 'bad', string]>();
  const [busy, setBusy] = useState(false);
  // al montar y en el mismo cuadro: la transición de Gráficos fotografía el panel ya abierto
  useLayoutEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => {
    loadComentarios(grafica).then(setList).catch((e) => setMsg(['bad', `No se pudieron leer los comentarios: ${e.message}`]));
  }, [grafica]);

  const save = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget, texto = String(new FormData(form).get('texto')).trim();
    if (!texto) return;
    saveComentario(grafica, texto)
      .then((c) => { setList((l) => [c, ...l]); form.reset(); setMsg(['ok', 'Comentario guardado.']); })
      .catch((err) => setMsg(['bad', `No se guardó: ${err.message}`]));
  };
  const image = async () => {
    setBusy(true);
    const node = shot.current!;
    try {
      // se carga al pedirla; dibuja el panel con sus estilos y fuentes. Botones y formulario se ocultan
      // (no solo se filtran) para que la imagen no deje su hueco
      const { toBlob } = await import('html-to-image');
      node.classList.add('is-shot');
      const blob = await toBlob(node, { pixelRatio: 2, backgroundColor: getComputedStyle(node).backgroundColor });
      if (!blob) throw new Error('imagen vacía');
      download(`grafica-${slide.id}-${range.replace(/\W+/g, '-').toLowerCase()}.png`, blob);
    } catch (e) {
      setMsg(['bad', `No se pudo crear la imagen: ${e instanceof Error ? e.message : e}`]);
    } finally { node.classList.remove('is-shot'); setBusy(false); }
  };

  return (
    // Esc no cierra de golpe: cierra con la misma animación que «Cerrar»
    <dialog ref={dialog} className="app-zoom" onCancel={(e) => { e.preventDefault(); onClose(); }} aria-labelledby="zoom-title">
      <div className="app-zoom-shot" ref={shot}>
        <header className="app-zoom-head">
          <div><span className="yc-carousel-kind">{slide.kind}</span><h2 id="zoom-title">{slide.title}</h2><p className="app-muted">Juliet · {range}</p></div>
          <div className="yc-row" data-noshot>
            <Button onClick={image} disabled={busy}>{busy ? 'Creando imagen…' : 'Descargar imagen'}</Button>
            <Button variant="quiet" onClick={onClose}>Cerrar</Button>
          </div>
        </header>
        {msg && <p className="app-muted app-msg" role={msg[0] === 'bad' ? 'alert' : 'status'} data-noshot><Badge tone={msg[0]}>{msg[0] === 'ok' ? 'Listo' : 'Error'}</Badge> {msg[1]}</p>}
        <div className="app-zoom-split">
          <div className="app-zoom-chart" style={{ viewTransitionName: 'yc-zoom' }}>{slide.content}</div>
          <aside className="app-zoom-side">
            <section className="app-zoom-sec">
              <h3 className="app-h3">Resumen · {slide.summary.rows.length} filas</h3>
              <div className="yc-table-wrap">
                <table className="yc-table">
                  <thead><tr>{slide.summary.head.map((h, i) => <th key={h} className={i ? 'num' : undefined}>{h}</th>)}</tr></thead>
                  <tbody>{slide.summary.rows.map((r) => (
                    <tr key={String(r[0])}>{r.map((v, i) => <td key={i} className={i ? 'num' : 'code'}>{typeof v === 'number' ? v.toLocaleString('es-MX') : v}</td>)}</tr>
                  ))}</tbody>
                </table>
              </div>
            </section>
            <section className="app-zoom-sec">
              <h3 className="app-h3">Comentarios</h3>
              <form className="app-zoom-form" onSubmit={save} data-noshot>
                <label className="yc-field">Nuevo comentario<textarea className="yc-input app-textarea" name="texto" maxLength={2000} required placeholder="Qué se ve, a quién avisar, qué se hizo…" /></label>
                <Button variant="primary" type="submit">Guardar comentario</Button>
              </form>
              {list.length ? (
                <ul className="app-comments">
                  {list.map((c) => <li key={c.id}><span className="app-muted">{c.usuario} · {shortDate(new Date(c.creado))}</span><p>{c.texto}</p></li>)}
                </ul>
              ) : <p className="app-muted">Sin comentarios para esta gráfica y este rango.</p>}
            </section>
          </aside>
        </div>
      </div>
    </dialog>
  );
}
