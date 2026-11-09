import { useState, type FormEvent } from 'react';
import { Badge, Button } from '../components/ui.tsx';
import { apiMe, changePassword, mfaConfirm, mfaStart } from '../lib/db.ts';
import { useApp } from '../store.ts';
import { PageHead } from './Layout.tsx';

/** Contraseña y MFA de la propia cuenta. Si la contraseña es temporal o un administrador no tiene MFA, la app solo muestra esto. */
export default function Seguridad() {
  const cuenta = useApp((s) => s.cuenta), admin = useApp((s) => s.admin), login = useApp((s) => s.login);
  const [msg, setMsg] = useState<[ 'ok' | 'bad', string ]>();
  const [qr, setQr] = useState<{ img: string; secreto: string }>();
  const refresh = () => apiMe().then(login);
  const run = (f: () => Promise<unknown>, ok: string) => f().then(() => { setMsg(['ok', ok]); return refresh(); }).catch((e) => setMsg(['bad', e.message]));

  const savePassword = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget), nueva = String(f.get('nueva'));
    if (nueva !== f.get('repetir')) return setMsg(['bad', 'Las dos contraseñas nuevas no coinciden']);
    const form = e.currentTarget;
    run(() => changePassword(String(f.get('actual')), nueva).then(() => form.reset()), 'Contraseña actualizada.');
  };
  const startMfa = async () => {
    try {
      const { secreto, uri } = await mfaStart();
      const QR = await import('qrcode'); // solo aquí: no pesa en el resto de la app
      setQr({ img: await QR.toDataURL(uri, { margin: 1, width: 200 }), secreto });
    } catch (e) {
      setMsg(['bad', (e as Error).message]);
    }
  };
  const confirmMfa = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    run(() => mfaConfirm(String(new FormData(e.currentTarget).get('codigo'))).then(() => setQr(undefined)), 'MFA activado: desde ahora el inicio de sesión pide el código.');
  };

  const pending = cuenta.debeCambiar || cuenta.mfaPendiente;
  return (
    <>
      <PageHead title="Seguridad de tu cuenta" sub={pending ? 'Antes de continuar: completa los pasos marcados.' : 'Contraseña y verificación en dos pasos (MFA).'} />
      {msg && <p className="app-muted" role={msg[0] === 'bad' ? 'alert' : 'status'}><Badge tone={msg[0]}>{msg[0] === 'ok' ? 'Listo' : 'Error'}</Badge> {msg[1]}</p>}
      <section className="yc-card yc-pad app-sec">
        <h2 className="app-h3">1. Contraseña {cuenta.debeCambiar ? <Badge tone="warn">Debes cambiarla</Badge> : <Badge tone="ok">Al día</Badge>}</h2>
        <p className="app-muted">Mínimo 12 caracteres. {cuenta.debeCambiar && 'La actual es temporal (la puso un administrador o viene de Render).'}</p>
        <form className="app-form" onSubmit={savePassword}>
          <label className="yc-field">Contraseña actual<input className="yc-input" name="actual" type="password" required autoComplete="current-password" /></label>
          <label className="yc-field">Nueva contraseña<input className="yc-input" name="nueva" type="password" required minLength={12} autoComplete="new-password" /></label>
          <label className="yc-field">Repite la nueva<input className="yc-input" name="repetir" type="password" required minLength={12} autoComplete="new-password" /></label>
          <Button variant="primary" type="submit">Cambiar contraseña</Button>
        </form>
      </section>
      <section className="yc-card yc-pad app-sec">
        <h2 className="app-h3">2. Verificación en dos pasos (MFA) {cuenta.mfa ? <Badge tone="ok">Activa</Badge> : <Badge tone={admin ? 'warn' : 'neutral'}>{admin ? 'Obligatoria para administradores' : 'Opcional'}</Badge>}</h2>
        <p className="app-muted">Usa una app autenticadora (Google Authenticator, Microsoft Authenticator…). Al iniciar sesión, además de la contraseña te pedirá el código de 6 dígitos.</p>
        {cuenta.debeCambiar ? <p className="app-muted">Primero cambia la contraseña.</p> : !qr ? (
          <Button onClick={startMfa}>{cuenta.mfa ? 'Configurar en otro teléfono' : 'Configurar MFA'}</Button>
        ) : (
          <div className="app-mfa">
            <img src={qr.img} width={200} height={200} alt="Código QR para la app autenticadora" />
            <div>
              <p className="app-muted">Escanea el código con la app. Si no puedes, escribe esta clave:</p>
              <p className="app-mono app-secret">{qr.secreto.match(/.{1,4}/g)!.join(' ')}</p>
              <form className="app-form" onSubmit={confirmMfa}>
                <label className="yc-field">Código de 6 dígitos que muestra la app
                  <input className="yc-input yc-code" name="codigo" required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" />
                </label>
                <Button variant="primary" type="submit">Activar MFA</Button>
              </form>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
