import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, KpiTile, Select } from '../components/ui.tsx';
import { ParetoChart } from '../components/charts.tsx';
import { byLabel, classify, ndfStations, readFails, top80, type Estado, type Marked } from '../lib/fails.ts';
import { modelKey, pctText, type Rec } from '../lib/tcqs.ts';
import { useApp, useData } from '../store.ts';
import { NeedTcqs, PageHead } from './Layout.tsx';

const n = (v: number) => (Number.isFinite(v) ? v.toLocaleString('es-MX', { maximumFractionDigits: 1 }) : '—');
const ALL = '';
const TOP = 20; // barras del Pareto de códigos: con más no se leen (el % acumulado sigue siendo sobre todas)
const TONE: Record<Estado, 'ok' | 'bad' | 'warn' | 'info' | 'neutral'> = { NDF: 'ok', Real: 'bad', Pendiente: 'warn', Mezcla: 'info', 'Sin TCQS': 'neutral' };
const ESTADO: Record<Estado, string> = { NDF: 'NDF', Real: 'Real', Pendiente: 'Pendiente', Mezcla: 'NDF probable', 'Sin TCQS': 'Sin TCQS' };

/** Códigos con su «NDF estimado» (`est`): la suma de la probabilidad de cada falla (2do pase ÷ 1ra falla de su orden × estación). */
export const codesOf = (ms: Marked[]) => byLabel(ms, (m) => m.code);

/** Primeras fallas del archivo, del proyecto y marcadas contra el TCQS (lo usa también el HTML descargable). */
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
export function UnitTable({ units }: { units: Marked[] }) {
  return (
    <div className="yc-table-wrap">
      <table className="yc-table">
        <thead><tr><th>Serial</th><th>Fecha</th><th>Estación</th><th>Tester</th><th>Orden</th><th>Modelo</th><th>Estado</th></tr></thead>
        <tbody>{units.map((u, i) => (
          <tr key={`${u.serial}|${u.group}|${i}`}>
            <td className="code">{u.serial}</td><td className="code">{u.date}</td><td className="code">{u.group}</td><td className="code">{u.tester}</td>
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

  return (
    <>
      <PageHead title="NDF" sub="No defect found: fallaron la primera vez y pasaron al re-probar sin reparación (2do pase del TCQS). Los códigos vienen del reporte de primeras fallas.">
        <Select label="Modelo" value={model} onChange={pickModel} options={[{ value: ALL, label: 'Todos los modelos' }, ...[...new Set(records.map((r) => r.model))].sort()]} />
        <Select label="Estación" value={station} onChange={pickStation} options={[{ value: ALL, label: 'Todas las estaciones' }, ...stations.map((s) => s.name).sort()]} />
        <Select label="Tester" value={tester} onChange={(t) => { setTester(t); setCode(undefined); }} disabled={!marked}
          options={[{ value: ALL, label: 'Todos los testers' }, ...[...new Set(inStation.map((m) => m.tester))].sort()]} />
      </PageHead>
      <div className="yc-grid-kpi">
        <KpiTile label="Primeras fallas" value={n(sum('ff'))} />
        <KpiTile label="NDF" value={n(sum('ndf'))} unit={` · ${pctText((sum('ndf') / sum('ff')) * 100)} % de las fallas`} />
        <KpiTile label="Reales (a reparación)" value={n(sum('real'))} />
        <KpiTile label="Pendientes de re-probar" value={n(sum('pend'))} />
        <KpiTile label="SPY (NDF / entradas)" value={pctText((sum('ndf') / input) * 100)} unit="%" />
      </div>
      <section className="yc-card yc-pad app-sec" aria-labelledby="codigos">
        <h2 id="codigos" className="app-h3">Por qué fallan · <span className="app-mono">{where}</span></h2>
        {!read ? (
          <p className="app-muted">Carga el reporte de <strong>primeras fallas</strong> (FirstFail) en <Link to="/carga">Carga de datos</Link> para ver los códigos de error, los testers y los seriales.</p>
        ) : !marked ? (
          <p className="app-muted"><Badge tone="bad">Faltan columnas</Badge> El archivo no trae <span className="app-mono">{read.missing.join(', ')}</span>.</p>
        ) : (
          <>
            <p className="app-muted">
              <Badge tone={marked.distintos ? 'warn' : 'ok'}>{marked.distintos ? 'Revisar' : 'Cuadra'}</Badge>{' '}
              El archivo cuadra con FIRST_FAIL_QTY del TCQS en {n(marked.grupos - marked.distintos)} de {n(marked.grupos)} grupos (día × orden × estación × tester).
              {' '}Clic en una barra o en «Ver unidades» para ver los seriales.
            </p>
            {!codes.length ? <p className="app-muted">Sin primeras fallas en el archivo para {where}.</p> : (
              <>
                {/* vista del 2do nivel, arriba de las gráficas para que las dos queden a la misma altura */}
                <div className="yc-row app-switch" role="group" aria-label="2do nivel">
                      <Button variant={lvl2 === 'tester' ? 'secondary' : 'quiet'} aria-pressed={lvl2 === 'tester'} onClick={() => setLvl2('tester')}>Testers de los códigos del 80 %</Button>
                      <Button variant={lvl2 === 'codigo' ? 'secondary' : 'quiet'} aria-pressed={lvl2 === 'codigo'} onClick={() => setLvl2('codigo')}>Códigos de los testers del 80 %</Button>
                    </div>
                {/* key: con cada filtro la gráfica vuelve a entrar (barras que crecen, línea que se dibuja) */}
                <div className="app-charts app-anim" key={`${where}|${lvl2}`}>
                  <ParetoChart title="Primeras fallas por código" level={1} limit={TOP} picked={code} onPick={setCode}
                    subtitle={`1er nivel · ${where}${codes.length > TOP ? ` · ${TOP} de ${codes.length} códigos (todos en la tabla)` : ''}`}
                    data={codes.map((c) => ({ label: c.name, value: c.total, hint: `${c.desc} · NDF estimado ${n(c.est)}` }))} />
                    {lvl2 === 'tester' ? (
                      <ParetoChart title="Testers de los códigos del 80 %" level={2} subtitle={`2do nivel · ${top.size} código${top.size === 1 ? '' : 's'} · clic para filtrar por tester`} picked={tester} onPick={(t) => { setTester(t); setCode(undefined); }}
                        data={testers.map((t) => ({ label: t.name, value: t.total }))} />
                    ) : (
                      <ParetoChart title="Códigos de los testers del 80 %" level={2} limit={TOP} picked={code} onPick={setCode}
                        subtitle={`2do nivel · ${topTesters.size} tester${topTesters.size === 1 ? '' : 's'}: ${[...topTesters].slice(0, 4).join(', ')}${topTesters.size > 4 ? '…' : ''} · clic para ver unidades`}
                        data={testerCodes.map((c) => ({ label: c.name, value: c.total, hint: `${c.desc} · NDF estimado ${n(c.est)}` }))} />
                    )}
                </div>
                {picked && (
                  <section className="app-sec app-units" aria-labelledby="unidades">
                    <div className="app-zoom-head">
                      <div><h3 id="unidades" className="app-h3"><span className="app-mono">{picked.name}</span> · {n(units.length)} unidad{units.length === 1 ? '' : 'es'}</h3>
                        <p className="app-muted">{picked.desc} · NDF estimado {n(picked.est)} de {n(picked.total)}{codes.indexOf(picked) >= TOP ? ` · fuera de las ${TOP} barras de la gráfica` : ''}</p></div>
                      <Button variant="quiet" onClick={() => setCode(undefined)}>Cerrar</Button>
                    </div>
                    <UnitTable units={units} />
                  </section>
                )}
                <div className="yc-table-wrap">
                  <table className="yc-table">
                    <thead><tr><th>Código</th><th>Descripción</th><th className="num">Unidades</th><th className="num">NDF estimado</th><th className="num">NDF seguro</th><th className="num">Real seguro</th><th>Pareto 80 %</th><th /></tr></thead>
                    <tbody>{codes.map((c) => (
                      <tr key={c.name} className={c.name === code ? 'is-focus' : undefined}>
                        <td className="code">{c.name}</td><td className="app-desc" title={c.desc}>{c.desc}</td>
                        <td className="num">{n(c.total)}</td><td className="num">{n(c.est)}</td><td className="num">{n(c.NDF)}</td><td className="num">{n(c.Real)}</td>
                        <td>{top.has(c.name) ? <Badge tone="warn">Sí</Badge> : <span className="app-muted">No</span>}</td>
                        <td><Button variant="quiet" onClick={() => setCode(c.name)}>Ver unidades</Button></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </section>
      <section className="yc-card app-stations" aria-labelledby="estaciones">
        <h2 id="estaciones" className="app-h3">NDF por estación <span className="app-muted">· {stations.length} con fallas · clic en «Ver códigos» para filtrar</span></h2>
        <StationTable stations={stations} focus={station} onPick={pickStation} />
      </section>
    </>
  );
}

/** Sección NDF del HTML descargable: estaciones, Pareto de códigos y, por código, sus seriales en un desplegable. */
export function NdfReport({ recs, marked }: { recs: Rec[]; marked?: Marked[] }) {
  const stations = ndfStations(recs), codes = marked ? codesOf(marked) : [];
  if (!stations.length) return null;
  return (
    <section className="app-view" aria-label="NDF">
      <h2 className="app-h3">NDF · no defect found</h2>
      <StationTable stations={stations} />
      {codes.length > 0 && (
        <>
          <ParetoChart title="Primeras fallas por código" level={1} limit={TOP} subtitle={`Todas las estaciones${codes.length > TOP ? ` · ${TOP} de ${codes.length} códigos (todos abajo)` : ''}`}
            data={codes.map((c) => ({ label: c.name, value: c.total, hint: c.desc }))} />
          <div className="app-ndf-codes">
            {codes.map((c) => (
              <details key={c.name} className="yc-card">
                <summary><span className="app-mono">{c.name}</span> · {n(c.total)} unidad{c.total === 1 ? '' : 'es'} · NDF estimado {n(c.est)} <span className="app-muted">{c.desc}</span></summary>
                <UnitTable units={marked!.filter((m) => m.code === c.name)} />
              </details>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
