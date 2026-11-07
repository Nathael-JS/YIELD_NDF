import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Button, PipelineNav } from '../components/ui.tsx';
import { useApp } from '../store.ts';

const STEPS = ['Carga de datos', 'Validación', 'Yield'];
export const STEP_PATHS = ['/carga', '/validacion', '/yield'];
const EXTRA: Record<string, string> = { Inicio: '/', Gráficos: '/graficos', Historial: '/historial' };

export default function Layout() {
  const { user, logout } = useApp();
  const { pathname } = useLocation();
  const go = useNavigate();
  if (!user) return <Navigate to="/login" replace />;
  return (
    <>
      <PipelineNav
        steps={STEPS}
        current={STEP_PATHS.indexOf(pathname)}
        active={Object.keys(EXTRA).find((k) => EXTRA[k] === pathname) ?? null}
        extra={Object.keys(EXTRA)}
        onSelect={(t) => go(typeof t === 'number' ? (t < 0 ? '/' : STEP_PATHS[t]) : EXTRA[t])}
      >
        <span className="app-user" title={user}>
          <span className="app-avatar" aria-hidden>{user.split(' ').filter((w) => w.length > 2).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}</span>
          <span className="app-user-name">{user}</span>
        </span>
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

export const NeedTcqs = () => (
  <p className="yc-card app-empty">Carga el TCQS en <Link to="/carga">Carga de datos</Link> para ver esta página.</p>
);
