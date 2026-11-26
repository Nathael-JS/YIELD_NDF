// Conexión con WIP: las piezas pendientes (sin carton o Pallet ID) y faltantes de cada DN, con su estado en línea según el WIP cargado.
// El WIP se carga en su área (WIP → Carga de datos); aquí solo se lee. Si el WIP es más viejo que la vigencia elegida, se avisa.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Segmented, Select, type Tone } from '../../components/ui.tsx';
import { lista, pendientes, problema } from '../../lib/sfc.ts';
import { local, readWip, type Pieza as PiezaWip } from '../../lib/wip.ts';
import { PageHead } from '../../pages/Layout.tsx';
import { useApp } from '../../store.ts';
import { usePallets } from './items.ts';

type Vigencia = 'hora' | 'dia' | 'semana' | 'mes';
const HORAS: Record<Vigencia, number> = { hora: 1, dia: 24, semana: 24 * 7, mes: 24 * 30 };
const NOMBRE: Record<Vigencia, string> = { hora: '1 hora', dia: '1 día', semana: '1 semana', mes: '1 mes' };
const ms = (s: string) => Date.parse(`${s.replace(' ', 'T')}Z`); // mismas horas de planta que local()
const hace = (h: number) => (h < 1 ? `${Math.round(h * 60)} min` : h < 48 ? `${h.toFixed(1)} h` : `${Math.round(h / 24)} días`);

type EnWip = { p: PiezaWip; tipo: 'linea' | 'empaque' | 'terminada' };
const TONO: Record<EnWip['tipo'], Tone> = { linea: 'warn', empaque: 'info', terminada: 'ok' };

export default function Conexion() {
  const file = useApp((s) => s.files.WIP), { items, sync } = usePallets();
  useEffect(() => { sync(); }, [sync]); // los items de la base (otro equipo o sesión nueva)
  const [vig, setVig] = useState<Vigencia>('dia'), [dn, setDn] = useState(''), [q, setQ] = useState('');
  const wip = useMemo(() => {
    if (!file) return undefined;
    const r = readWip(file, file.cargado), m = new Map<string, EnWip>();
    for (const p of r.piezas) m.set(p.serial.toUpperCase(), { p, tipo: 'linea' });
    for (const p of r.ocultas) m.set(p.serial.toUpperCase(), { p, tipo: 'empaque' });
    for (const p of r.terminadas) m.set(p.serial.toUpperCase(), { p, tipo: 'terminada' });
    // qué tan actual es: el corte del reporte general; en el reporte por orden, su último movimiento (no la hora de carga)
    return { m, fecha: (r.formato === 'general' ? r.corte : r.ultimo) || file.cargado || '', missing: r.missing };
  }, [file]);
  const edad = wip?.fecha ? (ms(local()) - ms(wip.fecha)) / 36e5 : Infinity, viejo = edad > HORAS[vig];

  // una fila por pieza sin carton o Pallet ID, y una por pallet que no llega a 9 (faltan seriales) o tiene un carton repetido
  const filas = items.flatMap((it) => [
    ...it.piezas.filter((p) => !lista(p)).map((p) => ({ dn: it.dn, p, falta: [!p.carton && 'Carton ID', !p.pallet && 'Pallet ID'].filter(Boolean).join(' y '), w: wip?.m.get((p.sn || p.serial).toUpperCase()) ?? wip?.m.get(p.serial.toUpperCase()) })),
    ...pendientes(it).filter((g) => g.pallet && g.piezas.every(lista)).map((g) => ({ dn: it.dn, p: null, falta: `${g.pallet}: ${problema(g)}`, w: undefined })),
  ]);
  const vis = filas.filter((f) => (!dn || f.dn === dn) && (!q || `${f.dn} ${f.p?.serial} ${f.p?.sn} ${f.w?.p.station}`.toLowerCase().includes(q.trim().toLowerCase())));
  const cuenta = (t?: EnWip['tipo']) => filas.filter((f) => f.p && (t ? f.w?.tipo === t : !f.w)).length;

  return (
    <>
      <PageHead title="Conexión con WIP" sub="Piezas pendientes o faltantes de cada DN y dónde están en línea, según el WIP cargado." />
      <section className="yc-card yc-pad app-cx-wip" aria-label="WIP usado">
        {!file ? (
          <p className="app-muted"><Badge tone="warn">Sin WIP</Badge> Carga el reporte WIP en <Link to="/wip/carga">WIP → Carga de datos</Link> para ver el estado en línea.</p>
        ) : wip?.missing.length ? (
          <p className="app-muted"><Badge tone="bad">WIP</Badge> El WIP cargado no se puede leer: faltan las columnas {wip.missing.join(', ')}.</p>
        ) : (
          <div role="status">
            <p className="app-h3">{!wip?.fecha ? <Badge tone="warn">Sin fecha</Badge> : viejo ? <Badge tone="warn">Desactualizado</Badge> : <Badge tone="ok">Actualizado</Badge>} WIP del {wip?.fecha.slice(0, 16) || '—'}</p>
            <p className="app-muted">{file.name} · {!wip?.fecha ? 'no trae fecha: no se sabe si está actualizado. ' : viejo ? `tiene ${hace(edad)}, más de ${NOMBRE[vig]}: la información puede no ser la actual. Carga un WIP nuevo en ` : `de hace ${hace(edad)}. `}{viejo && <Link to="/wip/carga">WIP → Carga de datos</Link>}</p>
          </div>
        )}
        <Segmented label="Vigencia del WIP" value={vig} onChange={setVig} options={[{ value: 'hora', label: 'Hora' }, { value: 'dia', label: 'Día' }, { value: 'semana', label: 'Semana' }, { value: 'mes', label: 'Mes' }]} />
      </section>

      {!items.length ? <p className="yc-card app-empty">Aún no hay items. Crea uno con <Link to="/pallets/carga">Nuevo Pallet / Shipping Order</Link>.</p> : !filas.length ? (
        <p className="yc-card app-empty">Todas las piezas tienen carton y Pallet ID. No hay pendientes.</p>
      ) : (
        <>
          <ul className="app-cx-sum" aria-label="Resumen">
            <li><b>{filas.filter((f) => f.p).length}</b> pendientes</li>
            <li><b>{filas.filter((f) => !f.p).length}</b> pallets por completar</li>
            {wip && <><li><b>{cuenta('linea')}</b> en línea</li><li><b>{cuenta('empaque')}</b> en empaque</li><li><b>{cuenta('terminada')}</b> terminadas</li><li><b>{cuenta()}</b> no están en el WIP</li></>}
          </ul>
          <section className="yc-card app-wip-filters app-cx-filters" aria-label="Filtros">
            <Select label="DN" value={dn} onChange={setDn} options={[{ value: '', label: `Todos (${new Set(filas.map((f) => f.dn)).size})` }, ...[...new Set(filas.map((f) => f.dn))].map((d) => ({ value: d, label: d }))]} />
            <label className="yc-field">Buscar<input className="yc-input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Serial, SN, estación…" /></label>
          </section>
          <div className="yc-table-wrap">
            <table className="yc-table">
              <thead><tr><th>DN</th><th>Serial</th><th>SN</th><th>Falta</th><th>Estado en línea</th><th>Estación</th><th className="num">Tiempo ahí</th></tr></thead>
              <tbody>{vis.map((f, i) => (
                <tr key={`${f.dn}-${f.p?.serial ?? i}`} className={f.p ? '' : 'is-falta'}>
                  <td className="code">{f.dn}</td><td className="code">{f.p?.serial ?? '—'}</td><td className="code">{f.p?.sn || '—'}</td>
                  <td>{f.p ? f.falta : <Badge tone="bad">{f.falta}</Badge>}</td>
                  <td>{!f.p ? '—' : !wip ? <span className="app-muted">Sin WIP</span> : f.w ? <Badge tone={f.w.p.estado === 'Línea' ? TONO[f.w.tipo] : 'bad'}>{f.w.tipo === 'linea' ? f.w.p.estado : f.w.tipo === 'empaque' ? 'Empaque' : 'Terminada'}</Badge> : <Badge tone="neutral">No está en el WIP</Badge>}</td>
                  <td className="code">{f.w ? `${f.w.p.station}${f.w.p.section ? ` · ${f.w.p.section}` : ''}` : '—'}</td>
                  <td className="num">{f.w ? hace(f.w.p.hours) : '—'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
