import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, FileChip, HistoryList, type HistoryItem } from '../components/ui.tsx';
import { getRespaldo, loadCargas, loadRespaldos, loadSummary, respaldoAccion, type Carga, type Respaldo } from '../lib/db.ts';
import { download } from '../lib/download.ts';
import { fromDb, pctText, shortDay } from '../lib/tcqs.ts';
import { shortDate, useApp } from '../store.ts';
import { PageHead } from './Layout.tsx';

type Row = HistoryItem & { carga: Carga };
const when = (iso: string) => shortDate(new Date(iso));
/** «vence en 6 días» / «vence hoy». */
const left = (iso: string) => { const d = Math.ceil((Date.parse(iso) - Date.now()) / 864e5); return d > 1 ? `vence en ${d} días` : d === 1 ? 'vence mañana' : 'vence hoy'; };

/** Historial de lo cargado, leído de Neon y agrupado por sesión (cada inicio de sesión es una). */
export default function Historial() {
  const setFile = useApp((s) => s.setFile), session = useApp((s) => s.session), admin = useApp((s) => s.admin);
  const go = useNavigate();
  const [cargas, setCargas] = useState<Carga[]>();
  const [respaldos, setRespaldos] = useState<Respaldo[]>([]);
  const [msg, setMsg] = useState<string>();
  const reload = () => Promise.all([loadCargas().then(setCargas), loadRespaldos().then(setRespaldos)]).catch((e) => setMsg(`No se pudo leer la base: ${e.message}`));
  useEffect(() => { reload(); }, []);
  const act = (a: Parameters<typeof respaldoAccion>[0], ok: string) => respaldoAccion(a).then(() => { setMsg(ok); reload(); }).catch((e) => setMsg(`No se pudo: ${e.message}`));
  const backup = (c: Carga) => act({ accion: 'crear', carga: c.id }, `Respaldo de ${c.archivo} creado: se guarda 7 días.`);
  const remove = (c: Carga) => confirm(`¿Borrar del historial ${c.archivo} (${shortDay(c.desde)} – ${shortDay(c.hasta)}) y sus datos? Se crea un respaldo automático que dura 7 días.`)
    && act({ accion: 'borrar', carga: c.id }, `${c.archivo} borrado. Su respaldo automático se guarda 7 días: puedes restaurarlo abajo.`);
  const save = (r: Respaldo) => getRespaldo(r.id)
    .then((d) => download(`respaldo-${r.archivo.replace(/\W+/g, '-')}-${r.desde}.json`, new Blob([JSON.stringify(d)], { type: 'application/json' })))
    .catch((e) => setMsg(`No se pudo descargar: ${e.message}`));
  // un respaldo descargado antes: el servidor lo valida igual que una carga nueva
  const upload = async (f: File) => {
    try { await act({ accion: 'cargar', datos: JSON.parse(await f.text()) }, `${f.name}: respaldo cargado en el historial.`); }
    catch { setMsg(`${f.name}: no es un respaldo de Yield Control (.json).`); }
  };

  // lo leído de Neon entra como si fuera un TCQS: todas las pantallas lo leen igual
  const open = async (desde?: string, hasta?: string, label = 'todo el histórico') => {
    setMsg('Cargando…');
    try {
      const rows = await loadSummary(desde, hasta);
      if (!rows.length) return setMsg('No hay datos guardados para ese rango.');
      setFile('TCQS', { ...fromDb(rows), name: `Base · ${label}`, loadedAt: shortDate(new Date()) });
      go('/yield');
    } catch (e) {
      setMsg(`No se pudo leer la base: ${e instanceof Error ? e.message : e}`);
    }
  };

  const sessions = new Map<string, Carga[]>();
  for (const c of cargas ?? []) (sessions.get(c.sesion) ?? sessions.set(c.sesion, []).get(c.sesion)!).push(c);
  return (
    <>
      <PageHead title="Historial" sub="Todo lo cargado y guardado en la base, por sesión. Cada carga se abre en Yield con su rango de fechas.">
        <Button variant="primary" onClick={() => open()} disabled={!cargas?.length}>Ver todo el histórico</Button>
      </PageHead>
      {msg && <p className="app-muted" role="status"><Badge tone="info">Base</Badge> {msg}</p>}
      {cargas && !cargas.length && <p className="yc-card app-empty">Todavía no hay cargas guardadas. Se guardan solas al cargar el TCQS y el Excel de modelos.</p>}
      {[...sessions].map(([id, list]) => (
        <HistoryList<Row>
          key={id}
          title={`${id === session ? 'Esta sesión' : 'Sesión'} · ${when(list.at(-1)!.guardado_en)} · ${list[0].usuario}`}
          action="Abrir"
          items={list.map((c) => ({
            carga: c, type: 'TCQS', name: c.archivo, date: when(c.guardado_en),
            period: `${shortDay(c.desde)} – ${shortDay(c.hasta)} · ${c.entradas.toLocaleString('es-MX')} entradas · FPY ${pctText((c.primer_pase / c.entradas) * 100)} %`,
          }))}
          onCompare={({ carga: c }) => open(c.desde, c.hasta, `${c.archivo} (${shortDay(c.desde)} – ${shortDay(c.hasta)})`)}
          extra={({ carga: c }) => <>
            <Button variant="quiet" onClick={() => backup(c)}>Crear respaldo</Button>
            {admin && <Button variant="quiet" onClick={() => remove(c)}>Borrar</Button>}
          </>}
        />
      ))}
      <section className="yc-card yc-pad app-sec" aria-labelledby="respaldos">
        <h2 id="respaldos" className="app-h3">Respaldos <Badge tone="info">se borran solos a los 7 días</Badge></h2>
        <p className="app-muted">Se crean al borrar un registro (automático) o con «Crear respaldo». Descárgalos para guardarlos más tiempo; «Restaurar» o «Cargar respaldo» los vuelve a poner en el historial.</p>
        <FileChip type="CARGAR RESPALDO" accept=".json,application/json" onFile={upload} meta="Arrastra el .json descargado o haz clic" />
        {respaldos.length > 0 && (
          <ul className="yc-history-list app-backups">
            {respaldos.map((r) => (
              <li key={r.id} className="yc-history-row">
                <span className="yc-history-type">{r.motivo === 'borrado' ? 'AUTOMÁTICO' : 'MANUAL'}</span>
                <span className="yc-history-name" title={r.archivo}>{r.archivo}</span>
                <span className="yc-history-meta">{shortDay(r.desde)} – {shortDay(r.hasta)} · {r.filas} filas · {r.usuario} · {left(r.vence)}</span>
                <span className="yc-history-actions">
                  <Button variant="quiet" onClick={() => save(r)}>Descargar</Button>
                  <Button variant="quiet" onClick={() => act({ accion: 'restaurar', id: r.id }, `${r.archivo}: restaurado en el historial.`)}>Restaurar</Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
