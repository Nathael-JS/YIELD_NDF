import { useEffect } from 'react';
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { saveSummary } from '../lib/db.ts';
import { daily } from '../lib/tcqs.ts';
import { Button, PipelineNav } from '../components/ui.tsx';
import { useApp, useData } from '../store.ts';

const STEPS = ['Carga de datos', 'Validación', 'Yield'];
export const STEP_PATHS = ['/carga', '/validacion', '/yield'];
const EXTRA: Record<string, string> = { Inicio: '/', Gráficos: '/graficos', Historial: '/historial', Cuentas: '/cuentas' };

export default function Layout() {
  const user = useApp((s) => s.user), logout = useApp((s) => s.logout), admin = useApp((s) => s.admin);
  const { pathname } = useLocation();
  const go = useNavigate();
  const { read, records } = useData();
  useAutoSave(records);
  if (!user) return <Navigate to="/login" replace />;
  return (
    <>
      <PipelineNav
        steps={STEPS}
        current={STEP_PATHS.indexOf(pathname)}
        done={[!!read, records.length > 0]} // Carga: TCQS leído · Validación: hay filas válidas de Juliet
        active={Object.keys(EXTRA).find((k) => EXTRA[k] === pathname) ?? null}
        extra={Object.keys(EXTRA).filter((k) => admin || k !== 'Cuentas')}
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

/** Guarda en Neon, una sola vez por carga, el resumen de Juliet en cuanto están el TCQS y el BOM. */
function useAutoSave(records: ReturnType<typeof useData>['records']) {
  const tcqs = useApp((s) => s.files.TCQS), bom = useApp((s) => s.files.MODELOS);
  useEffect(() => {
    const { savedKey, user, setDb } = useApp.getState();
    // sin BOM no hay filtro de Juliet; lo que viene de Neon ya está guardado
    if (!tcqs || !bom || !records.length || tcqs.name.startsWith('Neon ·') || !user) return;
    const key = `${tcqs.name}|${tcqs.loadedAt}|${bom.name}`;
    if (key === savedKey) return;
    setDb(['info', 'Guardando en Neon…'], key);
    saveSummary(tcqs.name, daily(records))
      .then((r) => setDb(['ok', `Guardado en Neon: ${r.guardadas} filas (día × modelo × estación).`]))
      .catch((e) => setDb(['bad', `No se guardó en Neon: ${e.message}. Se reintenta al volver a cargar el archivo.`], ''));
  }, [tcqs, bom, records]);
}
