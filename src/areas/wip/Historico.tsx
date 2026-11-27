// Histórico de WIP: cómo cambia el WIP entre cortes. Tendencia por turno (T1 07:00–15:00, T2 15:00–22:30; 22:30–07:00 pendiente)
// o por semana, con el último corte de cada uno; y la comparativa de dos cortes por estación. (El Historial lista los archivos cargados.)
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendChart } from '../../components/charts.tsx';
import { Badge, Button, Segmented, Select } from '../../components/ui.tsx';
import { loadWipCorte, loadWipCortes, type WipCorte, type WipResumen } from '../../lib/db.ts';
import { cambioPorEstacion, semana, tendencia, turno } from '../../lib/wip.ts';
import { PageHead } from '../../pages/Layout.tsx';
import { n } from './wipParts.tsx';

const nombre = (c: WipCorte) => `${c.corte} · ${turno(c.corte) === 'pendiente' ? 'pendiente' : turno(c.corte)} · ${n(c.piezas)} piezas`;

export default function Historico() {
  const [cortes, setCortes] = useState<WipCorte[]>(), [err, setErr] = useState<string>();
  const [por, setPor] = useState<'turno' | 'semana'>('turno'), [solo, setSolo] = useState<'ambos' | 'T1' | 'T2'>('ambos');
  const [a, setA] = useState<number>(), [b, setB] = useState<number>(), [res, setRes] = useState<Record<number, WipResumen>>({});
  useEffect(() => { loadWipCortes().then((cs) => { setCortes(cs); setB(cs[0]?.id); setA(cs[1]?.id); }, (e) => { setErr(e.message); setCortes([]); }); }, []);
  const pedidos = useRef(new Set<number>()), [errCmp, setErrCmp] = useState<string>();
  useEffect(() => {
    for (const id of [a, b]) if (id && !pedidos.current.has(id)) {
      pedidos.current.add(id); // una sola vez por corte (antes se volvía a pedir al llegar el otro)
      loadWipCorte(id).then((c) => setRes((r) => ({ ...r, [id]: c.resumen })), (e) => { pedidos.current.delete(id); setErrCmp(e.message); });
    }
  }, [a, b]);

  if (!cortes) return <><PageHead title="Histórico · WIP" /><p className="app-muted">Cargando…</p></>;
  const puntos = tendencia(cortes, por, por === 'turno' && solo !== 'ambos' ? solo : undefined);
  const ca = cortes.find((c) => c.id === a), cb = cortes.find((c) => c.id === b);
  const filas = a && b && res[a] && res[b] ? cambioPorEstacion(res[a], res[b]) : undefined;
  const opciones = cortes.map((c) => ({ value: String(c.id), label: nombre(c) }));
  return (
    <>
      <PageHead title="Histórico · WIP" sub="Cómo cambia el WIP entre cortes: la tendencia por turno o por semana (el último corte de cada uno) y la comparativa de dos cortes por estación." />
      {err && <p className="app-muted" role="status"><Badge tone="warn">Base</Badge> Sin conexión con la base: {err}</p>}
      {!cortes.length ? <p className="yc-card app-empty">Aún no hay cortes en la base. Carga un WIP en <Link to="/wip/carga">Carga de datos</Link>.</p> : (
        <>
          <section className="yc-card yc-pad app-hc" aria-labelledby="hc-t">
            <div className="app-hc-head">
              <h2 id="hc-t" className="app-h3">Tendencia</h2>
              <span className="yc-row">
                <Segmented label="Por" value={por} onChange={setPor} options={[{ value: 'turno', label: 'Turno' }, { value: 'semana', label: 'Semana' }]} />
                {por === 'turno' && <>
                  <Segmented label="Turno" value={solo} onChange={setSolo} options={[{ value: 'ambos', label: 'Ambos' }, { value: 'T1', label: 'T1 · 07–15' }, { value: 'T2', label: 'T2 · 15–22:30' }]} />
                  <span className="yc-field">&nbsp;<Button disabled title="De 22:30 a 07:00: turno pendiente de definir">22:30–07:00 · pendiente</Button></span>
                </>}
              </span>
            </div>
            {puntos.length < 2 ? <p className="app-muted">Hace falta más de un {por === 'turno' ? 'turno' : 'semana'} con cortes para ver la tendencia{puntos.length ? ` (hay ${puntos.length})` : ''}.</p> : (
              <TrendChart title={`En proceso por ${por}`} subtitle="El último corte de cada uno" yLabel="Piezas" categories={puntos.map((x) => x.label)}
                series={[{ name: 'En proceso', values: puntos.map((x) => x.c.piezas), tone: 'second' }]} lines={[{ name: 'Bloqueadas', values: puntos.map((x) => x.c.bloqueadas), tone: 'fail' }]} />
            )}
          </section>

          <section className="yc-card yc-pad app-hc" aria-labelledby="cmp-t">
            <h2 id="cmp-t" className="app-h3">Comparativa de dos cortes</h2>
            {cortes.length < 2 ? <p className="app-muted">Hace falta un segundo corte para comparar.</p> : (
              <>
                <div className="app-hc-sel">
                  <Select label="Antes" value={String(a ?? '')} onChange={(v) => setA(+v)} options={opciones} />
                  <Select label="Después" value={String(b ?? '')} onChange={(v) => setB(+v)} options={opciones} />
                </div>
                {ca && cb && (
                  <ul className="app-cx-sum">
                    <li><b>{n(ca.piezas)}</b> → <b>{n(cb.piezas)}</b> en proceso</li>
                    <li><Badge tone={cb.piezas > ca.piezas ? 'warn' : cb.piezas < ca.piezas ? 'ok' : 'neutral'}>{cb.piezas - ca.piezas > 0 ? '+' : ''}{n(cb.piezas - ca.piezas)}</Badge></li>
                    <li><b>{n(ca.bloqueadas)}</b> → <b>{n(cb.bloqueadas)}</b> bloqueadas</li>
                    <li className="app-muted">{semana(ca.corte)[1]} → {semana(cb.corte)[1]}</li>
                  </ul>
                )}
                {!filas ? <p className="app-muted" role="status">{errCmp ? <><Badge tone="warn">Base</Badge> No se pudo leer un corte: {errCmp}. Elige otro o recarga la página.</> : 'Cargando los cortes…'}</p> : (
                  <div className="yc-table-wrap app-hc-t">
                    <table className="yc-table">
                      <thead><tr><th>Estación</th><th className="num">Antes</th><th className="num">Después</th><th className="num">Cambio</th><th className="num">Bloqueadas</th></tr></thead>
                      <tbody>{filas.map((f) => (
                        <tr key={f.estacion}><td className="code">{f.estacion}</td><td className="num">{n(f.antes)}</td><td className="num">{n(f.despues)}</td>
                          <td className="num">{f.cambio ? <Badge tone={f.cambio > 0 ? 'warn' : 'ok'}>{f.cambio > 0 ? '+' : ''}{n(f.cambio)}</Badge> : <span className="app-muted">0</span>}</td>
                          <td className="num">{n(f.bloqAntes)} → {n(f.bloqDespues)}</td></tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </section>
        </>
      )}
    </>
  );
}
