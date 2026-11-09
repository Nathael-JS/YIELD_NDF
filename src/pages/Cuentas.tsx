import { useEffect, useState, type FormEvent } from 'react';
import { Badge, Button } from '../components/ui.tsx';
import { cuentaAccion, loadCuentas, type AccionCuenta, type Cuenta } from '../lib/db.ts';
import { shortDate, useApp } from '../store.ts';
import { PageHead } from './Layout.tsx';

/** Contraseña temporal al azar (14 caracteres sin los que se confunden: 0/O, 1/l/I). */
const temporal = () => [...crypto.getRandomValues(new Uint8Array(14))].map((b) => 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 56]).join('');

/** Administración de usuarios: crear, activar, editar, restablecer contraseña o MFA y (super administrador) roles y borrado. */
export default function Cuentas() {
  const principal = useApp((s) => s.cuenta.principal), me = useApp((s) => s.user);
  const [list, setList] = useState<Cuenta[]>();
  const [msg, setMsg] = useState<['ok' | 'bad', string]>();
  const reload = () => loadCuentas().then(setList).catch((e) => setMsg(['bad', e.message]));
  useEffect(() => { reload(); }, []);
  const act = (a: AccionCuenta, ok: string) => cuentaAccion(a).then(() => { setMsg(['ok', ok]); reload(); }).catch((e) => setMsg(['bad', e.message]));

  const create = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget), clave = temporal(), usuario = String(f.get('usuario')).trim(), form = e.currentTarget;
    act({ accion: 'crear', usuario, nombre: String(f.get('nombre')), clave, admin: f.get('admin') === 'on' },
      `Cuenta ${usuario} creada. Contraseña temporal (cópiala, no se vuelve a mostrar): ${clave}`).then(() => form.reset());
  };
  const reset = (c: Cuenta) => { const clave = temporal(); act({ accion: 'clave', id: c.id, clave }, `${c.usuario}: nueva contraseña temporal (cópiala, no se vuelve a mostrar): ${clave}`); };
  const rename = (c: Cuenta) => { const nombre = prompt(`Nombre para ${c.usuario}`, c.nombre); if (nombre?.trim()) act({ accion: 'editar', id: c.id, nombre }, `${c.usuario}: nombre actualizado.`); };
  const remove = (c: Cuenta) => { if (confirm(`¿Borrar la cuenta ${c.usuario}? No se puede deshacer.`)) act({ accion: 'borrar', id: c.id }, `${c.usuario}: cuenta borrada.`); };

  return (
    <>
      <PageHead title="Cuentas" sub={principal ? 'Super administrador: gestionas usuarios y administradores.' : 'Gestionas los usuarios. Los administradores los gestiona el super administrador.'} />
      {msg && <p className="app-muted app-msg" role={msg[0] === 'bad' ? 'alert' : 'status'}><Badge tone={msg[0]}>{msg[0] === 'ok' ? 'Listo' : 'Error'}</Badge> {msg[1]}</p>}
      <form className="yc-card yc-pad app-form app-form-row" onSubmit={create}>
        <h2 className="app-h3">Nueva cuenta</h2>
        <label className="yc-field">Usuario o correo<input className="yc-input" name="usuario" required minLength={3} maxLength={80} autoComplete="off" /></label>
        <label className="yc-field">Nombre<input className="yc-input" name="nombre" maxLength={80} autoComplete="off" /></label>
        {principal && <label className="app-check"><input type="checkbox" name="admin" /> Administrador</label>}
        <Button variant="primary" type="submit">Crear con contraseña temporal</Button>
      </form>
      {list && (
        <div className="yc-table-wrap">
          <table className="yc-table">
            <thead><tr><th>Usuario</th><th>Nombre</th><th>Creada</th><th>Estado</th><th>Rol</th><th>Seguridad</th><th>Acciones</th></tr></thead>
            <tbody>
              {list.map((c) => {
                const self = c.nombre === me, locked = self || c.principal || (c.admin && !principal);
                return (
                  <tr key={c.id}>
                    <td className="code">{c.usuario}</td>
                    <td>{c.nombre}</td>
                    <td>{shortDate(new Date(c.creado))}</td>
                    <td><Badge tone={c.activo ? 'ok' : 'warn'}>{c.activo ? 'Activa' : 'Desactivada'}</Badge></td>
                    <td><Badge tone={c.principal ? 'ok' : c.admin ? 'info' : 'neutral'}>{c.principal ? 'Super administrador' : c.admin ? 'Administrador' : 'Usuario'}</Badge></td>
                    <td><div className="app-actions">
                      <Badge tone={c.mfa ? 'ok' : 'neutral'}>{c.mfa ? 'MFA' : 'Sin MFA'}</Badge>
                      {c.debe_cambiar && <Badge tone="warn">Clave temporal</Badge>}
                    </div></td>
                    <td><div className="app-actions">
                      {locked ? <span className="app-muted">{self ? 'Tu cuenta: en Seguridad' : c.principal ? 'Se cambia desde Render' : 'Solo el super administrador'}</span> : (
                        <>
                          <Button variant="quiet" onClick={() => act({ accion: 'editar', id: c.id, activo: !c.activo }, `${c.usuario}: ${c.activo ? 'desactivada' : 'activada'}.`)}>{c.activo ? 'Desactivar' : 'Activar'}</Button>
                          <Button variant="quiet" onClick={() => rename(c)}>Editar nombre</Button>
                          <Button variant="quiet" onClick={() => reset(c)}>Restablecer contraseña</Button>
                          {c.mfa && <Button variant="quiet" onClick={() => act({ accion: 'mfa', id: c.id }, `${c.usuario}: MFA quitado; lo configura de nuevo al entrar.`)}>Quitar MFA</Button>}
                          {principal && <Button variant="quiet" onClick={() => act({ accion: 'editar', id: c.id, admin: !c.admin }, `${c.usuario}: ${c.admin ? 'ya no es administrador' : 'ahora es administrador'}.`)}>{c.admin ? 'Quitar admin' : 'Hacer admin'}</Button>}
                          {principal && <Button variant="quiet" onClick={() => remove(c)}>Borrar</Button>}
                        </>
                      )}
                    </div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
