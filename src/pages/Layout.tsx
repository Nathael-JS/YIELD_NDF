import { useEffect } from 'react';
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { saveSummary } from '../lib/db.ts';
import { congruence, daily, modelKey } from '../lib/tcqs.ts';
import { Button, PipelineNav } from '../components/ui.tsx';
import { useApp, useData } from '../store.ts';
import Seguridad from './Seguridad.tsx';

const STEPS = ['Carga de datos', 'Validación', 'Yield'];
export const STEP_PATHS = ['/carga', '/validacion', '/yield'];
const EXTRA: Record<string, string> = { Inicio: '/', Gráficos: '/graficos', Comparativas: '/comparativas', Historial: '/historial', Cuentas: '/cuentas', 'Base de datos': '/base' };
const ADMIN_ONLY = ['Cuentas', 'Base de datos'];

export default function Layout() {
  const user = useApp((s) => s.user), logout = useApp((s) => s.logout), admin = useApp((s) => s.admin);
  // contraseña temporal o administrador sin MFA: no se usa nada más hasta resolverlo
  const blocked = useApp((s) => s.cuenta.debeCambiar || s.cuenta.mfaPendiente);
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
        extra={Object.keys(EXTRA).filter((k) => admin || !ADMIN_ONLY.includes(k))}
        onSelect={(t) => go(typeof t === 'number' ? (t < 0 ? '/' : STEP_PATHS[t]) : EXTRA[t])}
      >
        <button type="button" className="app-user" title="Seguridad de tu cuenta" onClick={() => go('/seguridad')}>
          <span className="app-avatar" aria-hidden>{user.split(/[\s.@]+/).filter((w) => w.length > 2).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}</span>
          <span className="app-user-name">{user}</span>
        </button>
        <Button variant="quiet" onClick={logout}>Salir</Button>
      </PipelineNav>
      <main className="app-main">{blocked ? <Seguridad /> : <Outlet />}</main>
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

/** Guarda en la base, una sola vez por carga, el resumen de Juliet en cuanto están el TCQS y la lista de modelos. */
function useAutoSave(records: ReturnType<typeof useData>['records']) {
  const tcqs = useApp((s) => s.files.TCQS), bom = useApp((s) => s.modelos);
  useEffect(() => {
    const { savedKey, user, setDb } = useApp.getState();
    // sin BOM no hay filtro de Juliet; lo que viene de Neon ya está guardado
    if (!tcqs || !bom || !records.length || tcqs.name.startsWith('Base ·') || !user) return;
    const key = `${tcqs.name}|${tcqs.loadedAt}|${bom.archivo}|${bom.guardado_en}`;
    if (key === savedKey) return;
    setDb(['info', 'Guardando en la base…'], key);
    // la congruencia del archivo con las fórmulas va con la carga y se queda en la base (no se muestra aquí)
    const juliet = new Set(bom.modelos.map(modelKey));
    saveSummary(tcqs.name, daily(records), congruence(tcqs, (m) => juliet.has(modelKey(m))))
      .then((r) => setDb(['ok', `Guardado en la base: ${r.guardadas} filas (día × modelo × estación).`]))
      .catch((e) => setDb(['bad', `No se guardó en la base: ${e.message}. Se reintenta al volver a cargar el archivo.`], ''));
  }, [tcqs, bom, records]);
}
