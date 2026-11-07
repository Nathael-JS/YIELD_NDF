import { useNavigate } from 'react-router-dom';
import { Badge, Button, KpiTile } from '../components/ui.tsx';
import { by } from '../lib/tcqs.ts';
import { useData } from '../store.ts';
import { NeedTcqs, PageHead } from './Layout.tsx';

const n = (v: number) => v.toLocaleString('es-MX');

export default function Validacion() {
  const { read, models, all, records } = useData();
  const go = useNavigate();
  if (!read) return <><PageHead title="Validación" /><NeedTcqs /></>;
  if (read.missing.length) return (
    <>
      <PageHead title="Validación" />
      <p className="yc-card app-empty"><Badge tone="bad">Faltan columnas</Badge> El TCQS no trae <span className="app-mono">{read.missing.join(', ')}</span>. Revisa que sea el reporte de yield por estación.</p>
    </>
  );
  const byModel = by(all, (r) => r.model).sort((a, b) => b.input - a.input);
  return (
    <>
      <PageHead title="Validación" sub="Qué filas del TCQS se pueden usar y qué modelos son del proyecto Juliet.">
        <Button variant="primary" disabled={!records.length} onClick={() => go('/yield')}>Ver yield</Button>
      </PageHead>
      <div className="yc-grid-kpi">
        <KpiTile label="Filas del TCQS" value={n(all.length + read.bad.length)} />
        <KpiTile label="Filas inválidas" value={n(read.bad.length)} />
        <KpiTile label="Modelos en el BOM" value={models ? n(models.size) : '—'} />
        <KpiTile label="Filas de Juliet" value={n(records.length)} />
      </div>
      {read.bad.length > 0 && (
        <p className="app-muted"><Badge tone="warn">Revisar</Badge> Filas con fecha, modelo, estación o cantidades inválidas (no se usan): <span className="app-mono">{read.bad.slice(0, 20).join(', ')}{read.bad.length > 20 ? '…' : ''}</span></p>
      )}
      {!models && <p className="app-muted"><Badge tone="info">Sin filtro</Badge> Carga el Excel de modelos del proyecto para quedarte solo con Juliet. Mientras tanto se usan todos los modelos.</p>}
      <div className="yc-table-wrap">
        <table className="yc-table">
          <thead><tr><th>Modelo</th><th className="num">Filas</th><th className="num">Entradas</th><th>Proyecto</th></tr></thead>
          <tbody>
            {byModel.map((m) => {
              const inJuliet = !models || models.has(m.name.toUpperCase());
              return (
                <tr key={m.name}>
                  <td className="code">{m.name}</td>
                  <td className="num">{n(all.filter((r) => r.model === m.name).length)}</td>
                  <td className="num">{n(m.input)}</td>
                  <td>{!models ? <Badge tone="neutral">Sin filtro</Badge> : inJuliet ? <Badge tone="ok">Juliet</Badge> : <Badge tone="warn">Fuera del proyecto</Badge>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
