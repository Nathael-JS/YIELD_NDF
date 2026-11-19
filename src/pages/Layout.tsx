import { Suspense, useEffect } from 'react';
import { Link, Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { saveSummary } from '../lib/db.ts';
import { congruence, daily, modelKey } from '../lib/tcqs.ts';
import { Button } from '../components/ui.tsx';
import { useApp, useData } from '../store.ts';
import Seguridad from './Seguridad.tsx';

type Item = { label: string; to: string; icon: string };
// íconos de trazo (24×24): uno por página, para los rieles cerrados
const I = {
  carga: 'M12 16V4m0 0-4 4m4-4 4 4M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3', valid: 'M9 12l2 2 4-4M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z',
  yield: 'M4 19h16M7 16V9m5 7V5m5 11v-5', wip: 'M3 12h4l2-6 4 12 2-6h6', inicio: 'M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z', graf: 'M4 20V10m6 10V4m6 16v-8m4 8H2',
  comp: 'M7 7h13m0 0-3-3m3 3-3 3M17 17H4m0 0 3-3m-3 3 3 3', ndf: 'M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5', hist: 'M12 7v5l3 3M12 21a9 9 0 1 0-9-9',
  cuentas: 'M16 19v-1a4 4 0 0 0-8 0v1M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM20 19v-1a3 3 0 0 0-2-2.8M17 5.2a3 3 0 0 1 0 5.6', base: 'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zm0 0v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
};
const FLOW: Item[] = [{ label: 'Carga de datos', to: '/carga', icon: I.carga }, { label: 'Validación', to: '/validacion', icon: I.valid }, { label: 'Yield', to: '/yield', icon: I.yield }, { label: 'WIP', to: '/wip', icon: I.wip }];
const VIEWS: Item[] = [{ label: 'Inicio', to: '/', icon: I.inicio }, { label: 'Gráficos', to: '/graficos', icon: I.graf }, { label: 'Comparativas', to: '/comparativas', icon: I.comp },
  { label: 'NDF', to: '/ndf', icon: I.ndf }, { label: 'Historial', to: '/historial', icon: I.hist }];
const ADMIN: Item[] = [{ label: 'Cuentas', to: '/cuentas', icon: I.cuentas }, { label: 'Base de datos', to: '/base', icon: I.base }];
const Icon = ({ d }: { d: string }) => <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden><path d={d} /></svg>;

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
  const { read, records } = useData();
  useAutoSave(records);
  if (!user) return <Navigate to="/login" replace />;
  return (
    <>
      <header className="app-top">
        <Link to="/" className="yc-nav-mark">Yield Control</Link>
        {admin && <nav className="app-top-links" aria-label="Administración">
          {ADMIN.map((it) => <NavLink key={it.to} to={it.to} className="app-top-link"><Icon d={it.icon} />{it.label}</NavLink>)}
        </nav>}
        <button type="button" className="app-user" title="Seguridad de tu cuenta" onClick={() => go('/seguridad')}>
          <span className="app-avatar" aria-hidden>{user.split(/[\s.@]+/).filter((w) => w.length > 2).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}</span>
          <span className="app-user-name">{user}</span>
        </button>
        <Button variant="quiet" onClick={logout}>Salir</Button>
      </header>
      {/* izquierda: el flujo de trabajo (✓ = paso hecho); derecha: las páginas de consulta */}
      <Rail side="left" label="Flujo de trabajo" items={FLOW} done={[!!read, records.length > 0, false, false]} />
      <Rail side="right" label="Consulta" items={VIEWS} />
      <div className="app-body"><main className="app-main">{blocked ? <Seguridad /> : <Suspense fallback={<p className="app-muted">Cargando…</p>}><Outlet /></Suspense>}</main></div>
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
  <p className="yc-card app-empty">Carga el TCQS en <Link to="/carga">Carga de datos</Link> para ver esta página.</p>
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
