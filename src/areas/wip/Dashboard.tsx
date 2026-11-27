// Dashboard de WIP: la vista de entrada del área. Con el último corte guardado en la base (o, sin base, con el WIP cargado aquí):
// cuánto hay, desde hace cuánto (semáforo) y dónde está, en el flujo Process Stage → Board → Station. Tocar un ícono abre sus seriales.
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, KpiTile, Segmented, Select } from '../../components/ui.tsx';
import { BarChart, ParetoChart } from '../../components/charts.tsx';
import { FlowMap, UnitIcon } from '../../components/flow.tsx';
import { loadWipCorte, loadWipCortes, loadWipFlujo, type WipDetalle } from '../../lib/db.ts';
import { agrupar, detalleWip, estadoOf, flujoDe, local, nivel, readWip, semana, turno, urgente, type Dim, type Paso } from '../../lib/wip.ts';
import { PageHead } from '../../pages/Layout.tsx';
import { useApp } from '../../store.ts';
import { dur, Hours, n } from './wipParts.tsx';

type P = WipDetalle[number];
interface Datos { fuente: 'base' | 'archivo'; corte: string; archivo: string; piezas: P[]; terminadas: number; antes?: number; aviso?: string }
const ms = (s: string) => Date.parse(`${s.replace(' ', 'T')}Z`); // horas de planta, como local()
const TURNO = { T1: 'Turno 1 · 07:00–15:00', T2: 'Turno 2 · 15:00–22:30', pendiente: 'Turno pendiente · 22:30–07:00' };
const SEM = [['ok', 'Menos de 2 h'], ['warn', '2 a 20 h'], ['bad', '20 a 100 h'], ['urg', 'Más de 100 h · urgente']] as const;
const grupo = (h: number) => (urgente(h) ? 'urg' : nivel(h));
const DIMS: { value: Dim; label: string }[] = [{ value: 'station', label: 'Estación' }, { value: 'model', label: 'Modelo' }, { value: 'mo', label: 'Orden' },
  { value: 'prev', label: 'Última estación' }, { value: 'tiempo', label: 'Tiempo en estación' }, { value: 'serial', label: 'Serial' }];

/** Gráficos: Pareto por estación, modelo, orden o última estación; barras por rango de tiempo; los seriales más viejos.
 * La tabla de al lado hace lo mismo que el clic en una barra (también con teclado): abre los seriales. */
function Graficos({ ps, onVer }: { ps: P[]; onVer: (titulo: string, xs: P[]) => void }) {
  const [dim, setDim] = useState<Dim>('station'), nombre = DIMS.find((d) => d.value === dim)!.label;
  const gs = agrupar(ps, dim), top = dim === 'tiempo' ? gs : gs.slice(0, 20);
  const pick = (label: string) => { const g = gs.find((x) => x.label === label); if (g?.ps.length) onVer(`${nombre}: ${label}`, g.ps); };
  return (
    <section className="yc-card yc-pad app-db-charts" aria-labelledby="gr-t">
      <div className="app-db-charts-head">
        <h2 id="gr-t" className="app-h3">Gráficos</h2>
        <Segmented label="Por" value={dim} onChange={setDim} options={DIMS} />
      </div>
      {dim === 'prev' && ps.length > 0 && ps.every((p) => !p.prev) ? (
        <p className="app-empty">Este WIP no trae la estación anterior (columna GROUP_NAME): la trae el reporte WIP por orden. Carga uno para ver este gráfico.</p>
      ) : (
      <div className="app-db-charts-body">
        <div className="app-db-chart">
          {dim === 'tiempo' ? <BarChart title="Piezas por tiempo en la estación" categories={gs.map((g) => g.label)} series={[{ name: 'Piezas', values: gs.map((g) => g.value), tone: 'fail' }]} yLabel="Piezas" />
            : dim === 'serial' ? <BarChart horizontal title="Los 20 seriales con más tiempo en su estación" categories={top.map((g) => g.label)} series={[{ name: 'Horas', values: top.map((g) => g.value), tone: 'fail' }]} xLabel="Horas" />
            : <ParetoChart title={`Piezas en proceso por ${nombre.toLowerCase()}`} subtitle={gs.length > 20 ? `Las 20 con más piezas de ${gs.length}` : undefined} data={gs.map((g) => ({ label: g.label, value: g.value }))} limit={20} onPick={pick} />}
        </div>
        <div className="yc-table-wrap app-db-chart-t">
          <table className="yc-table">
            <thead><tr><th>{nombre}</th><th className="num">{dim === 'serial' ? 'Tiempo' : 'Piezas'}</th>{dim !== 'serial' && <th className="num">%</th>}<th /></tr></thead>
            <tbody>{top.map((g) => (
              <tr key={g.label}><td className="code">{g.label}</td>
                <td className="num">{dim === 'serial' ? <Hours h={g.value} /> : n(g.value)}</td>
                {dim !== 'serial' && <td className="num">{ps.length ? Math.round((g.value / ps.length) * 100) : 0}</td>}
                <td>{g.ps.length > 0 && <Button variant="quiet" onClick={() => onVer(`${nombre}: ${g.label}`, g.ps)} aria-label={`Ver seriales de ${g.label}`}>Ver</Button>}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </div>
      )}
    </section>
  );
}

/** El último corte de la base; sin base o sin cortes, el WIP cargado en este equipo. */
function useDatos() {
  const file = useApp((s) => s.files.WIP), [d, setD] = useState<Datos | null>(), [pasos, setPasos] = useState<Paso[]>([]);
  useEffect(() => {
    const delArchivo = (aviso?: string): Datos | null => {
      if (!file) return null;
      const r = readWip(file, file.cargado);
      return r.missing.length ? null : { fuente: 'archivo', corte: (r.corte || r.ultimo).slice(0, 16), archivo: file.name, piezas: detalleWip(r.piezas), terminadas: r.terminadas.length, aviso };
    };
    loadWipFlujo().then((f) => setPasos(f.pasos), () => {});
    loadWipCortes().then(async (cs) => {
      if (!cs.length) return setD(delArchivo());
      const c = await loadWipCorte(cs[0].id);
      setD(c.detalle.length ? { fuente: 'base', corte: cs[0].corte, archivo: cs[0].archivo, piezas: c.detalle, terminadas: cs[0].terminadas, antes: cs[1]?.piezas }
        : delArchivo('El último corte de la base es de antes de 0.45 y no trae sus piezas.') ?? { fuente: 'base', corte: cs[0].corte, archivo: cs[0].archivo, piezas: [], terminadas: cs[0].terminadas, aviso: 'El último corte de la base no trae sus piezas: vuelve a cargar el WIP.' });
    }, (e) => setD(delArchivo(`Sin conexión con la base (${e.message}): se muestra el WIP cargado en este equipo.`)));
  }, [file]);
  return { d, pasos };
}

/** Lista de seriales con su tiempo (ventana). */
function Seriales({ titulo, ps, onClose }: { titulo: string; ps: P[]; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return (
    <dialog ref={ref} className="yc-card app-det app-ser" aria-labelledby="ser-t" onClose={onClose} onClick={(e) => e.target === ref.current && ref.current?.close()}>
      <header className="app-det-head">
        <div><span className="app-item-k">{ps.length} {ps.length === 1 ? 'pieza' : 'piezas'}</span><h2 id="ser-t">{titulo}</h2></div>
        <button type="button" className="yc-btn yc-btn-quiet" onClick={() => ref.current?.close()}>Cerrar</button>
      </header>
      <div className="yc-table-wrap app-ser-t">
        <table className="yc-table">
          <thead><tr><th>Serial</th><th className="num">Tiempo ahí</th><th>Estación</th><th>Estado</th><th>Modelo</th><th>Orden</th></tr></thead>
          <tbody>{[...ps].sort((a, b) => b.hours - a.hours).map((p) => (
            <tr key={p.serial}><td className="code app-ser-sn">{p.serial}</td><td className="num"><Hours h={p.hours} /></td><td className="code">{p.station}</td>
              <td>{p.blocked ? <Badge tone="bad">Bloqueada</Badge> : <Badge tone="neutral">{estadoOf(p.station)}</Badge>}</td><td className="code">{p.model}</td><td className="code">{p.mo}</td></tr>
          ))}</tbody>
        </table>
      </div>
    </dialog>
  );
}

export default function Dashboard() {
  const { d, pasos } = useDatos(), [modelo, setModelo] = useState(''), [ver, setVer] = useState<{ titulo: string; ps: P[] }>();
  if (d === undefined) return <><PageHead title="Dashboard · WIP" /><p className="app-muted">Cargando el último corte…</p></>;
  if (!d) return (
    <>
      <PageHead title="Dashboard · WIP" sub="Cuánto hay en proceso, desde hace cuánto y dónde está." />
      <p className="yc-card app-empty">Aún no hay un WIP guardado. Carga el reporte en <Link to="/wip/carga">Carga de datos</Link>: se guarda solo y aparece aquí.</p>
    </>
  );
  const ps = d.piezas.filter((p) => !modelo || p.model === modelo), t = turno(d.corte), edad = (ms(local()) - ms(d.corte)) / 36e5;
  const { stages, piezasDe } = flujoDe(pasos, ps), urg = ps.filter((p) => urgente(p.hours)).length;
  const prom = ps.length ? ps.reduce((a, p) => a + p.hours, 0) / ps.length : 0;
  return (
    <>
      <PageHead title="Dashboard · WIP" sub="Cuánto hay en proceso, desde hace cuánto y dónde está. Toca un ícono para ver sus seriales.">
        <Link className="yc-btn yc-btn-secondary" to="/wip/piezas">Ver pieza por pieza</Link>
        <Link className="yc-btn yc-btn-secondary" to="/wip/carga">Cargar WIP</Link>
      </PageHead>
      <section className="yc-card app-db-head" aria-label="Corte">
        <div>
          <span className="app-item-k">Último corte</span>
          <strong className="app-mono">{d.corte}</strong>
          <span className="yc-row"><Badge tone={t === 'pendiente' ? 'neutral' : 'info'}>{TURNO[t]}</Badge><Badge tone="neutral">{semana(d.corte)[1]}</Badge>
            <Badge tone={edad > 24 ? 'warn' : 'ok'}>{edad < 1 ? 'hace menos de 1 h' : `hace ${dur(edad)}`}</Badge></span>
          <span className="app-muted">{d.archivo} · {d.fuente === 'base' ? 'guardado en la base' : 'cargado en este equipo'}</span>
        </div>
        <Select label="Modelo" value={modelo} onChange={setModelo} options={[{ value: '', label: 'Todos' }, ...[...new Set(d.piezas.map((p) => p.model))].sort()]} />
      </section>
      {d.aviso && <p className="app-muted" role="status"><Badge tone="warn">Aviso</Badge> {d.aviso}</p>}

      <div className="yc-grid-kpi">
        <KpiTile label="En proceso" value={n(ps.length)} delta={!modelo && d.antes !== undefined ? ps.length - d.antes : undefined} good={false} />
        <KpiTile label="Bloqueadas" value={n(ps.filter((p) => p.blocked).length)} />
        <KpiTile label="Urgentes (> 100 h)" value={n(urg)} />
        <KpiTile label="Tiempo promedio" value={dur(prom)} />
        <KpiTile label="Terminadas en el corte" value={n(d.terminadas)} />
      </div>

      <section className="yc-card yc-pad app-db-sem" aria-labelledby="sem-t">
        <h2 id="sem-t" className="app-h3">Desde hace cuánto están en su estación</h2>
        {/* misma escala de color que los íconos (semáforo), no la de las gráficas */}
        <div className="app-db-bar" role="img" aria-label={SEM.map(([k, label]) => `${label}: ${ps.filter((p) => grupo(p.hours) === k).length}`).join(', ')}>
          {SEM.map(([k]) => <span key={k} className={`is-${k}`} style={{ flexGrow: ps.filter((p) => grupo(p.hours) === k).length }} />)}
        </div>
        <ul className="app-db-units">{SEM.map(([k, label]) => {
          const xs = ps.filter((p) => grupo(p.hours) === k);
          return (
            <li key={k}>
              <UnitIcon tone={k === 'urg' ? 'bad' : k} urgent={k === 'urg' && xs.length > 0} n={xs.length} label={`${label}: ${xs.length} piezas. Ver seriales`}
                onClick={xs.length ? () => setVer({ titulo: label, ps: xs }) : undefined} />
              <span>{label}<small>{ps.length ? Math.round((xs.length / ps.length) * 100) : 0} %</small></span>
            </li>
          );
        })}</ul>
      </section>

      <section className="yc-card yc-pad app-db-flow" aria-labelledby="flow-t">
        <h2 id="flow-t" className="app-h3">Dónde están · por etapa {!pasos.length && <span className="app-muted">(sin estructura de flujo: cárgala en <Link to="/base">Base de datos</Link>)</span>}</h2>
        <FlowMap stages={stages} onPick={(stage, board, station) => setVer({ titulo: `${station} · ${board || stage}`, ps: piezasDe(stage, board, station) })} />
      </section>
      <Graficos ps={ps} onVer={(titulo, xs) => setVer({ titulo, ps: xs })} />
      {ver && <Seriales titulo={ver.titulo} ps={ver.ps} onClose={() => setVer(undefined)} />}
    </>
  );
}
