import { lazy, Suspense, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { Badge, Button, Segmented, Select } from '../../components/ui.tsx';
import { cruce, desde, ordenes, stations, type Pieza, type Ventana } from '../../lib/wip.ts';
import { useApp } from '../../store.ts';
import { PageHead } from '../../pages/Layout.tsx';
import { FlowTable, Kpis, Legend, n, OrderTable, UnitTable, useWip } from './wipParts.tsx';

const WipTimeline = lazy(() => import('./WipTimeline.tsx'));
const VENTANAS: { value: Ventana; label: string }[] = [
  { value: 'hora', label: 'Hora' }, { value: 'turno', label: 'Turno' }, { value: 'dia', label: 'Día' }, { value: 'semana', label: 'Semana' }, { value: 'todo', label: 'Todo' },
];
const VISTAS = [{ value: 'estacion' as const, label: 'Por estación' }, { value: 'orden' as const, label: 'Por orden' }];
const MAX_UNITS = 100; // piezas por estación a la vista (las más antiguas primero)
const FUENTE = { archivo: 'según el reporte', carga: 'hora de carga del archivo', movimiento: 'último movimiento (archivo cargado antes de 0.27)' };

/** Con otro archivo los filtros vuelven a empezar (la orden o el modelo elegidos pueden no existir en él). */
export default function Wip() {
  const file = useApp((s) => s.files.WIP);
  return <WipView key={file ? `${file.name}|${file.loadedAt}` : ''} />;
}

function WipView() {
  const { file, read, records, mine } = useWip();
  const [model, setModel] = useState(''), [mo, setMo] = useState(''), [q, setQ] = useState(''), [win, setWin] = useState<Ventana>('todo');
  const [vista, setVista] = useState<'estacion' | 'orden'>('estacion'), [tl, setTl] = useState(true);
  const [open, setOpen] = useState<string>();

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

  const all = mine(read.piezas);
  const from = desde(read.corte, win), term = q.trim().toUpperCase();
  const keep = (p: Pieza) => (!model || p.model === model) && (!mo || p.mo === mo) && (!term || p.serial.toUpperCase().includes(term)) && p.at >= from;
  const ps = all.filter(keep), st = stations(ps, records), x = cruce(all, records);
  const term2 = mine(read.terminadas).filter(keep), ocultas = mine(read.ocultas).filter(keep);
  const orders = [...new Set(all.filter((p) => !model || p.model === model).map((p) => p.mo))].sort();
  const pick = (s: string) => { setVista('estacion'); setOpen(s); requestAnimationFrame(() => document.getElementById(`wip-${s}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })); };
  const filtros = [model, mo, term, win !== 'todo'].filter(Boolean).length;

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
        <Select label="Modelo" value={model} onChange={(v) => { setModel(v); setMo(''); }} options={[{ value: '', label: 'Todos' }, ...[...new Set(all.map((p) => p.model))].sort()]} />
        <Select label="Orden" value={mo} onChange={setMo} options={[{ value: '', label: `Todas (${orders.length})` }, ...orders]} />
        <label className="yc-field">Serial<input className="yc-input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" /></label>
        <div className="app-wip-win">
          <Segmented label="Llegaron en la última" options={VENTANAS} value={win} onChange={setWin} />
          {from && <span className="app-muted">desde {from.slice(5, 16)}, contando hacia atrás desde {read.corte.slice(5, 16)}</span>}
        </div>
        {filtros > 0 && <Button variant="quiet" className="app-wip-clear" onClick={() => { setModel(''); setMo(''); setQ(''); setWin('todo'); }}>Quitar filtros ({filtros})</Button>}
      </section>

      <Kpis ps={ps} />

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
              <Suspense fallback={<p className="app-muted">Cargando línea de tiempo…</p>}><WipTimeline st={st} open={open} onPick={pick} /></Suspense>
            </motion.div>
          )}
        </AnimatePresence>
        {!ps.length ? <p className="app-muted">Ninguna pieza con estos filtros.</p>
          : vista === 'orden' ? <OrderTable os={ordenes(ps, term2, ocultas)} onPick={(o) => { setMo(o); setVista('estacion'); }} />
          : <FlowTable st={st} open={open} onOpen={setOpen} units={(s) => (
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
    </>
  );
}
