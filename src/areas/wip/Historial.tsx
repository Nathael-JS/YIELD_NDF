// Historial de WIP: cada corte cargado (se guarda solo al cargar el WIP), por día, con el cambio contra el corte anterior.
// «Ver» abre su resumen por estación × modelo (piezas en proceso, bloqueadas, horas promedio y máxima). Sin seriales.
import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button } from '../../components/ui.tsx';
import { loadWipCorte, loadWipCortes, type WipCorte, type WipResumen } from '../../lib/db.ts';
import { local } from '../../lib/wip.ts';
import { PageHead } from '../../pages/Layout.tsx';

const n = (x: number) => x.toLocaleString('es-MX');

export default function HistorialWip() {
  const [cortes, setCortes] = useState<WipCorte[]>(), [err, setErr] = useState<string>();
  const [abierto, setAbierto] = useState<number>(), [det, setDet] = useState<Record<number, WipResumen | string>>({});
  useEffect(() => { loadWipCortes().then(setCortes, (e) => { setErr(e.message); setCortes([]); }); }, []);
  const ver = (id: number) => {
    setAbierto(abierto === id ? undefined : id);
    if (!det[id]) loadWipCorte(id).then((r) => setDet((d) => ({ ...d, [id]: r })), (e) => setDet((d) => ({ ...d, [id]: e.message })));
  };
  // del más nuevo al más viejo: el «anterior» de cada corte es el siguiente de la lista
  const dias = [...new Set((cortes ?? []).map((c) => c.corte.slice(0, 10)))];
  return (
    <>
      <PageHead title="Historial · WIP" sub="Cada WIP cargado queda en la base con su corte: piezas en proceso por estación y modelo, para ver cómo cambia en el tiempo. Se guarda solo al cargarlo en Carga de datos." />
      {err && <p className="app-muted" role="status"><Badge tone="warn">Base</Badge> Sin conexión con la base: {err}</p>}
      {!cortes ? <p className="app-muted">Cargando…</p> : !cortes.length ? <p className="yc-card app-empty">Aún no hay cortes en la base. Carga un WIP en <Link to="/wip/carga">Carga de datos</Link>.</p> : dias.map((d) => (
        <section key={d} className="yc-card app-hist-day" aria-label={`Cortes del ${d}`}>
          <header><h2 className="app-h3">{d}</h2><span className="app-muted">{((k) => `${k} ${k === 1 ? 'corte' : 'cortes'}`)(cortes.filter((c) => c.corte.startsWith(d)).length)}</span></header>
          <div className="yc-table-wrap">
            <table className="yc-table">
              <thead><tr><th>Corte</th><th className="num">En proceso</th><th className="num">Cambio</th><th className="num">Terminadas</th><th>Archivo</th><th>Subió</th><th /></tr></thead>
              <tbody>{cortes.filter((c) => c.corte.startsWith(d)).map((c) => {
                const prev = cortes[cortes.indexOf(c) + 1], delta = prev ? c.piezas - prev.piezas : 0, r = det[c.id];
                return (
                  <Fragment key={c.id}>
                    <tr>
                      <td className="code">{c.corte.slice(11, 16)}</td><td className="num">{n(c.piezas)}</td>
                      <td className="num">{!prev ? '—' : <Badge tone={delta > 0 ? 'warn' : delta < 0 ? 'ok' : 'neutral'}>{delta > 0 ? '+' : ''}{n(delta)}</Badge>}</td>
                      <td className="num">{n(c.terminadas)}</td><td className="app-muted">{c.archivo}</td>
                      <td>{c.usuario} <span className="app-muted">{local(new Date(c.subida)).slice(0, 16)}</span></td>
                      <td><Button variant="quiet" aria-expanded={abierto === c.id} onClick={() => ver(c.id)}>{abierto === c.id ? 'Ocultar' : 'Ver'}</Button></td>
                    </tr>
                    {abierto === c.id && (
                      <tr className="app-wh-det"><td colSpan={7}>
                        {!r ? <p className="app-muted">Cargando…</p> : typeof r === 'string' ? <p className="app-muted">No se pudo leer: {r}</p> : (
                          <table className="yc-table">
                            <thead><tr><th>Estación</th><th>Modelo</th><th className="num">Piezas</th><th className="num">Bloqueadas</th><th className="num">Horas prom.</th><th className="num">Máx.</th></tr></thead>
                            <tbody>{r.map((x) => (
                              <tr key={`${x.estacion}-${x.modelo}`}><td className="code">{x.estacion}</td><td className="code">{x.modelo || '—'}</td><td className="num">{n(x.piezas)}</td>
                                <td className="num">{x.bloqueadas ? <Badge tone="bad">{x.bloqueadas}</Badge> : 0}</td><td className="num">{x.horas.toFixed(1)}</td><td className="num">{x.max.toFixed(1)}</td></tr>
                            ))}</tbody>
                          </table>
                        )}
                      </td></tr>
                    )}
                  </Fragment>
                );
              })}</tbody>
            </table>
          </div>
        </section>
      ))}
    </>
  );
}
