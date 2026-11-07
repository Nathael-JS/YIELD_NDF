import { Badge, Select, type Tone } from '../components/ui.tsx';
import { validate, type Check } from '../lib/match.ts';
import { useApp, useLoaded } from '../store.ts';
import { NeedFiles, PageHead } from './Layout.tsx';

/** Elegir la columna llave entre las que tienen todos los archivos. */
export function KeyPicker() {
  const { setKey } = useApp();
  const { common, key } = useLoaded();
  return <Select label="Columna llave" value={key} options={common} onChange={setKey} disabled={!common.length} />;
}

const verdict = (c: Check): [string, Tone] =>
  !c.hasKey ? ['Sin la columna', 'bad'] : c.empty || c.duplicated ? ['Revisar', 'warn'] : ['Válido', 'ok'];

export default function Validacion() {
  const { loaded, count, common, key } = useLoaded();
  return (
    <>
      <PageHead title="Validación" sub="Cada archivo debe traer la columna llave, sin vacíos ni repetidos.">{count >= 2 && <KeyPicker />}</PageHead>
      {count < 2 ? <NeedFiles what="validarlos" /> : !common.length ? (
        <p className="yc-card app-empty">Los archivos no tienen columnas con el mismo nombre. Revisa los encabezados antes de hacer match.</p>
      ) : (
        <div className="yc-table-wrap">
          <table className="yc-table">
            <thead><tr><th>Archivo</th><th className="num">Filas</th><th className="num">Llave vacía</th><th className="num">Llave repetida</th><th>Estado</th></tr></thead>
            <tbody>
              {Object.entries(loaded).map(([t, f]) => {
                const c = validate(f, key), [text, tone] = verdict(c);
                return (
                  <tr key={t}>
                    <td className="code">{t}</td>
                    <td className="num">{c.rows.toLocaleString('es-MX')}</td>
                    <td className="num">{c.empty.toLocaleString('es-MX')}</td>
                    <td className="num">{c.duplicated.toLocaleString('es-MX')}</td>
                    <td><Badge tone={tone}>{text}</Badge></td>
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
