import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Badge, FileChip, KpiTile, LoginPanel } from '../components/ui.tsx';
import { META_FPY } from '../lib/tcqs.ts';
import { apiLogin, apiSignup } from '../lib/db.ts';
import { useApp } from '../store.ts';

// Ilustración del login: barras que crecen y siguen moviéndose como si llegaran datos, la línea de FPY que las
// acompaña y los archivos que «se cargan». Decorativa: no muestra datos reales (solo la meta, que sí lo es).
// Con movimiento reducido queda quieta.
const BARS = [64, 72, 58, 80, 70, 86, 76, 90, 84, 94, 88, 97];
const still = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// valor de cada barra en el «tic» t: la base de BARS con una oscilación suave, entre 40 y 99
const at = (t: number, i: number) => (t ? Math.max(40, Math.min(99, BARS[i] + 8 * Math.sin(t * 1.7 + i * 0.9))) : 0);

function LoginArt() {
  const [step, setStep] = useState(still() ? 2 : 0);
  const [tick, setTick] = useState(still() ? 1 : 0); // 0 = barras en cero, para que crezcan al entrar
  useEffect(() => {
    if (still()) return;
    const t = [setTimeout(() => setTick(1), 50), ...[1200, 2000].map((ms, i) => setTimeout(() => setStep(i + 1), ms))];
    const loop = setInterval(() => setTick((k) => k + 1), 3500);
    return () => { t.forEach(clearTimeout); clearInterval(loop); };
  }, []);
  const x = (i: number) => i * 100 + 50, y = (v: number) => 400 - v * 3.6;
  const line = `M${BARS.map((_, i) => `${x(i)},${y(at(tick, i)) - 24}`).join(' L')}`;
  return (
    <div className="app-art">
      <svg className="app-art-chart" viewBox="0 0 1200 400" preserveAspectRatio="none">
        {BARS.map((_, i) => (
          <rect key={i} className={`app-art-bar yc-fill-${i % 4 === 3 ? 'second' : 'pass'}`} x={x(i) - 30} width={60} y={y(100)} height={400 - y(100)}
            style={{ transform: `scaleY(${at(tick, i) / 100})`, transitionDelay: `${i * 60}ms` }} />
        ))}
        <line className="app-art-meta" x1={0} x2={1200} y1={y(META_FPY)} y2={y(META_FPY)} />
        {tick > 0 && <path className="app-art-line" pathLength={1} d={line} style={{ d: `path('${line}')` } as React.CSSProperties} />}
      </svg>
      <div className="app-art-cards">
        <FileChip type="TCQS" status={step >= 1 ? 'loaded' : 'empty'} meta={step >= 1 ? 'Corridas por orden y estación' : 'Leyendo…'} />
        <FileChip type="MODELOS · JULIET" status={step >= 2 ? 'loaded' : 'empty'} meta={step >= 2 ? 'Modelos del proyecto' : 'Leyendo…'} />
        <KpiTile label="Meta FPY" value={META_FPY} unit="%" />
      </div>
    </div>
  );
}

export default function Login() {
  const user = useApp((s) => s.user), login = useApp((s) => s.login);
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState<string>();
  if (user) return <Navigate to="/" replace />;
  return (
    <div className="app-login">
      <LoginPanel
        backdrop={<LoginArt />}
        error={error}
        onSubmit={async (mode, data) => {
          const u = String(data.get('user') ?? ''), p = String(data.get('password') ?? '');
          setError(undefined);
          try {
            if (mode === 'signup') { await apiSignup(u, p); setSent(u.trim()); return; }
            const s = await apiLogin(u, p);
            login(s.nombre, s.sesion);
          } catch (e) {
            setError(e instanceof Error ? e.message : 'No se pudo conectar con el servidor');
          }
        }}
      >
        {sent && <p className="yc-login-hint"><Badge tone="info">Pendiente</Badge> Solicitud de <span className="app-mono">{sent}</span> enviada: el encargado debe activarla.</p>}
      </LoginPanel>
    </div>
  );
}
