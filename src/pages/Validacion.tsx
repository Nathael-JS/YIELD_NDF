import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useArea } from '../areas.ts';
import { readEntregas, readShipping, readTarimas } from '../lib/pallets.ts';
import { Badge, Button, KpiTile, type Tone } from '../components/ui.tsx';
import { by, congruence, modelKey, pctText } from '../lib/tcqs.ts';
import { useApp, useData } from '../store.ts';
import { NeedTcqs, PageHead } from './Layout.tsx';
import { useWip } from '../areas/wip/wipParts.tsx';

import { num as n } from '../lib/chart.ts';
const CHECK: Partial<Record<Tone, string>> = { ok: 'OK', warn: 'Revisar', info: 'Aviso' };

/** Cada área valida lo suyo: Yield el TCQS, WIP su reporte, Pallets el listado, el shipping report y las tarimas. */
export default function Validacion() {
  const area = useArea();
  if (area.id === 'wip') return <><PageHead title="Validación · WIP" /><WipCheck empty /></>;
  if (area.id === 'pallets') return <><PageHead title="Validación · Pallets" /><PalletsCheck /></>;
  return <ValidacionYield />;
}

function ValidacionYield() {
  const { read, bom, models, all, records } = useData();
  const go = useNavigate();
  const db = useApp((s) => s.db), file = useApp((s) => s.files.TCQS);
  // estimado «real»: nuestras fórmulas sobre las filas de Juliet, contra lo que dicen las columnas de % del archivo.
  // El detalle fila por fila se guarda con la carga en la base; aquí solo el resultado. Una vez por archivo, no por pintada.
  const estimate = useMemo(() => file && congruence(file, (m) => !models || models.has(modelKey(m))), [file, models]);
  // el WIP se valida aparte: no espera al TCQS
  if (!read) return <><PageHead title="Validación · Yield" /><NeedTcqs /></>;
  if (read.missing.length) return (
    <>
      <PageHead title="Validación · Yield" />
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
      <PageHead title="Validación · Yield" sub="Qué filas del TCQS se pueden usar y qué modelos son del proyecto Juliet.">
        <Button variant="primary" disabled={!records.length} onClick={() => go('/yield/estaciones')}>Ver yield</Button>
      </PageHead>
      {db && <p className="app-muted" role="status"><Badge tone={db[0]}>Base</Badge> {db[1]}</p>}
      <div className="yc-grid-kpi">
        <KpiTile label="Filas del TCQS" value={n(all.length + read.bad.length)} />
        <KpiTile label="Modelos en el BOM" value={models ? n(models.size) : '—'} />
        <KpiTile label="Filas de Juliet" value={n(records.length)} />
      </div>
      {(() => {
        const c = estimate;
        if (!c || !Number.isFinite(c.reportado.fpy)) return null; // lo abierto desde la base no trae columnas de %
        const pts = (a: number, b: number) => { const d = Math.round((a - b) * 10) / 10; return d ? `${d > 0 ? '+' : ''}${d} pts vs. archivo` : 'igual que el archivo'; };
        return (
          <section className="yc-card yc-pad app-sec" aria-labelledby="estimado">
            <h2 id="estimado" className="app-h3">Estimado real</h2>
            <p className="app-muted">Calculado con las fórmulas de la guía sobre {n(c.filas)} filas de Juliet. El archivo reporta FPY {pctText(c.reportado.fpy)} %, retest {pctText(c.reportado.retest)} % y Final {pctText(c.reportado.final)} % (sus columnas, ponderadas por entradas); la diferencia viene de retests de unidades de otro día y del tope de 100 % por fila.</p>
            <div className="yc-grid-kpi">
              {([['FPY', 'fpy'], ['A retest', 'retest'], ['Final Yield', 'final']] as const).map(([label, k]) => (
                <div key={k} className="yc-kpi">
                  <span className="yc-kpi-label">{label}</span>
                  <span className="yc-kpi-value">{pctText(c.calculado[k])}<span className="yc-kpi-unit">%</span></span>
                  <span className="yc-kpi-delta app-muted">{pts(c.calculado[k], c.reportado[k])}</span>
                </div>
              ))}
            </div>
          </section>
        );
      })()}
      <section className="yc-card yc-pad app-checks" aria-label="Comprobaciones">
        <h2 className="app-h3">Comprobaciones</h2>
        <ul>
          {checks.map(([tone, title, text]) => (
            <li key={title}><Badge tone={tone}>{CHECK[tone]}</Badge><div><strong>{title}</strong><p className="app-muted">{text}</p></div></li>
          ))}
          {!models && <li><Badge tone="info">Sin filtro</Badge><div><strong>Sin Excel de modelos</strong><p className="app-muted">Un administrador sube el Excel del BOM en Base de datos para quedarte solo con Juliet. Mientras tanto se usan todos los modelos.</p></div></li>}
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

/** Validación del WIP, independiente del TCQS: qué filas se usan, qué formato es y hasta qué hora se cuenta el tiempo. */
function WipCheck({ empty }: { empty?: boolean }) {
  const { file, read, mine } = useWip();
  const go = useNavigate();
  if (!file || !read) return empty ? <p className="yc-card app-empty">Carga el reporte WIP en <Link to="/wip/carga">Carga de datos</Link>.</p> : null;
  if (read.missing.length) return <p className="yc-card app-empty"><Badge tone="bad">WIP · faltan columnas</Badge> {file.name} no trae <span className="app-mono">{read.missing.join(', ')}</span>.</p>;
  const ps = mine(read.piezas), unicas = read.filas - read.bad.length - read.repetidas;
  const checks: [Tone, string, string][] = [
    [read.repetidas ? 'info' : 'ok', `${n(read.repetidas)} filas repetidas`, 'El MES repite filas de la misma pieza: se cuenta una vez, con su llegada más reciente.'],
    [read.bad.length ? 'warn' : 'ok', `${n(read.bad.length)} filas inválidas`, read.bad.length ? `Sin serial, estación u hora; no se usan: filas ${read.bad.slice(0, 15).join(', ')}${read.bad.length > 15 ? '…' : ''}.` : 'Todas traen serial, estación y hora.'],
    [read.fuente === 'movimiento' ? 'warn' : 'ok', `Tiempo contado hasta ${read.corte.slice(0, 16)}`, read.fuente === 'archivo' ? 'El reporte general trae las horas en la estación (HOUR).' : read.fuente === 'carga' ? `Reporte por orden: sin HOUR, las horas se cuentan hasta la carga del archivo. Último movimiento: ${read.ultimo.slice(0, 16)}.` : 'Archivo cargado antes de 0.27: se cuenta hasta el último movimiento. Vuelve a cargarlo para contar hasta la hora de carga.'],
  ];
  return (
    <section className="yc-card yc-pad app-checks" aria-labelledby="wip-check">
      <h2 id="wip-check" className="app-h3">WIP · {file.name} <Badge tone="info">{read.formato === 'por orden' ? 'Reporte por orden' : 'Reporte general'}</Badge></h2>
      <div className="yc-grid-kpi">
        <KpiTile label="Piezas en el archivo" value={n(unicas)} />
        <KpiTile label="En proceso (Juliet)" value={n(ps.length)} />
        <KpiTile label="Terminadas y empaque" value={n(mine(read.terminadas).length + mine(read.ocultas).length)} />
        <KpiTile label="Órdenes" value={n(new Set(ps.map((p) => p.mo)).size)} />
      </div>
      <ul>{checks.map(([tone, title, text]) => <li key={title}><Badge tone={tone}>{CHECK[tone]}</Badge><div><strong>{title}</strong><p className="app-muted">{text}</p></div></li>)}</ul>
      <div className="yc-row"><Button variant="primary" onClick={() => go('/wip')}>Ver WIP</Button></div>
    </section>
  );
}

/** Validación de Pallets: qué se leyó de cada archivo y qué falta. */
function PalletsCheck() {
  const files = useApp((s) => s.files), go = useNavigate();
  const dn = files.DN && readEntregas(files.DN), sh = files.SHIPPING && readShipping(files.SHIPPING), ta = files.TARIMAS && readTarimas(files.TARIMAS);
  if (!dn && !sh && !ta) return <p className="yc-card app-empty">Carga el listado de entregas, el shipping report o un CSV de tarimas en <Link to="/pallets/carga">Carga de datos</Link>.</p>;
  const checks: [Tone, string, string][] = [];
  if (dn) checks.push(dn.missing.length ? ['warn', `Listado: faltan ${dn.missing.length} columnas`, dn.missing.join(', ')] : ['ok', `Listado: ${n(dn.entregas.length)} entregas`, 'Cada entrega llena SO, T/O, PO, modelo, piezas, cliente, destino y pesos de su tarima (el DN y el NVIDIA DN se escriben a mano).']);
  if (sh) checks.push(sh.missing.length ? ['warn', `Shipping report: faltan ${sh.missing.length} columnas`, sh.missing.join(', ')] : ['ok', `Shipping report: ${n(sh.tarimas.length)} tarimas con Pallet #`, `Sirven para no repetir un Pallet # y para reimprimir.${sh.sinPallet ? ` ${n(sh.sinPallet)} filas sin Pallet # no se usan.` : ''}`]);
  if (ta) checks.push(ta.missing.length ? ['warn', `Tarimas: faltan ${ta.missing.length} columnas`, ta.missing.join(', ')] : ['ok', `Tarimas: ${n(ta.tarimas.length)} en este equipo`, 'Se editan y se reimprimen en Etiquetas; se exportan en Descargas.']);
  return (
    <section className="yc-card yc-pad app-checks" aria-label="Comprobaciones de Pallets">
      <ul>{checks.map(([tone, title, text]) => <li key={title}><Badge tone={tone}>{CHECK[tone]}</Badge><div><strong>{title}</strong><p className="app-muted">{text}</p></div></li>)}</ul>
      <div className="yc-row"><Button variant="primary" onClick={() => go('/pallets')}>Ir a etiquetas</Button></div>
    </section>
  );
}
