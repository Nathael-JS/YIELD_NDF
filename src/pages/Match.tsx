import { Badge, KpiTile } from '../components/ui.tsx';
import { matchKeys } from '../lib/match.ts';
import { useLoaded } from '../store.ts';
import { NeedFiles, PageHead } from './Layout.tsx';
import { KeyPicker } from './Validacion.tsx';

const SHOWN = 200; // shortcut: la tabla muestra las primeras 200 llaves sin match; paginar si el piso necesita ver todas

export default function Match() {
  const { loaded, count, key } = useLoaded();
  const m = count >= 2 && key ? matchKeys(loaded, key) : null;
  const pct = m && m.total ? ((m.inAll / m.total) * 100).toFixed(1) : '0';
  return (
    <>
      <PageHead title="Match" sub="Qué llaves aparecen en todos los archivos y cuáles faltan en alguno.">{count >= 2 && <KeyPicker />}</PageHead>
      {!m ? <NeedFiles what="hacer match" /> : (
        <>
          <div className="yc-grid-kpi">
            <KpiTile label="Llaves únicas" value={m.total.toLocaleString('es-MX')} />
            <KpiTile label="En todos los archivos" value={m.inAll.toLocaleString('es-MX')} />
            <KpiTile label="Sin match" value={m.partial.length.toLocaleString('es-MX')} />
            <KpiTile label="Match" value={pct} unit="%" />
          </div>
          {m.partial.length > 0 && (
            <div className="yc-table-wrap">
              <table className="yc-table">
                <thead><tr><th>{key}</th>{m.types.map((t) => <th key={t}>{t}</th>)}</tr></thead>
                <tbody>
                  {m.partial.slice(0, SHOWN).map((r) => (
                    <tr key={r.key}>
                      <td className="code">{r.key}</td>
                      {m.types.map((t) => <td key={t}>{r.in.includes(t) ? <Badge tone="ok">✓ Está</Badge> : <Badge tone="warn">Falta</Badge>}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {m.partial.length > SHOWN && <p className="app-muted">Se muestran {SHOWN} de {m.partial.length.toLocaleString('es-MX')} llaves sin match.</p>}
        </>
      )}
    </>
  );
}
