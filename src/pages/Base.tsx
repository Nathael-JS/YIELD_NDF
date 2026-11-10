import { useEffect, useState, type FormEvent } from 'react';
import { Badge, Button, FileChip, HistoryList, KpiTile, Select, type HistoryItem } from '../components/ui.tsx';
import { baseAccion, loadBase, loadCargas, loadSummary, respaldoAccion, saveModelos, type Carga, type EstadoBase } from '../lib/db.ts';
import { parseFile } from '../lib/files.ts';
import { download } from '../lib/download.ts';
import { dropAll } from '../lib/saved.ts';
import { modelsFrom, shortDay } from '../lib/tcqs.ts';
import { shortDate, useApp } from '../store.ts';
import { PageHead } from './Layout.tsx';

const size = (b: number) => (b < 1024 ** 2 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1024 ** 2).toFixed(1)} MB`);
const NEON_FREE = 512 * 1024 ** 2; // espacio del plan gratis de Neon
type Row = HistoryItem & { carga: Carga };

/** Estado y limpieza de la base de datos y de los archivos guardados en este equipo. Borrar: solo super administrador. */
export default function Base() {
  const principal = useApp((s) => s.cuenta.principal), files = useApp((s) => s.files), modelos = useApp((s) => s.modelos);
  const [busy, setBusy] = useState(false);
  const [st, setSt] = useState<EstadoBase>();
  const [cargas, setCargas] = useState<Carga[]>([]);
  const [msg, setMsg] = useState<['ok' | 'bad', string]>();
  const reload = () => Promise.all([loadBase().then(setSt), loadCargas().then(setCargas)]).catch((e) => setMsg(['bad', e.message]));
  useEffect(() => { reload(); }, []);
  const act = (a: Parameters<typeof baseAccion>[0], what: string) => {
    if (!confirm(`¿${what}?`)) return;
    baseAccion(a).then((r) => { setMsg(['ok', `${what}: ${r.borradas} filas borradas.`]); reload(); }).catch((e) => setMsg(['bad', e.message]));
  };
  const exportCsv = async () => {
    const rows = await loadSummary();
    const head = 'fecha,modelo,estacion,entradas,primer_pase,primera_falla,segundo_pase';
    download(`yield-resumen-${new Date().toISOString().slice(0, 10)}.csv`, new Blob([[head, ...rows.map((r) => [r.fecha, r.modelo, r.estacion, r.entradas, r.primer_pase, r.primera_falla, r.segundo_pase].join(','))].join('\n')], { type: 'text/csv' }));
  };
  const range = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget), desde = String(f.get('desde')), hasta = String(f.get('hasta'));
    act({ accion: 'borrarRango', desde, hasta }, `Borrar el resumen del ${desde} al ${hasta} (queda un respaldo de 7 días en Historial)`);
  };
  // el Excel del BOM se lee aquí; a la base solo va la lista de números de modelo
  const uploadBom = async (file: File) => {
    setBusy(true);
    try {
      const list = modelsFrom(await parseFile(file));
      if (!list.length) throw new Error('no trae números de modelo');
      const r = await saveModelos(file.name, list);
      await useApp.getState().reloadModelos();
      setMsg(['ok', `${file.name}: ${r.guardados} modelos de Juliet guardados en la base para todos.`]); reload();
    } catch (e) {
      setMsg(['bad', `${file.name}: ${e instanceof Error ? e.message : 'no se pudo leer'}`]);
    } finally { setBusy(false); }
  };
  const t = (name: string) => st?.tablas.find((x) => x.tabla === name);
  const local = Object.values(files).filter(Boolean);
  return (
    <>
      <PageHead title="Base de datos" sub="Espacio, contenido y limpieza de la base (PostgreSQL) y de lo guardado en este equipo.">
        <Button onClick={exportCsv}>Exportar resumen (CSV)</Button>
      </PageHead>
      {msg && <p className="app-muted" role={msg[0] === 'bad' ? 'alert' : 'status'}><Badge tone={msg[0]}>{msg[0] === 'ok' ? 'Listo' : 'Error'}</Badge> {msg[1]}</p>}
      {st && (
        <div className="yc-grid-kpi">
          <KpiTile label="Espacio usado" value={size(st.bytes)} />
          <KpiTile label="Del plan gratis de Neon (512 MB)" value={((st.bytes / NEON_FREE) * 100).toFixed(1)} unit="%" />
          <KpiTile label="Resumen día × modelo × estación" value={st.resumen.filas.toLocaleString('es-MX')} />
          <KpiTile label="Cargas registradas" value={(t('yield_cargas')?.filas ?? 0).toLocaleString('es-MX')} />
        </div>
      )}
      {st && (
        <div className="yc-table-wrap">
          <table className="yc-table">
            <thead><tr><th>Tabla</th><th>Qué guarda</th><th className="num">Filas</th><th className="num">Espacio</th></tr></thead>
            <tbody>
              {[['yield_resumen', `Conteos por día × modelo × estación${st.resumen.desde ? ` · ${shortDay(st.resumen.desde)} – ${shortDay(st.resumen.hasta!)}` : ''}`], ['yield_cargas', 'Una fila por carga (historial)'], ['yield_modelos', 'Modelos de Juliet (del BOM)'], ['yield_comentarios', 'Comentarios de las gráficas'], ['usuarios', 'Cuentas']].map(([n, what]) => (
                <tr key={n}><td className="code">{n}</td><td>{what}</td><td className="num">{(t(n)?.filas ?? 0).toLocaleString('es-MX')}</td><td className="num">{size(t(n)?.bytes ?? 0)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <section className="yc-card yc-pad app-sec">
        <h2 className="app-h3">Modelos de Juliet</h2>
        <p className="app-muted">La lista filtra el TCQS de todos los usuarios. Sube el Excel del build con el BOM para reemplazarla.</p>
        <FileChip type="MODELOS · JULIET" accept=".xlsx" onFile={uploadBom} status={busy ? 'comparing' : modelos ? 'loaded' : 'empty'}
          meta={busy ? 'Leyendo…' : modelos ? `${modelos.modelos.length.toLocaleString('es-MX')} modelos · ${modelos.archivo} · ${modelos.usuario} · ${shortDate(new Date(modelos.guardado_en!))}` : 'Sin lista: se usan todos los modelos del TCQS'} />
      </section>
      {principal && (
        <section className="yc-card yc-pad app-sec">
          <h2 className="app-h3">Limpieza <Badge tone="warn">Super administrador</Badge></h2>
          <form className="app-form app-form-row" onSubmit={range}>
            <label className="yc-field">Desde<input className="yc-input" name="desde" type="date" required /></label>
            <label className="yc-field">Hasta<input className="yc-input" name="hasta" type="date" required /></label>
            <Button type="submit">Borrar resumen de ese rango</Button>
          </form>
          <div className="app-form-row">
            <Select label="Conservar el historial de cargas" value="" onChange={(d) => d && act({ accion: 'retener', dias: Number(d) }, `Borrar cargas de hace más de ${d} días`)}
              options={[{ value: '', label: 'Elegir…' }, { value: '90', label: 'Últimos 90 días' }, { value: '180', label: 'Últimos 180 días' }, { value: '365', label: 'Último año' }]} />
          </div>
        </section>
      )}
      <HistoryList<Row>
        title="Historial de cargas"
        action={principal ? 'Borrar' : 'Ver'}
        items={cargas.map((c) => ({ carga: c, type: 'TCQS', name: c.archivo, date: shortDate(new Date(c.guardado_en)), period: `${c.usuario} · ${shortDay(c.desde)} – ${shortDay(c.hasta)} · ${c.filas} filas` }))}
        onCompare={({ carga: c }) => {
          if (!principal) return setMsg(['ok', `${c.archivo}: ábrela desde Historial.`]);
          // igual que en Historial: antes de borrar se crea un respaldo automático de 7 días
          if (confirm(`¿Borrar del historial la carga ${c.archivo} y sus datos? Se crea un respaldo automático que dura 7 días.`))
            respaldoAccion({ accion: 'borrar', carga: c.id }).then(() => { setMsg(['ok', `${c.archivo} borrada; su respaldo está en Historial (7 días).`]); reload(); }).catch((e) => setMsg(['bad', e.message]));
        }}
      />
      <section className="yc-card yc-pad app-sec">
        <h2 className="app-h3">En este equipo</h2>
        <p className="app-muted">{local.length ? local.map((f) => `${f!.name} (${f!.rows.length.toLocaleString('es-MX')} filas)`).join(' · ') : 'No hay archivos guardados.'} Se borran solos al salir.</p>
        <Button disabled={!local.length} onClick={() => { dropAll().catch(() => {}); useApp.setState({ files: {}, savedKey: '' }); setMsg(['ok', 'Archivos de este equipo borrados.']); }}>Borrar archivos de este equipo</Button>
      </section>
    </>
  );
}
