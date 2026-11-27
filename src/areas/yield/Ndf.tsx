import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Segmented, Select, SplitBar, type SplitPart } from '../../components/ui.tsx';
import { ParetoChart } from '../../components/charts.tsx';
import { byLabel, classify, ndfStations, readFails, top80, type Estado, type Marked } from '../../lib/fails.ts';
import { modelKey, pctText, type Rec } from '../../lib/tcqs.ts';
import { useApp, useData } from '../../store.ts';
import { NeedTcqs, PageHead, Ventana } from '../../pages/Layout.tsx';

const n = (v: number) => (Number.isFinite(v) ? v.toLocaleString('es-MX', { maximumFractionDigits: 1 }) : '—');
const ALL = '';
/** Texto corto para títulos (los códigos de ICT traen cientos de letras). */
const cut = (s: string) => (s.length > 40 ? `${s.slice(0, 39)}…` : s);
/** Primeras fallas repartidas: NDF (pasó al re-probar), real (a reparación) y pendiente de re-probar. */
export const splitParts = (ndf: number, real: number, pend: number): SplitPart[] =>
  [{ label: 'NDF', value: ndf, tone: 'second' }, { label: 'Real', value: real, tone: 'fail' }, { label: 'Pendiente', value: pend, tone: 'neutral' }];
const TOP = 20; // barras del Pareto de códigos: con más no se leen (el % acumulado sigue siendo sobre todas)
const TONE: Record<Estado, 'ok' | 'bad' | 'warn' | 'info' | 'neutral'> = { NDF: 'ok', Real: 'bad', Pendiente: 'warn', Mezcla: 'info', 'Sin TCQS': 'neutral' };
const ESTADO: Record<Estado, string> = { NDF: 'NDF', Real: 'Real', Pendiente: 'Pendiente', Mezcla: 'NDF probable', 'Sin TCQS': 'Sin TCQS' };

/** Códigos con su «NDF estimado» (`est`): la suma de la probabilidad de cada falla (2do pase ÷ 1ra falla de su orden × estación). */
export const codesOf = (ms: Marked[]) => byLabel(ms, (m) => m.code);

/** Primeras fallas del archivo, del proyecto y marcadas contra el TCQS (lo usa también el HTML descargable). */
/** Unidades de los paneles de Yield: las primeras fallas (FirstFail) del modelo; `keep` las deja en el periodo.
 * `abrir('FPY')` abre todas; `abrir('NDF')`, solo las NDF; otro panel, nada. Sin FirstFail cargado, los paneles quedan como números. */
const MAX_FILAS = 2000; // una ventana con más filas se vuelve lenta

export function useUnidades(model: string) {
  const { records, models } = useData();
  const { marked } = useFails(records, models, model);
  const [ver, setVer] = useState<{ titulo: string; us: Marked[] }>();
  const abrir = (label: string, keep: (u: Marked) => boolean = () => true) => {
    const fallas = marked ? marked.marked.filter(keep) : [];
    const l = label === 'FPY' ? ['Primeras fallas con serial en el FirstFail', fallas] as const : label === 'NDF' ? ['NDF con serial en el FirstFail (fallaron y pasaron al re-probar)', fallas.filter((u) => u.estado === 'NDF')] as const : undefined;
    return l?.[1].length ? () => setVer({ titulo: l[0], us: l[1] }) : undefined;
  };
  const ventana = ver && (
    <Ventana titulo={ver.titulo} cuenta={`${ver.us.length.toLocaleString('es-MX')} ${ver.us.length === 1 ? 'unidad' : 'unidades'}`} onClose={() => setVer(undefined)}>
      <UnitTable units={ver.us.slice(0, MAX_FILAS)} code />
      {ver.us.length > MAX_FILAS && <p className="app-muted">Se muestran las primeras {MAX_FILAS.toLocaleString('es-MX')}; filtra por modelo o periodo para ver otras.</p>}
    </Ventana>
  );
  const aviso = !marked && <p className="app-muted">Carga el reporte de primeras fallas (FirstFail) en <Link to="/yield/carga">Carga de datos</Link> para abrir sus seriales desde los paneles.</p>;
  return { abrir, ventana, aviso };
}

export function useFails(records: Rec[], models: Set<string> | null, model = ALL) {
  const file = useApp((s) => s.files.FALLAS);
  const read = useMemo(() => file && readFails(file), [file]);
  const marked = useMemo(() => read && !read.missing.length && classify(read.fails.filter((f) => (!models || models.has(modelKey(f.model))) && (!model || f.model === model)), records), [read, records, models, model]);
  return { read, marked };
}

/** Tabla de NDF por estación (página y HTML descargable). */
export function StationTable({ stations, focus, onPick }: { stations: ReturnType<typeof ndfStations>; focus?: string; onPick?: (s: string) => void }) {
  return (
    <div className="yc-table-wrap">
      <table className="yc-table">
        <thead><tr><th>Estación</th><th className="num">Entradas</th><th className="num">1ra falla</th><th className="num">NDF</th><th className="num">Real</th><th className="num">Pendiente</th><th className="num">SPY</th>{onPick && <th />}</tr></thead>
        <tbody>
          {stations.map((s) => (
            <tr key={s.name} className={s.name === focus ? 'is-focus' : undefined} aria-current={s.name === focus || undefined}>
              <td className="code">{s.name}</td><td className="num">{n(s.input)}</td><td className="num">{n(s.ff)}</td>
              <td className="num">{n(s.ndf)}</td><td className="num">{n(s.real)}</td><td className="num">{n(s.pend)}</td>
              <td className="num">{pctText((s.ndf / s.input) * 100)} %</td>
              {onPick && <td><Button variant="quiet" onClick={() => onPick(s.name)}>Ver códigos</Button></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Unidades de un código: serial, cuándo, dónde y qué dice el TCQS de su orden × estación. */
export function UnitTable({ units, code }: { units: Marked[]; code?: boolean }) {
  return (
    <div className="yc-table-wrap">
      <table className="yc-table">
        <thead><tr>{code && <th>Código</th>}<th>Serial</th><th>Fecha</th><th>Estación</th><th>Tester</th><th>Orden</th><th>Modelo</th><th>Estado</th></tr></thead>
        <tbody>{units.map((u, i) => (
          <tr key={`${u.serial}|${u.group}|${i}`}>
            {code && <td className="code app-cut" title={`${u.code} · ${u.desc}`}>{u.code}</td>}<td className="code">{u.serial}</td><td className="code">{u.date}</td><td className="code">{u.group}</td><td className="code">{u.tester}</td>
            <td className="code">{u.mo}</td><td className="code">{u.model}</td>
            <td><Badge tone={TONE[u.estado]} title={u.estado === 'Mezcla' ? `${Math.round(u.ndf * 100)} % de probabilidad según su orden × estación` : undefined}>{ESTADO[u.estado]}</Badge></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

/** NDF (no defect found): cuántas del TCQS y por qué, con los códigos del reporte de primeras fallas. Filtra por modelo, estación y tester. */
export default function Ndf() {
  const { records, models } = useData();
  const [model, setModel] = useState(ALL), [station, setStation] = useState(ALL), [tester, setTester] = useState(ALL), [code, setCode] = useState<string>(), [lvl2, setLvl2] = useState<'tester' | 'codigo'>('tester');
  const recs = useMemo(() => (model ? records.filter((r) => r.model === model) : records), [records, model]);
  const stations = useMemo(() => ndfStations(recs), [recs]);
  const { read, marked } = useFails(recs, models, model);
  if (!records.length) return <><PageHead title="NDF" /><NeedTcqs /></>;

  // cada filtro reinicia los de abajo: otro modelo puede no tener esa estación, ni esa estación ese tester
  const pickModel = (m: string) => { setModel(m); setStation(ALL); setTester(ALL); setCode(undefined); };
  const pickStation = (s: string) => { setStation(s); setTester(ALL); setCode(undefined); };
  const shown = station ? stations.filter((s) => s.name === station) : stations;
  const sum = (k: 'ff' | 'ndf' | 'real' | 'pend') => shown.reduce((a, s) => a + s[k], 0);
  // entradas de todas las estaciones (también las que no fallaron): si no, el SPY total sale inflado
  const input = recs.reduce((a, r) => (!station || r.group === station ? a + r.input : a), 0);
  const inStation = (marked ? marked.marked : []).filter((m) => !station || m.group === station);
  const view = inStation.filter((m) => !tester || m.tester === tester);
  const codes = codesOf(view), top = new Set(top80(codes).map((c) => c.name));
  const testers = byLabel(view.filter((m) => top.has(m.code)), (m) => m.tester);
  // 2do nivel al revés: los testers que suman el 80 % de las fallas y qué códigos les salen
  const topTesters = new Set(top80(byLabel(view, (m) => m.tester)).map((t) => t.name));
  const testerCodes = byLabel(view.filter((m) => topTesters.has(m.tester)), (m) => m.code);
  const picked = code && codes.find((c) => c.name === code);
  const units = picked ? view.filter((m) => m.code === code) : [];
  const where = [model, station, tester].filter(Boolean).join(' · ') || 'todas las estaciones';

  const ndf = sum('ndf'), ff = sum('ff'), real = sum('real'), pend = sum('pend');
  const lvl2Data = lvl2 === 'tester' ? testers.map((t) => ({ label: t.name, value: t.total }))
    : testerCodes.map((c) => ({ label: c.name, value: c.total, hint: `${c.desc} · NDF estimado ${n(c.est)}` }));

  return (
    <>
      <PageHead title="NDF" sub="No defect found: fallaron la primera vez y pasaron al re-probar sin reparación (2do pase del TCQS). Los códigos vienen del reporte de primeras fallas." />
      <div className="app-ndf">
        <div className="app-ndf-main">
          <section className="yc-card yc-pad app-sec" aria-labelledby="codigos">
            <h2 id="codigos" className="app-h3">Por qué fallan · <span className="app-mono">{where}</span></h2>
            {!read ? (
              <p className="app-muted">Carga el reporte de <strong>primeras fallas</strong> (FirstFail) en <Link to="/yield/carga">Carga de datos</Link> para ver los códigos de error, los testers y los seriales.</p>
            ) : !marked ? (
              <p className="app-muted"><Badge tone="bad">Faltan columnas</Badge> El archivo no trae <span className="app-mono">{read.missing.join(', ')}</span>.</p>
            ) : !codes.length ? <p className="app-muted">Sin primeras fallas en el archivo para {where}.</p> : (
              <>
                {/* key: con cada filtro las gráficas vuelven a entrar (barras que crecen, línea que se dibuja) */}
                <div className="app-ndf-charts app-anim" key={`${where}|${lvl2}`}>
                  <ParetoChart title="Primeras fallas por código" level={1} limit={TOP} picked={code} onPick={setCode}
                    subtitle={`1er nivel · ${where}${codes.length > TOP ? ` · ${TOP} de ${codes.length} códigos` : ''} · clic en una barra para ver sus unidades`}
                    data={codes.map((c) => ({ label: c.name, value: c.total, hint: `${c.desc} · NDF estimado ${n(c.est)}` }))} />
                  {picked && (
                    <section className="app-units" aria-labelledby="unidades">
                      <div className="app-zoom-head">
                        <div><h3 id="unidades" className="app-h3"><span className="app-mono" title={picked.name}>{cut(picked.name)}</span> · {n(units.length)} unidad{units.length === 1 ? '' : 'es'}</h3>
                          <p className="app-muted">{picked.desc} · NDF estimado {n(picked.est)} de {n(picked.total)}{codes.indexOf(picked) >= TOP ? ` · fuera de las ${TOP} barras de la gráfica` : ''}</p></div>
                        <Button variant="quiet" onClick={() => setCode(undefined)}>Cerrar</Button>
                      </div>
                      <UnitTable units={units} />
                    </section>
                  )}
                  {lvl2 === 'tester' ? (
                    <ParetoChart title="Testers de los códigos del 80 %" level={2} limit={TOP} data={lvl2Data} picked={tester} onPick={(t) => { setTester(t); setCode(undefined); }}
                      subtitle={`2do nivel · ${top.size} código${top.size === 1 ? '' : 's'} · clic para filtrar por tester`} />
                  ) : (
                    <ParetoChart title="Códigos de los testers del 80 %" level={2} limit={TOP} data={lvl2Data} picked={code} onPick={setCode}
                      subtitle={`2do nivel · ${topTesters.size} tester${topTesters.size === 1 ? '' : 's'}: ${[...topTesters].slice(0, 4).join(', ')}${topTesters.size > 4 ? '…' : ''}`} />
                  )}
                </div>
                {/* la lista completa queda guardada: las gráficas ya muestran los principales y es el acceso con teclado */}
                <details className="app-codes">
                  <summary>Todos los códigos ({n(codes.length)}) · descripción, NDF estimado y unidades</summary>
                  <div className="yc-table-wrap">
                    <table className="yc-table">
                      <thead><tr><th>Código</th><th>Descripción</th><th className="num">Unidades</th><th className="num">NDF estimado</th><th>80 %</th><th /></tr></thead>
                      <tbody>{codes.map((c) => (
                        <tr key={c.name} className={c.name === code ? 'is-focus' : undefined}>
                          <td className="code app-cut" title={c.name}>{c.name}</td><td className="app-desc" title={c.desc}>{c.desc}</td>
                          <td className="num">{n(c.total)}</td><td className="num">{n(c.est)}</td>
                          <td>{top.has(c.name) ? <Badge tone="warn">Sí</Badge> : <span className="app-muted">No</span>}</td>
                          <td><Button variant="quiet" onClick={() => setCode(c.name)}>Ver unidades</Button></td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </details>
              </>
            )}
          </section>
          <section className="yc-card app-stations" aria-labelledby="estaciones">
            <h2 id="estaciones" className="app-h3">NDF por estación <span className="app-muted">· {stations.length} con fallas · «Ver códigos» filtra la página</span></h2>
            <StationTable stations={stations} focus={station} onPick={pickStation} />
          </section>
        </div>
        <aside className="yc-card app-ndf-side" aria-label="Opciones y resumen">
          <div className="app-ndf-hero">
            <span className="yc-kpi-label">NDF · {where}</span>
            <span className="app-ndf-big">{n(ndf)}<small> de {n(ff)} primeras fallas</small></span>
            <span className="app-ndf-pct">{pctText((ndf / ff) * 100)} % se recupera al re-probar · SPY {pctText((ndf / input) * 100)} %</span>
          </div>
          <SplitBar parts={splitParts(ndf, real, pend)} format={n} />
          <div className="app-ndf-filters">
            <Select label="Modelo" value={model} onChange={pickModel} options={[{ value: ALL, label: 'Todos los modelos' }, ...[...new Set(records.map((r) => r.model))].sort()]} />
            <Select label="Estación" value={station} onChange={pickStation} options={[{ value: ALL, label: 'Todas las estaciones' }, ...stations.map((s) => s.name).sort()]} />
            <Select label="Tester" value={tester} onChange={(t) => { setTester(t); setCode(undefined); }} disabled={!marked}
              options={[{ value: ALL, label: 'Todos los testers' }, ...[...new Set(inStation.map((m) => m.tester))].sort()]} />
            {(model || station || tester) && <Button variant="quiet" onClick={() => pickModel(ALL)}>Quitar filtros</Button>}
          </div>
          <Segmented label="2do nivel" value={lvl2} onChange={setLvl2}
            options={[{ value: 'tester', label: 'Testers del 80 %' }, { value: 'codigo', label: 'Códigos del 80 %' }]} />
          {marked && <p className="app-muted app-ndf-note"><Badge tone={marked.distintos ? 'warn' : 'ok'}>{marked.distintos ? 'Revisar' : 'Cuadra'}</Badge> Archivo vs. TCQS: {n(marked.grupos - marked.distintos)} de {n(marked.grupos)} grupos iguales.</p>}
        </aside>
      </div>
    </>
  );
}

/** Sección NDF del HTML descargable: resumen, estaciones (compacto) y la estación con más NDF con sus Paretos y seriales.
 * shortcut: solo esa estación (las demás, en la app), cada estación más agregaría ~10 KB de gráficas por modelo. */
export function NdfReport({ recs, marked }: { recs: Rec[]; marked?: Marked[] }) {
  const stations = ndfStations(recs);
  if (!stations.length) return null;
  const sum = (k: 'ff' | 'ndf' | 'real' | 'pend') => stations.reduce((a, s) => a + s[k], 0), input = recs.reduce((a, r) => a + r.input, 0);
  const best = stations[0], mine = (marked ?? []).filter((m) => m.group === best.name);
  const codes = codesOf(mine), top = new Set(top80(codes).map((c) => c.name));
  const testers = byLabel(mine.filter((m) => top.has(m.code)), (m) => m.tester);
  return (
    <section className="app-view" aria-label="NDF">
      <div className="app-ndf-report">
        <div className="yc-card app-ndf-side">
          <div className="app-ndf-hero">
            <span className="yc-kpi-label">NDF · no defect found</span>
            <span className="app-ndf-big">{n(sum('ndf'))}<small> de {n(sum('ff'))} primeras fallas</small></span>
            <span className="app-ndf-pct">{pctText((sum('ndf') / sum('ff')) * 100)} % se recupera al re-probar · SPY {pctText((sum('ndf') / input) * 100)} %</span>
          </div>
          <SplitBar parts={splitParts(sum('ndf'), sum('real'), sum('pend'))} format={n} />
        </div>
        <section className="yc-card app-stations" aria-label="NDF por estación">
          <h3 className="app-h3">NDF por estación <span className="app-muted">· {stations.length} con fallas</span></h3>
          <StationTable stations={stations} focus={best.name} />
        </section>
      </div>
      {codes.length > 0 && (
        <>
          <h3 className="app-h3">Estación con más NDF · <span className="app-mono">{best.name}</span> <span className="app-muted">({n(best.ndf)} NDF de {n(best.ff)} primeras fallas; las demás, en la app)</span></h3>
          <div className="app-charts">
            <ParetoChart title="Primeras fallas por código" level={1} limit={TOP} subtitle={`1er nivel · ${best.name}${codes.length > TOP ? ` · ${TOP} de ${codes.length} códigos` : ''}`}
              data={codes.map((c) => ({ label: c.name, value: c.total, hint: c.desc }))} />
            <ParetoChart title="Testers de los códigos del 80 %" level={2} limit={TOP} subtitle={`2do nivel · ${top.size} código${top.size === 1 ? '' : 's'}`}
              data={testers.map((t) => ({ label: t.name, value: t.total }))} />
          </div>
          <details className="app-codes">
            <summary>Seriales de {best.name} ({n(mine.length)}) · por código</summary>
            <UnitTable units={[...mine].sort((a, b) => a.code.localeCompare(b.code))} code />
          </details>
        </>
      )}
    </section>
  );
}
