// Histórico de Pallets: cada listado de entregas cargado, con su fecha y hora de subida; se puede volver a usar.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button } from '../../components/ui.tsx';
import { loadPalletCarga, loadPalletCargas, type PalletCarga } from '../../lib/db.ts';
import { entregasFile } from '../../lib/pallets.ts';
import { local } from '../../lib/wip.ts';
import { shortDate, useApp } from '../../store.ts';
import { PageHead } from '../../pages/Layout.tsx';

export default function HistorialPallets() {
  const setFile = useApp((s) => s.setFile);
  const [cargas, setCargas] = useState<PalletCarga[]>(), [msg, setMsg] = useState<[ 'ok' | 'bad', string ]>();
  useEffect(() => { loadPalletCargas().then(setCargas, (e) => { setMsg(['bad', `Sin conexión con la base: ${e.message}`]); setCargas([]); }); }, []);
  const usar = async (c: PalletCarga) => {
    try {
      setFile('DN', { ...entregasFile(await loadPalletCarga(c.id)), name: `${c.archivo} (histórico ${local(new Date(c.subida)).slice(0, 16)})`, loadedAt: shortDate(new Date()), cargado: local() });
      setMsg(['ok', `Listado ${c.archivo} cargado: sus entregas ya están en Etiquetas.`]);
    } catch (e) { setMsg(['bad', `No se pudo cargar: ${(e as Error).message}`]); }
  };
  return (
    <>
      <PageHead title="Historial · Pallets" sub="Cada listado de entregas cargado queda en la base con su fecha y hora de subida. «Usar» lo vuelve a cargar sin el archivo." />
      {msg && <p className="app-muted" role="status"><Badge tone={msg[0]}>{msg[0] === 'ok' ? 'Listo' : 'Aviso'}</Badge> {msg[1]}{msg[0] === 'ok' && <> <Link to="/pallets">Ir a etiquetas</Link></>}</p>}
      {!cargas ? <p className="app-muted">Cargando…</p> : !cargas.length ? <p className="yc-card app-empty">Aún no hay listados en la base. Carga uno en <Link to="/pallets/carga">Carga de datos</Link>.</p> : (
        <div className="yc-table-wrap">
          <table className="yc-table">
            <thead><tr><th>Fecha y hora</th><th>Archivo</th><th className="num">Entregas</th><th>Subió</th><th /></tr></thead>
            <tbody>{cargas.map((c) => (
              <tr key={c.id}><td className="code">{local(new Date(c.subida)).slice(0, 16)}</td><td>{c.archivo}</td><td className="num">{c.filas}</td><td>{c.usuario}</td>
                <td><Button variant="quiet" onClick={() => usar(c)}>Usar este listado</Button></td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </>
  );
}
