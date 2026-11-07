import { Link } from 'react-router-dom';
import { Badge } from '../components/ui.tsx';
import { commonColumns } from '../lib/files.ts';
import { FILE_TYPES, PERIOD_LABEL, useApp } from '../store.ts';
import { PageHead } from './Layout.tsx';

export default function Comparacion() {
  const { files, period } = useApp();
  const loaded = FILE_TYPES.filter((t) => files[t]);
  const common = commonColumns(loaded.map((t) => files[t]!.headers));
  return (
    <>
      <PageHead title="Comparación" sub={`Periodo: ${PERIOD_LABEL[period]} · ${loaded.length} de 3 archivos`} />
      {loaded.length < 2 ? (
        <p className="yc-card app-empty">Carga al menos dos archivos en <Link to="/carga">Carga de datos</Link> para compararlos.</p>
      ) : (
        <>
          <div className="yc-table-wrap">
            <table className="yc-table">
              <thead><tr><th>Archivo</th><th>Nombre</th><th className="num">Filas</th><th className="num">Columnas</th><th>Cargado</th></tr></thead>
              <tbody>
                {loaded.map((t) => {
                  const f = files[t]!;
                  return <tr key={t}><td className="code">{t}</td><td className="code">{f.name}</td><td className="num">{f.rows.length.toLocaleString('es-MX')}</td><td className="num">{f.headers.length}</td><td>{f.loadedAt}</td></tr>;
                })}
              </tbody>
            </table>
          </div>
          <section className="yc-card yc-pad">
            <h2 className="app-h3">Columnas en común <Badge tone={common.length ? 'ok' : 'warn'}>{common.length}</Badge></h2>
            <p className="app-muted">Sirven como llave para el match entre archivos (por ejemplo, número de serie y estación).</p>
            {common.length > 0 && <p className="app-mono">{common.join(' · ')}</p>}
          </section>
        </>
      )}
    </>
  );
}
