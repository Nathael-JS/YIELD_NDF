import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, KpiTile, PeriodTabs, Select } from '../components/ui.tsx';
import { download } from '../lib/download.ts';
import { classify, ndfStations } from '../lib/fails.ts';
import { by, modelKey, periodOf, periodsOf, shortDay, toWatch } from '../lib/tcqs.ts';
import { ordenes, stations, urgente } from '../lib/wip.ts';
import { useApp, useData } from '../store.ts';
import { useArea } from '../areas.ts';
import { PageHead } from './Layout.tsx';
import { codesOf, NdfReport, useFails } from '../areas/yield/Ndf.tsx';
import { criticas, kpisOf, useWip } from '../areas/wip/wipParts.tsx';
import { ALL, GRAINS, view, WHOLE } from '../areas/yield/Yield.tsx';

const slug = (t: string) => t.replace(/\s+/g, '-').toLowerCase();

/** Un botón que genera un archivo: mientras trabaja se desactiva; si falla, dice por qué. */
function useJob() {
  const [busy, setBusy] = useState<string>(), [fail, setFail] = useState<string>();
  const run = (what: string, job: () => Promise<void>) => async () => {
    setBusy(what); setFail(undefined);
    try { await job(); } catch (e) { setFail(`No se pudo generar ${what}: ${e instanceof Error ? e.message : e}`); } finally { setBusy(undefined); }
  };
  return { busy, fail, run };
}

export default function Descargas() {
  const area = useArea();
  return (
    <>
      <PageHead title={`Descargas · ${area.name}`} sub="Reportes en HTML (se abre sin internet, con buscador) y PDF (para imprimir o enviar). Se generan en este equipo con lo que tienes cargado." />
      <div className="app-dl">{area.id === 'yield' ? <YieldCard /> : area.id === 'wip' ? <WipCard /> : <PalletsCard />}</div>
    </>
  );
}

/** Pallets: aquí irá el Shipping report CTO (PALLETS.md, F5). */
const PalletsCard = () => <Card title="Pallets" empty={<>El Shipping report CTO se exportará aquí (en desarrollo). Los datos de cada DN completo están en <Link to="/pallets/etiquetas">Etiquetas</Link>.</>} />;

function YieldCard() {
  const { records, from, to, models } = useData();
  const period = useApp((s) => s.period), setPeriod = useApp((s) => s.setPeriod);
  const [model, setModel] = useState(ALL), [pick, setPick] = useState<string>();
  const { read: fallas } = useFails(records, models); // primeras fallas (si se cargaron) para la sección NDF
  const { busy, fail, run } = useJob();
  if (!records.length) return <Card title="Yield" empty={<>Carga el TCQS en <Link to="/yield/carga">Carga de datos</Link>.</>} />;

  const rs = model === ALL ? records : records.filter((r) => r.model === model);
  const ps = periodsOf(rs, period);
  const cur = pick === WHOLE ? undefined : ps.find(([k]) => k === pick) ?? ps.at(-1);
  const i = cur ? ps.indexOf(cur) : -1;
  const sub = cur ? `Juliet · ${cur[1]}${i > 0 ? ` · comparado con ${ps[i - 1][1]}` : ''}` : `Juliet · ${shortDay(from!)} – ${shortDay(to!)}`;
  const file = `yield-juliet-${slug(cur?.[1] ?? 'rango')}`, title = `Yield de Juliet · ${cur?.[1] ?? 'todo el rango'}`;
  const inCur = (d: string) => !cur || periodOf(d, period)[0] === cur[0];
  // primeras fallas del mismo modelo y periodo (NDF)
  const failsOf = (m: string) => (fallas && !fallas.missing.length ? fallas.fails.filter((x) => (!models || models.has(modelKey(x.model))) && (m === ALL || x.model === m) && inCur(x.date)) : undefined);

  const pdf = run('el PDF', async () => {
    const { reportPdf } = await import('./pdf.tsx');
    const { st, kpiList, scope } = view(rs, period, cur?.[0], ps[i - 1]?.[0], model === ALL ? 'todas las estaciones' : model);
    const periods = by(rs, (r) => periodOf(r.date, period)[0]).filter((p) => p.input > 0).sort((a, b) => (a.name < b.name ? -1 : 1));
    const pr = rs.filter((r) => inCur(r.date)), mk = classify(failsOf(model) ?? [], pr).marked;
    download(`${file}.pdf`, await reportPdf({
      ndf: { stations: ndfStations(pr), codes: codesOf(mk), units: mk, input: pr.reduce((a, r) => a + r.input, 0) },
      title, sub: `${sub} · ${scope}`, kpis: kpiList, stations: st, watch: toWatch(st),
      pareto: st.filter((x) => x.ff > 0).map((x) => ({ label: x.name, value: x.ff })),
      trend: periods.map((p) => ({ label: ps.find(([k]) => k === p.name)![1], fpy: p.fpy, final: p.final })),
    }));
  });
  const html = run('el HTML', async () => {
    const { reportHtml } = await import('./report.tsx');
    // todos los modelos en un solo archivo (el lector elige en la lista); el elegido aquí va primero
    const views = [ALL, ...[...new Set(records.map((r) => r.model))].sort()].map((m) => {
      const mrs = m === ALL ? records : records.filter((r) => r.model === m), keys = periodsOf(mrs, period), at = cur ? keys.findIndex(([k]) => k === cur[0]) : -1;
      const v = view(mrs, period, cur?.[0], at > 0 ? keys[at - 1][0] : undefined, m === ALL ? 'todas las estaciones' : m);
      const pr = mrs.filter((r) => inCur(r.date)), pf = failsOf(m);
      return { name: m, kpis: <>{v.kpiList.map((k) => <KpiTile key={k.label} {...k} />)}</>, slides: v.sl, table: v.table, ndf: <NdfReport recs={pr} marked={pf && classify(pf, pr).marked} />, input: v.t.input };
    }).filter((v) => v.input > 0).sort((a, b) => Number(b.name === model) - Number(a.name === model));
    download(`${file}.html`, new Blob([reportHtml({ title, sub, views })], { type: 'text/html' }));
  });

  return (
    <Card title="Yield" what="KPIs, gráficas, estaciones con diagnóstico y NDF; el HTML trae todos los modelos." busy={busy} fail={fail} onHtml={html} onPdf={pdf}>
      <PeriodTabs value={period} onChange={setPeriod} options={GRAINS} />
      <Select label="Periodo" value={cur?.[0] ?? WHOLE} onChange={setPick} options={[...[...ps].reverse().map(([value, label]) => ({ value, label })), { value: WHOLE, label: 'Todo el rango' }]} />
      <Select label="Modelo" value={model} onChange={setModel} options={[ALL, ...new Set(records.map((r) => r.model))]} />
    </Card>
  );
}

function WipCard() {
  const { file, read, records, mine } = useWip();
  const [model, setModel] = useState(''), [mo, setMo] = useState('');
  const { busy, fail, run } = useJob();
  if (!read || read.missing.length) return <Card title="WIP" empty={<>Carga el reporte WIP en <Link to="/wip/carga">Carga de datos</Link>.</>} />;

  const all = mine(read.piezas), keep = (p: { model: string; mo: string }) => (!model || p.model === model) && (!mo || p.mo === mo);
  const ps = all.filter(keep), st = stations(ps, records), crit = criticas(ps);
  const os = ordenes(ps, mine(read.terminadas).filter(keep), mine(read.ocultas).filter(keep));
  const scope = [model || 'todos los modelos', mo && `orden ${mo}`].filter(Boolean).join(' · ');
  const title = `WIP de Juliet · ${scope}`, name = `wip-${slug(mo || model || 'juliet')}-${read.corte.slice(0, 10)}`;
  const sub = `Tiempo contado hasta ${read.corte.slice(0, 16)} · último movimiento ${read.ultimo.slice(0, 16)} · ${file!.name}`;
  const nota = 'Terminadas (STOCKIN) y empaque (FG, PACK_CTN, PACK_PALT) no cuentan como piezas en proceso. Semáforo: verde < 2 h, naranja < 20 h, rojo desde 20 h; urgente pasando de 100 h.';

  const html = run('el HTML', async () => {
    const { wipHtml } = await import('../areas/wip/wipReport.tsx');
    download(`${name}.html`, new Blob([wipHtml({ title, sub, ps, st, criticas: crit, os, nota })], { type: 'text/html' }));
  });
  const pdf = run('el PDF', async () => {
    const { wipPdf } = await import('./pdf.tsx');
    download(`${name}.pdf`, await wipPdf({ title, sub, kpis: kpisOf(ps).map((k) => ({ label: k.label, value: k.ps.length })), stations: st, criticas: crit, ordenes: os, nota }));
  });

  return (
    <Card title="WIP" what={`Resumen y semáforo, flujo por estación, urgentes y bloqueadas (${crit.length}), y por orden.`} busy={busy} fail={fail} onHtml={html} onPdf={pdf}
      meta={<span className="yc-row"><Badge tone={ps.some((p) => urgente(p.hours)) ? 'bad' : 'ok'}>{ps.length.toLocaleString('es-MX')} en proceso</Badge><span className="app-muted">corte {read.corte.slice(0, 16)}</span></span>}>
      <Select label="Modelo" value={model} onChange={(v) => { setModel(v); setMo(''); }} options={[{ value: '', label: 'Todos' }, ...[...new Set(all.map((p) => p.model))].sort()]} />
      <Select label="Orden" value={mo} onChange={setMo} options={[{ value: '', label: 'Todas' }, ...[...new Set(all.filter((p) => !model || p.model === model).map((p) => p.mo))].sort()]} />
    </Card>
  );
}

function Card({ title, what, empty, meta, busy, fail, onHtml, onPdf, children, htmlLabel = 'Descargar HTML' }: {
  title: string; what?: string; empty?: React.ReactNode; meta?: React.ReactNode; busy?: string; fail?: string; htmlLabel?: string;
  onHtml?: () => void; onPdf?: () => void; children?: React.ReactNode;
}) {
  return (
    <section className="yc-card app-dl-card" aria-labelledby={`dl-${title}`}>
      <header><h2 id={`dl-${title}`} className="app-h3">{title}</h2>{meta}</header>
      {empty ? <p className="app-muted">{empty}</p> : (
        <>
          <p className="app-muted">{what}</p>
          {children && <div className="app-dl-filters">{children}</div>}
          <div className="yc-row">
            <Button variant="primary" onClick={onHtml} disabled={!!busy}>{busy === 'el HTML' ? 'Generando…' : htmlLabel}</Button>
            <Button onClick={onPdf} disabled={!!busy || !onPdf}>{busy === 'el PDF' ? 'Generando PDF…' : 'Descargar PDF'}</Button>
          </div>
          {fail && <p className="app-muted" role="alert"><Badge tone="bad">Error</Badge> {fail}</p>}
        </>
      )}
    </section>
  );
}
