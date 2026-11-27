import { lazy, Suspense, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { Badge, Button, Segmented } from '../../components/ui.tsx';
import { cruce, desde, filtrar, lugarDe, nivel, ordenes, stations, type Filtro, type Paso, type Pieza, type Ventana } from '../../lib/wip.ts';
import { useApp } from '../../store.ts';
import { PageHead } from '../../pages/Layout.tsx';
import { FILTRO0, Filtros, FlowTable, Kpis, Legend, n, OrderTable, QuitarFiltros, Seriales, UnitTable, useFlujo, useWip } from './wipParts.tsx';

const WipTimeline = lazy(() => import('./WipTimeline.tsx'));
const VENTANAS: { value: Ventana; label: string }[] = [
  { value: 'hora', label: 'Hora' }, { value: 'turno', label: 'Turno' }, { value: 'dia', label: 'Día' }, { value: 'semana', label: 'Semana' }, { value: 'todo', label: 'Todo' },
];
const VISTAS = [{ value: 'estacion' as const, label: 'Por estación' }, { value: 'orden' as const, label: 'Por orden' }];
const MAX_UNITS = 100; // piezas por estación a la vista (las más antiguas primero)
const FUENTE = { archivo: 'según el reporte', carga: 'hora de carga del archivo', movimiento: 'último movimiento (archivo cargado antes de 0.27)' };

/** Con estructura de flujo, las estaciones se agrupan por etapa · board (como el Dashboard) en lugar de la sección del MES;
 * dentro de cada grupo siguen en el orden de la ruta. El grupo sale del modelo de su primera pieza. */
function porEtapa<S extends { name: string; section: string; piezas: Pieza[] }>(st: S[], pasos: Paso[]) {
  if (!pasos.length) return st;
  const orden = (l: { stage: string; board: string }) => { const i = pasos.findIndex((x) => x.stage === l.stage && x.board === l.board); return i < 0 ? Infinity : i; };
  return st.map((s) => { const l = lugarDe(pasos, s.piezas[0].model, s.name); return { s: { ...s, section: l.board ? `${l.stage} · ${l.board}` : l.stage }, k: orden(l) }; })
    .sort((a, b) => a.k - b.k).map((x) => x.s);
}

/** Con otro archivo los filtros vuelven a empezar (la orden o el modelo elegidos pueden no existir en él). */
export default function Wip() {
  const file = useApp((s) => s.files.WIP);
  return <WipView key={file ? `${file.name}|${file.loadedAt}` : ''} />;
}

function WipView() {
  const { file, read, records, mine } = useWip();
  const pasos = useFlujo(), [f, setF] = useState<Filtro>(FILTRO0), [q, setQ] = useState(''), [win, setWin] = useState<Ventana>('todo');
  const [vista, setVista] = useState<'estacion' | 'orden'>('estacion'), [tl, setTl] = useState(true);
  const [open, setOpen] = useState<string>(), [ver, setVer] = useState<{ titulo: string; ps: Pieza[] }>();

  const all = useMemo(() => (read && !read.missing.length ? mine(read.piezas) : []), [read, mine]);
  const filtrado = useMemo(() => filtrar(all, pasos, f), [all, pasos, f]);
  if (!read) return (
    <>
      <PageHead title="WIP" sub="Dónde está cada pieza y desde hace cuánto." />
      <p className="yc-card app-empty">Carga el reporte WIP (general o por orden) en <Link to="/wip/carga">Carga de datos</Link> para ver esta página.</p>
    </>
  );
  if (read.missing.length) return (
    <>
      <PageHead title="WIP" sub="Dónde está cada pieza y desde hace cuánto." />
      <p className="yc-card app-empty"><Badge tone="bad">Faltan columnas</Badge> Al archivo le faltan: {read.missing.join(', ')}.</p>
    </>
  );

  const from = desde(read.corte, win), term = q.trim().toUpperCase();
  const otros = (p: Pieza) => (!term || p.serial.toUpperCase().includes(term)) && p.at >= from;
  const ps = filtrado.ps.filter(otros), st = porEtapa(stations(ps, records), pasos), x = cruce(all, records);
  // terminadas y empaque: con los mismos filtros (su estación no se filtra: STOCKIN, PACK_CTN…)
  const fin = (xs: Pieza[]) => filtrar(xs, pasos, { ...f, station: '' }).ps.filter(otros);
  const term2 = fin(mine(read.terminadas)), ocultas = fin(mine(read.ocultas));
  const pick = (s: string) => { setVista('estacion'); setOpen(s); requestAnimationFrame(() => document.getElementById(`wip-${s}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })); };
  const filtros = filtrado.activos + [term, win !== 'todo'].filter(Boolean).length;

  return (
    <>
      <PageHead title="WIP" sub={`${file!.name} · ${read.formato === 'por orden' ? 'reporte por orden' : 'reporte general'}`}>
        <Link className="yc-btn yc-btn-secondary" to="/wip/descargas">Descargar HTML o PDF</Link>
      </PageHead>
      <p className="app-wip-times" role="status">
        <span><span className="yc-kpi-label">Tiempo contado hasta</span> <strong className="app-mono">{read.corte.slice(0, 16)}</strong> <span className="app-muted">({FUENTE[read.fuente]})</span></span>
        <span><span className="yc-kpi-label">Último movimiento</span> <strong className="app-mono">{read.ultimo.slice(0, 16)}</strong></span>
      </p>

      <section className="yc-card app-wip-filters" aria-label="Filtros">
        <Filtros f={f} set={setF} opciones={filtrado.opciones} conFlujo={pasos.length > 0} />
        <label className="yc-field">Serial<input className="yc-input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" /></label>
        <div className="app-wip-win">
          <Segmented label="Llegaron en la última" options={VENTANAS} value={win} onChange={setWin} />
          {from && <span className="app-muted">desde {from.slice(5, 16)}, contando hacia atrás desde {read.corte.slice(5, 16)}</span>}
        </div>
        <QuitarFiltros n={filtros} onClick={() => { setF(FILTRO0); setQ(''); setWin('todo'); }} />
      </section>

      <Kpis ps={ps} terminadas={term2} onPick={(titulo, xs) => setVer({ titulo, ps: xs })} />

      <section className="yc-card app-wip" aria-labelledby="wip-flow">
        <header className="app-wip-head">
          <h2 id="wip-flow" className="app-h3">{vista === 'orden' ? 'Por orden' : 'Flujo por estación'}</h2>
          <div className="app-wip-tools">
            <Legend />
            <Segmented label="Ver" options={VISTAS} value={vista} onChange={setVista} />
            <Button aria-expanded={tl} aria-controls="wip-tl" onClick={() => setTl(!tl)}>{tl ? 'Ocultar línea de tiempo' : 'Mostrar línea de tiempo'}</Button>
          </div>
        </header>
        <AnimatePresence initial={false}>
          {tl && st.length > 0 && (
            <motion.div id="wip-tl" key="tl" className="app-tl-wrap" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.35, ease: [0.2, 0.7, 0.2, 1] }}>
              <Suspense fallback={<p className="app-muted">Cargando línea de tiempo…</p>}><WipTimeline st={st} open={open} onPick={pick} onVer={(titulo, xs) => setVer({ titulo, ps: xs })} /></Suspense>
            </motion.div>
          )}
        </AnimatePresence>
        {!ps.length ? <p className="app-muted">Ninguna pieza con estos filtros.</p>
          : vista === 'orden' ? <OrderTable os={ordenes(ps, term2, ocultas)} onPick={(o) => { setF({ ...f, mo: o, station: '' }); setVista('estacion'); }} />
          : <FlowTable st={st} open={open} onOpen={setOpen} onPick={(station, k) => setVer({ titulo: `${station} · ${k === 'ok' ? 'menos de 2 h' : k === 'warn' ? 'menos de 20 h' : '20 h o más'}`, ps: ps.filter((p) => p.station === station && nivel(p.hours) === k) })} units={(s) => (
            <>
              <UnitTable ps={s.piezas.slice(0, MAX_UNITS)} />
              {s.n > MAX_UNITS && <p className="app-muted">Se muestran las {MAX_UNITS} más antiguas de {n(s.n)}; filtra por orden o serial para ver otras.</p>}
            </>
          )} />}
        <p className="app-muted">
          {n(term2.length)} terminadas (STOCKIN) y {n(ocultas.length)} en empaque (FG, PACK_CTN, PACK_PALT) no se muestran.
          {records.length ? ` Cruce con el TCQS: ${x.soloWip.length} órdenes con piezas en proceso no están en el TCQS; ${x.soloTcqs.length} del TCQS no tienen piezas en proceso.` : ' Carga el TCQS para ver el FPY de cada estación.'}
          {read.bad.length > 0 && ` ${read.bad.length} filas sin serial, estación u hora se ignoraron.`}
        </p>
      </section>
      {ver && <Seriales titulo={ver.titulo} ps={ver.ps} onClose={() => setVer(undefined)} />}
    </>
  );
}
