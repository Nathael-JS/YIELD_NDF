import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { areaOf, I, type Item } from '../areas.ts';
import { saveSummary } from '../lib/db.ts';
import { congruence, daily, modelKey } from '../lib/tcqs.ts';
import { Button } from '../components/ui.tsx';
import { useApp, useData } from '../store.ts';
import Seguridad from './Seguridad.tsx';
import { mayor } from '../lib/novedades.ts';

const Novedades = lazy(() => import('./Novedades.tsx'));
const VISTO = 'yc-novedades'; // última versión que este navegador ya vio
const leerVisto = () => { try { return localStorage.getItem(VISTO) ?? ''; } catch { return ''; } };

/** Campana de Novedades: punto si hay una versión que no se ha visto; al abrirla se marca como vista. */
function NovedadesBtn() {
  const [visto, setVisto] = useState(leerVisto), [abierto, setAbierto] = useState<string>();
  const nuevo = !visto || mayor(__VERSION__, visto); // volver a una versión anterior no es «nuevo»
  const abrir = () => { setAbierto(visto); setVisto(__VERSION__); try { localStorage.setItem(VISTO, __VERSION__); } catch { /* sin almacenamiento: se vuelve a avisar */ } };
  return (
    <>
      <button type="button" className="app-nov-btn" onClick={abrir} aria-label={nuevo ? `Novedades: hay una versión nueva (${__VERSION__})` : 'Novedades'} title="Novedades">
        <Icon d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21h4" />{nuevo && <i aria-hidden />}
      </button>
      {abierto !== undefined && <Suspense fallback={null}><Novedades visto={abierto} onClose={() => setAbierto(undefined)} /></Suspense>}
    </>
  );
}

const ADMIN: Item[] = [{ label: 'Cuentas', to: '/cuentas', icon: I.cuentas }, { label: 'Base de datos', to: '/base', icon: I.base }];
export const Icon = ({ d }: { d: string }) => <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden><path d={d} /></svg>;

/** Riel lateral: íconos siempre a la vista; al pasar el mouse o con el foco se desliza y muestra los nombres encima del contenido. */
function Rail({ side, label, items, done }: { side: 'left' | 'right'; label: string; items: Item[]; done?: boolean[] }) {
  return (
    <nav className={`app-rail is-${side}`} aria-label={label}>
      {items.map((it, i) => (
        <NavLink key={it.to} to={it.to} end className="app-rail-link">
          <span className="app-rail-ico"><Icon d={it.icon} />{done?.[i] && <i className="app-rail-done" aria-hidden>✓</i>}</span>
          <span className="app-rail-txt">{done ? `${i + 1}. ` : ''}{it.label}{done?.[i] && <span className="yc-sr-only"> (hecho)</span>}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export default function Layout() {
  const user = useApp((s) => s.user), logout = useApp((s) => s.logout), admin = useApp((s) => s.admin);
  // contraseña temporal o administrador sin MFA: no se usa nada más hasta resolverlo
  const blocked = useApp((s) => s.cuenta.debeCambiar || s.cuenta.mfaPendiente);
  const go = useNavigate();
  const { records } = useData(), files = useApp((s) => s.files);
  const area = areaOf(useLocation().pathname); // fuera de un área (inicio, cuentas…) no hay rieles
  const cargado = !!area?.files.some((f) => files[f]);
  useAutoSave(records);
  if (!user) return <Navigate to="/login" replace />;
  return (
    <>
      <header className="app-top">
        <Link to="/" className="yc-nav-mark">Yield Control</Link>
        <Link to="/" className={`app-area-btn${area ? '' : ' is-home'}`} title="Cambiar de área"><Icon d={I.areas} /><span>{area ? area.name : 'Áreas'}</span></Link>
        {admin && <nav className="app-top-links" aria-label="Administración">
          {ADMIN.map((it) => <NavLink key={it.to} to={it.to} className="app-top-link"><Icon d={it.icon} />{it.label}</NavLink>)}
        </nav>}
        <NovedadesBtn />
        <button type="button" className="app-user" title="Seguridad de tu cuenta" onClick={() => go('/seguridad')}>
          <span className="app-avatar" aria-hidden>{user.split(/[\s.@]+/).filter((w) => w.length > 2).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}</span>
          <span className="app-user-name">{user}</span>
        </button>
        <Button variant="quiet" onClick={logout}>Salir</Button>
      </header>
      {/* izquierda: el flujo del área (✓ = paso hecho); derecha: sus consultas */}
      {area && <Rail key={area.id} side="left" label={`Flujo de ${area.name}`} items={area.flow} done={[cargado, area.id === 'yield' ? records.length > 0 : cargado, false]} />}
      {area && <Rail key={`${area.id}r`} side="right" label={`Consulta de ${area.name}`} items={area.views} />}
      <div className={`app-body${area ? '' : ' is-home'}`}><main className="app-main">{blocked ? <Seguridad /> : <Suspense fallback={<p className="app-muted">Cargando…</p>}><Outlet /></Suspense>}</main></div>
    </>
  );
}

/** Encabezado de página: título, subtítulo y controles a la derecha. */
export function PageHead({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <header className="app-head">
      <div><h1>{title}</h1>{sub && <p>{sub}</p>}</div>
      {children && <div className="yc-row">{children}</div>}
    </header>
  );
}

export const NeedTcqs = () => (
  <p className="yc-card app-empty">Carga el TCQS en <Link to="/yield/carga">Carga de datos</Link> para ver esta página.</p>
);

/** Guarda en la base (historial), una sola vez por carga, el resumen en cuanto se lee el TCQS: de Juliet si hay lista de modelos, si no de todos. */
function useAutoSave(records: ReturnType<typeof useData>['records']) {
  const tcqs = useApp((s) => s.files.TCQS), bom = useApp((s) => s.modelos), ready = useApp((s) => s.modelosListos);
  useEffect(() => {
    const { savedKey, user, setDb } = useApp.getState();
    // sin lista de modelos se guardan todos los del TCQS (records ya viene sin filtrar); lo que viene de la base ya está guardado
    // se espera la lista de modelos: si no, al recargar se guardaría primero con todos los modelos y luego otra vez
    if (!ready || !tcqs || !records.length || tcqs.name.startsWith('Base ·') || !user) return;
    const key = `${tcqs.name}|${tcqs.loadedAt}|${bom?.archivo}|${bom?.guardado_en}`;
    if (key === savedKey) return;
    setDb(['info', 'Guardando en la base…'], key);
    // la congruencia del archivo con las fórmulas va con la carga y se queda en la base (no se muestra aquí)
    const juliet = bom && new Set(bom.modelos.map(modelKey));
    saveSummary(tcqs.name, daily(records), congruence(tcqs, (m) => !juliet || juliet.has(modelKey(m))))
      .then((r) => setDb(['ok', `Guardado en el historial: ${r.guardadas} filas (día × modelo × estación).`]))
      .catch((e) => setDb(['bad', `No se guardó en la base: ${e.message}. Se reintenta al volver a cargar el archivo.`], ''));
  }, [ready, tcqs, bom, records]);
}
