// Dashboard de WIP: la vista de entrada del área. Con el último corte guardado en la base (o, sin base, con el WIP cargado aquí):
// cuánto hay, desde hace cuánto (semáforo) y dónde está, en el flujo Process Stage → Board → Station. Tocar un ícono abre sus seriales.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, KpiTile, Segmented } from '../../components/ui.tsx';
import { BarChart, ParetoChart } from '../../components/charts.tsx';
import { FlowMap, UnitIcon } from '../../components/flow.tsx';
import { loadWipCorte, loadWipCortes, loadWipFlujo, type WipDetalle, type WipResumen } from '../../lib/db.ts';
import { agrupar, detalleWip, filtrar, flujoDe, local, nivel, readWip, semana, turno, urgente, type Dim, type Filtro, type Paso } from '../../lib/wip.ts';
import { PageHead } from '../../pages/Layout.tsx';
import { useApp } from '../../store.ts';
import { dur, FILTRO0, Filtros, Hours, n, QuitarFiltros, Seriales } from './wipParts.tsx';

type P = WipDetalle[number];
interface Datos { fuente: 'base' | 'archivo'; corte: string; archivo: string; piezas: P[]; terminadas: number; fin: P[]; antes?: { corte: string; resumen: WipResumen }; aviso?: string }
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
  const file = useApp((s) => s.files.WIP), [d, setD] = useState<Datos | null>(), [pasos, setPasos] = useState<Paso[]>([]), [fallo, setFallo] = useState<string>();
  useEffect(() => {
    const delArchivo = (aviso?: string): Datos | null => {
      if (!file) return null;
      const r = readWip(file, file.cargado);
      return r.missing.length ? null : { fuente: 'archivo', corte: (r.corte || r.ultimo).slice(0, 16), archivo: file.name, piezas: detalleWip(r.piezas), terminadas: r.terminadas.length, fin: detalleWip(r.terminadas), aviso };
    };
    loadWipFlujo().then((f) => setPasos(f.pasos), () => {});
    const sinBase = (e: Error) => { setFallo(e.message); setD(delArchivo(`Sin conexión con la base (${e.message}): se muestra el WIP cargado en este equipo.`)); };
    loadWipCortes().then(async (cs) => {
      if (!cs.length) return setD(delArchivo());
      const [c, a] = await Promise.all([loadWipCorte(cs[0].id, true), cs[1] ? loadWipCorte(cs[1].id).catch(() => undefined) : undefined]);
      const antes = a && { corte: cs[1].corte, resumen: a.resumen };
      setD(c.detalle?.length ? { fuente: 'base', corte: cs[0].corte, archivo: cs[0].archivo, piezas: c.detalle!, terminadas: cs[0].terminadas, fin: c.fin ?? [], antes }
        : delArchivo('El último corte de la base es de antes de 0.45 y no trae sus piezas.') ?? { fuente: 'base', corte: cs[0].corte, archivo: cs[0].archivo, piezas: [], terminadas: cs[0].terminadas, fin: [], aviso: 'El último corte de la base no trae sus piezas: vuelve a cargar el WIP.' });
    }).catch(sinBase); // también si falla leer el corte (dentro del then)
  }, [file]);
  return { d, pasos, fallo };
}

export default function Dashboard() {
  const { d, pasos, fallo } = useDatos(), [f, setF] = useState<Filtro>(FILTRO0), [ver, setVer] = useState<{ titulo: string; ps: P[] }>();
  const filtrado = useMemo(() => filtrar(d?.piezas ?? [], pasos, f), [d, pasos, f]);
  // terminadas con los mismos filtros, salvo la estación (todas están en STOCKIN)
  const fin = useMemo(() => filtrar(d?.fin ?? [], pasos, { ...f, station: '' }).ps, [d, pasos, f]);
  // el corte anterior con el mismo filtro y solo los modelos de este corte (un WIP de una orden no se compara con el general);
  // por orden no se puede: el resumen guardado es por estación × modelo
  const antes = useMemo(() => {
    if (!d?.antes || f.mo) return undefined;
    const modelos = new Set(d.piezas.map((p) => p.model));
    const filas = d.antes.resumen.filter((r) => modelos.has(r.modelo)).map((r) => ({ model: r.modelo, mo: '', station: r.estacion, piezas: r.piezas }));
    return filtrar(filas, pasos, f).ps.reduce((t, r) => t + r.piezas, 0);
  }, [d, pasos, f]);
  if (d === undefined) return <><PageHead title="Dashboard · WIP" /><p className="app-muted">Cargando el último corte…</p></>;
  if (!d) return (
    <>
      <PageHead title="Dashboard · WIP" sub="Cuánto hay en proceso, desde hace cuánto y dónde está." />
      <p className="yc-card app-empty">{fallo ? <>No se pudo leer el último corte de la base ({fallo}). Carga el WIP en <Link to="/wip/carga">Carga de datos</Link> para verlo desde este equipo.</>
        : <>Aún no hay un WIP guardado. Carga el reporte en <Link to="/wip/carga">Carga de datos</Link>: se guarda solo y aparece aquí.</>}</p>
    </>
  );
  const { ps, opciones, activos } = filtrado, t = turno(d.corte), edad = (ms(local()) - ms(d.corte)) / 36e5;
  const { stages, piezasDe } = flujoDe(pasos, ps), urg = ps.filter((p) => urgente(p.hours)), bloq = ps.filter((p) => p.blocked);
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
      </section>
      <section className="yc-card app-wip-filters" aria-label="Filtros">
        <Filtros f={f} set={setF} opciones={opciones} conFlujo={pasos.length > 0} />
        <QuitarFiltros n={activos} onClick={() => setF(FILTRO0)} />
      </section>
      {d.aviso && <p className="app-muted" role="status"><Badge tone="warn">Aviso</Badge> {d.aviso}</p>}

      <div className="yc-grid-kpi">
        <KpiTile label="En proceso" value={n(ps.length)} onClick={ps.length ? () => setVer({ titulo: 'En proceso', ps }) : undefined} delta={antes !== undefined ? ps.length - antes : undefined} deltaLabel={d.antes && `vs. el corte ${d.antes.corte}`} good={false} />
        <KpiTile label="Bloqueadas" value={n(bloq.length)} onClick={bloq.length ? () => setVer({ titulo: 'Bloqueadas', ps: bloq }) : undefined} />
        <KpiTile label="Urgentes (> 100 h)" value={n(urg.length)} onClick={urg.length ? () => setVer({ titulo: 'Urgentes · más de 100 h', ps: urg }) : undefined} />
        <KpiTile label="Tiempo promedio" value={dur(prom)} />
        {/* los cortes de antes de 0.53 no traen las terminadas: solo el número, sin filtro */}
        {d.fin.length || !d.terminadas ? <KpiTile label="Terminadas en el corte" value={n(fin.length)} onClick={fin.length ? () => setVer({ titulo: 'Terminadas en el corte (STOCKIN)', ps: fin }) : undefined} />
          : <KpiTile label="Terminadas en el corte" value={n(d.terminadas)} />}
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
