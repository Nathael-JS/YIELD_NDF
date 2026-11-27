// Hora por hora del WIP: por estación (en el orden del flujo: etapa → board → ruta), cuántas piezas llegaron en cada una de las
// últimas horas y siguen ahí, sacado de la hora de llegada (IN_STATION_TIME) del último corte. Arriba, el total en proceso de los
// cortes de esas horas, para ver cómo cambia. Un clic en una celda abre sus seriales.
import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Segmented } from '../../components/ui.tsx';
import { loadWipCortes, type WipCorte } from '../../lib/db.ts';
import { filtrar, flujoDe, porHora, type Filtro } from '../../lib/wip.ts';
import { PageHead } from '../../pages/Layout.tsx';
import { useDatos } from './Dashboard.tsx';
import { FILTRO0, Filtros, n, QuitarFiltros, Seriales } from './wipParts.tsx';

const HORAS = [{ value: '8', label: '8 h' }, { value: '12', label: '12 h' }, { value: '24', label: '24 h' }];

export default function Horas() {
  const { d, pasos, fallo } = useDatos();
  const [f, setF] = useState<Filtro>(FILTRO0), [horas, setHoras] = useState(12), [ver, setVer] = useState<{ titulo: string; ps: NonNullable<typeof d>['piezas'] }>();
  const [cortes, setCortes] = useState<WipCorte[]>([]);
  useEffect(() => { loadWipCortes().then(setCortes, () => {}); }, []);
  const filtrado = useMemo(() => filtrar(d?.piezas ?? [], pasos, f), [d, pasos, f]);
  if (d === undefined) return <><PageHead title="Hora por hora · WIP" /><p className="app-muted">Cargando el último corte…</p></>;
  if (!d) return (
    <>
      <PageHead title="Hora por hora · WIP" />
      <p className="yc-card app-empty">{fallo ? `No se pudo leer el último corte de la base (${fallo}). ` : 'Aún no hay un WIP guardado. '}Carga el reporte en <Link to="/wip/carga">Carga de datos</Link>.</p>
    </>
  );

  const { cols, filas } = porHora(filtrado.ps, d.corte, horas);
  // estaciones en el orden del flujo, solo las que tienen piezas; agrupadas por etapa · board
  const grupos = flujoDe(pasos, filtrado.ps).stages.flatMap((s) => s.boards.map((b) => ({
    titulo: b.board ? `${s.stage} · ${b.board}` : s.stage, estaciones: b.stations.filter((x) => x.n).map((x) => x.station),
  }))).filter((g) => g.estaciones.length);
  const total = cols.map((_, i) => [...filas.values()].reduce((t, x) => t + x.horas[i].length, 0));
  const tope = Math.max(1, ...[...filas.values()].flatMap((x) => x.horas.map((h) => h.length)));
  // total en proceso de los cortes guardados en cada hora (el último de la hora), sin filtros: es el número del corte
  const porCorte = cols.map((c) => cortes.filter((x) => x.corte.slice(0, 13) === c).sort((a, b) => b.corte.localeCompare(a.corte))[0]);
  const hora = (c: string) => `${c.slice(11, 13)}:00`;

  return (
    <>
      <PageHead title="Hora por hora · WIP" sub="Cuántas piezas llegaron a cada estación en cada hora y siguen ahí, en el orden del flujo. Toca una celda para ver sus seriales." />
      <section className="yc-card app-db-head" aria-label="Corte">
        <div>
          <span className="app-item-k">Último corte</span>
          <strong className="app-mono">{d.corte}</strong>
          <span className="app-muted">{d.archivo} · {d.fuente === 'base' ? 'guardado en la base' : 'cargado en este equipo'}</span>
        </div>
        <Segmented label="Últimas" value={String(horas)} onChange={(v) => setHoras(Number(v))} options={HORAS} />
      </section>
      <section className="yc-card app-wip-filters" aria-label="Filtros">
        <Filtros f={f} set={setF} opciones={filtrado.opciones} conFlujo={pasos.length > 0} />
        <QuitarFiltros n={filtrado.activos} onClick={() => setF(FILTRO0)} />
      </section>
      {d.aviso && <p className="app-muted" role="status"><Badge tone="warn">Aviso</Badge> {d.aviso}</p>}

      <section className="yc-card yc-pad app-hh-sec">
        <div className="yc-table-wrap">
          <table className="yc-table app-hh" aria-label="Llegadas por estación y hora">
            <thead>
              <tr><th>Estación</th><th className="num" title="Llegaron antes de estas horas y siguen ahí">Antes</th>
                {cols.map((c) => <th key={c} className="num" title={`${c}:00 a ${hora(c).slice(0, 2)}:59`}>{hora(c)}</th>)}<th className="num">Total</th></tr>
              <tr className="app-hh-corte"><th scope="row">En proceso (corte)</th><td />
                {porCorte.map((c, i) => {
                  const prev = porCorte.slice(0, i).reverse().find(Boolean);
                  return <td key={cols[i]} className="num" title={c ? `${c.corte} · ${c.archivo}` : 'Sin corte en esta hora'}>{c ? <>{n(c.piezas)}{prev && <small className={c.piezas > prev.piezas ? 'is-up' : 'is-down'}> {c.piezas >= prev.piezas ? '+' : ''}{n(c.piezas - prev.piezas)}</small>}</> : <span className="app-muted">·</span>}</td>;
                })}<td /></tr>
            </thead>
            <tbody>
              {grupos.map((g) => (
                <Fragment key={g.titulo}>
                  <tr className="app-wip-sec"><th colSpan={cols.length + 3} scope="colgroup">{g.titulo}</th></tr>
                  {g.estaciones.map((s) => {
                    const x = filas.get(s)!;
                    return (
                      <tr key={s}><td className="code">{s}</td><td className="num app-muted">{n(x.antes)}</td>
                        {x.horas.map((h, i) => (
                          <td key={cols[i]} className="num app-hh-c" style={{ '--hh': h.length / tope } as React.CSSProperties}>
                            {h.length > 0 && <button type="button" onClick={() => setVer({ titulo: `${s} · llegaron de ${hora(cols[i])} a ${hora(cols[i]).slice(0, 2)}:59`, ps: h })} aria-label={`${s}, ${hora(cols[i])}: ${h.length} piezas. Ver seriales`}>{h.length}</button>}
                          </td>
                        ))}
                        <td className="num">{n(x.horas.reduce((t, h) => t + h.length, 0))}</td></tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
            <tfoot><tr><th>Llegaron en total</th><td /> {total.map((t, i) => <td key={cols[i]} className="num">{n(t)}</td>)}<td className="num">{n(total.reduce((a, b) => a + b, 0))}</td></tr></tfoot>
          </table>
        </div>
        <p className="app-muted">Cuenta las piezas que <b>siguen</b> en la estación: las que llegaron y ya avanzaron aparecen en su estación actual. «Antes»: llegaron antes de estas horas. La fila «En proceso (corte)» es el total de cada corte guardado en esa hora, sin filtros.</p>
      </section>
      {ver && <Seriales titulo={ver.titulo} ps={ver.ps} onClose={() => setVer(undefined)} />}
    </>
  );
}
