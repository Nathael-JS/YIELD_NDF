import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Badge, LoginPanel } from '../components/ui.tsx';
import { TEST_USER, useApp } from '../store.ts';

export default function Login() {
  const { user, login, requestAccount } = useApp();
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState<string>();
  if (user) return <Navigate to="/" replace />;
  return (
    <div className="app-login">
      <LoginPanel
        error={error}
        onSubmit={(mode, data) => {
          const u = String(data.get('user') ?? '');
          if (mode === 'signup') { requestAccount(u); setError(undefined); setSent(u); return; }
          // nunca decir cuál de los dos falló
          if (!login(u, String(data.get('password') ?? ''))) setError('Usuario o contraseña incorrectos');
        }}
      >
        <p className="yc-login-hint">
        {sent
          ? <><Badge tone="info">Pendiente</Badge> Solicitud de <span className="app-mono">{sent}</span> enviada al encargado.</>
          : <><Badge tone="neutral">Prueba</Badge> Usuario <span className="app-mono">{TEST_USER.user}</span> · contraseña <span className="app-mono">{TEST_USER.password}</span></>}
        </p>
      </LoginPanel>
    </div>
  );
}
