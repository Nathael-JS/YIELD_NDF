import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Button, PipelineNav } from '../components/ui.tsx';
import { useApp } from '../store.ts';

export const STEP_PATHS = ['/carga', '/comparacion', '/validacion', '/match', '/muestra'];
const EXTRA: Record<string, string> = { Gráficos: '/graficos', Historial: '/historial' };

export default function Layout() {
  const { user, logout } = useApp();
  const { pathname } = useLocation();
  const go = useNavigate();
  if (!user) return <Navigate to="/login" replace />;
  return (
    <>
      <PipelineNav
        current={STEP_PATHS.indexOf(pathname)}
        active={Object.keys(EXTRA).find((k) => EXTRA[k] === pathname) ?? null}
        onSelect={(t) => go(typeof t === 'number' ? (t < 0 ? '/' : STEP_PATHS[t]) : EXTRA[t])}
      >
        <span className="app-user">{user}</span>
        <Button variant="quiet" onClick={logout}>Salir</Button>
      </PipelineNav>
      <main className="app-main"><Outlet /></main>
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

export const NeedFiles = ({ what }: { what: string }) => (
  <p className="yc-card app-empty">Carga al menos dos archivos en <Link to="/carga">Carga de datos</Link> para {what}.</p>
);
