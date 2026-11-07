import { useNavigate } from 'react-router-dom';
import { Badge, Button, KpiTile, type Tone } from '../components/ui.tsx';
import { by, modelKey } from '../lib/tcqs.ts';
import { useData } from '../store.ts';
import { NeedTcqs, PageHead } from './Layout.tsx';

const n = (v: number) => v.toLocaleString('es-MX');
const CHECK: Partial<Record<Tone, string>> = { ok: 'OK', warn: 'Revisar', info: 'Aviso' };

export default function Validacion() {
  const { read, bom, models, all, records } = useData();
  const go = useNavigate();
  if (!read) return <><PageHead title="Validación" /><NeedTcqs /></>;
  if (read.missing.length) return (
    <>
      <PageHead title="Validación" />
      <p className="yc-card app-empty"><Badge tone="bad">Faltan columnas</Badge> El TCQS no trae <span className="app-mono">{read.missing.join(', ')}</span>. Revisa que sea el reporte de yield por estación.</p>
    </>
  );
  const byModel = by(all, (r) => r.model).sort((a, b) => b.input - a.input);
  const noInput = records.filter((r) => r.input === 0).length;
  // por estación, que es como se leen las tablas: en el periodo completo se compensan
  const extra = by(records, (r) => r.group).reduce((a, s) => a + s.extra, 0);
  const rawBom = new Set(bom);
  // comprobaciones de la «Guía de interpretación – YieldRateSFC y RetestRate»
  const checks: [Tone, string, string][] = [
    [read.bad.length ? 'warn' : 'ok', `${n(read.bad.length)} filas inválidas`, read.bad.length
      ? `Fecha, modelo o cantidades inválidas, o entradas ≠ 1er pase + 1ra falla (fórmula 1). No se usan: filas ${read.bad.slice(0, 15).join(', ')}${read.bad.length > 15 ? '…' : ''}.`
      : 'Todas cumplen entradas = 1er pase + 1ra falla (fórmula 1).'],
    [noInput ? 'info' : 'ok', `${n(noInput)} filas sin dato`, 'Entradas 0: se muestran como «—», no como 0 % de yield (regla 2).'],
    [extra ? 'warn' : 'ok', `${n(extra)} retests sin su 1ra falla en el rango`, 'Por estación: re-pruebas de unidades que entraron antes del corte o se re-probaron en otro equipo. No suben el yield: el retest nunca cuenta más que las primeras fallas (fórmula 10).'],
  ];
  return (
    <>
      <PageHead title="Validación" sub="Qué filas del TCQS se pueden usar y qué modelos son del proyecto Juliet.">
        <Button variant="primary" disabled={!records.length} onClick={() => go('/yield')}>Ver yield</Button>
      </PageHead>
      <div className="yc-grid-kpi">
        <KpiTile label="Filas del TCQS" value={n(all.length + read.bad.length)} />
        <KpiTile label="Modelos en el BOM" value={models ? n(models.size) : '—'} />
        <KpiTile label="Filas de Juliet" value={n(records.length)} />
      </div>
      <section className="yc-card yc-pad app-checks" aria-label="Comprobaciones">
        <h2 className="app-h3">Comprobaciones</h2>
        <ul>
          {checks.map(([tone, title, text]) => (
            <li key={title}><Badge tone={tone}>{CHECK[tone]}</Badge><div><strong>{title}</strong><p className="app-muted">{text}</p></div></li>
          ))}
          {!models && <li><Badge tone="info">Sin filtro</Badge><div><strong>Sin Excel de modelos</strong><p className="app-muted">Carga el BOM del proyecto para quedarte solo con Juliet. Mientras tanto se usan todos los modelos.</p></div></li>}
        </ul>
      </section>
      <div className="yc-table-wrap">
        <table className="yc-table">
          <thead><tr><th>Modelo</th><th className="num">Filas</th><th className="num">Entradas</th><th>Proyecto</th></tr></thead>
          <tbody>
            {byModel.map((m) => {
              const inJuliet = models?.has(modelKey(m.name));
              return (
                <tr key={m.name}>
                  <td className="code">{m.name}</td>
                  <td className="num">{n(all.filter((r) => r.model === m.name).length)}</td>
                  <td className="num">{n(m.input)}</td>
                  <td>{!models ? <Badge tone="neutral">Sin filtro</Badge>
                    : !inJuliet ? <Badge tone="warn">Fuera del proyecto</Badge>
                    : rawBom.has(m.name.toUpperCase()) ? <Badge tone="ok">Juliet</Badge>
                    : <Badge tone="ok">Juliet · en el BOM como {m.name.replace(/^SA/i, 'MA')}</Badge>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
