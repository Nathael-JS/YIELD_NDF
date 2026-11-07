import { useEffect, useState } from 'react';
import { Badge, Button } from '../components/ui.tsx';
import { loadCuentas, setCuenta, type Cuenta } from '../lib/db.ts';
import { shortDate, useApp } from '../store.ts';
import { PageHead } from './Layout.tsx';

/** Administración: activar cuentas pendientes y dar o quitar el rol de administrador. El servidor revisa el permiso. */
export default function Cuentas() {
  const me = useApp((s) => s.user);
  const [list, setList] = useState<Cuenta[]>();
  const [msg, setMsg] = useState<string>();
  const reload = () => loadCuentas().then(setList).catch((e) => setMsg(e.message));
  useEffect(() => { reload(); }, []);

  const change = async (c: Cuenta, cambio: { activo?: boolean; admin?: boolean }, texto: string) => {
    try {
      await setCuenta(c.id, cambio);
      setMsg(`${c.usuario}: ${texto}.`);
      reload();
    } catch (e) {
      setMsg(`${c.usuario}: ${e instanceof Error ? e.message : e}`);
    }
  };
  const pending = list?.filter((c) => !c.activo).length ?? 0;
  return (
    <>
      <PageHead title="Cuentas" sub="Activa las cuentas pendientes y decide quién administra. Desactivar una cuenta cierra su acceso al instante." >
        {pending > 0 && <Badge tone="info">{pending} pendiente{pending === 1 ? '' : 's'}</Badge>}
      </PageHead>
      {msg && <p className="app-muted" role="status"><Badge tone="info">Cuentas</Badge> {msg}</p>}
      {list && (
        <div className="yc-table-wrap">
          <table className="yc-table">
            <thead><tr><th>Usuario</th><th>Nombre</th><th>Creada</th><th>Estado</th><th>Rol</th><th>Acciones</th></tr></thead>
            <tbody>
              {list.map((c) => {
                const self = c.nombre === me;
                return (
                  <tr key={c.id}>
                    <td className="code">{c.usuario}</td>
                    <td>{c.nombre}</td>
                    <td>{shortDate(new Date(c.creado))}</td>
                    <td><Badge tone={c.activo ? 'ok' : 'warn'}>{c.activo ? 'Activa' : 'Pendiente'}</Badge></td>
                    <td><Badge tone={c.principal ? 'ok' : c.admin ? 'info' : 'neutral'}>{c.principal ? 'Principal' : c.admin ? 'Administrador' : 'Usuario'}</Badge></td>
                    <td className="app-actions">
                      {self || c.principal ? <span className="app-muted">{self ? 'Tu cuenta' : 'Se cambia desde Render'}</span> : (
                        <>
                          <Button variant={c.activo ? 'quiet' : 'primary'} onClick={() => change(c, { activo: !c.activo }, c.activo ? 'desactivada' : 'activada')}>
                            {c.activo ? 'Desactivar' : 'Activar'}
                          </Button>
                          <Button variant="quiet" onClick={() => change(c, { admin: !c.admin }, c.admin ? 'ya no es administrador' : 'ahora es administrador')}>
                            {c.admin ? 'Quitar admin' : 'Hacer admin'}
                          </Button>
                        </>
                      )}
                    </td>
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
