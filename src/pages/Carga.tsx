import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, FileChip, type Tone } from '../components/ui.tsx';
import { saveWipCorte } from '../lib/db.ts';
import { mergeParsed, parseFile } from '../lib/files.ts';
import { detalleWip, local, readWip, resumenWip } from '../lib/wip.ts';
import { shortDate, useApp, type FileType } from '../store.ts';
import { PageHead } from './Layout.tsx';
import { useArea } from '../areas.ts';
import NuevoPallet from '../areas/pallets/Nuevo.tsx';

const plural = (n: number, w: string) => `${n.toLocaleString('es-MX')} ${w}${n === 1 ? '' : 's'}`;
const SLOTS: { type: FileType; label: string; accept: string; hint: string; multiple?: boolean }[] = [
  { type: 'TCQS', label: 'TCQS', accept: '.csv,.xlsx', hint: 'Yield por orden, modelo y estación (.csv o .xlsx)' },
  { type: 'FALLAS', label: 'PRIMERAS FALLAS', accept: '.csv,.xlsx', hint: 'FirstFail por unidad con su código de error (.csv o .xlsx): para NDF' },
  { type: 'WIP', label: 'WIP', accept: '.xlsx,.csv', hint: 'Reporte WIP del MES por pieza, general o de una o varias órdenes (.xlsx): dónde está cada una y desde hace cuánto', multiple: true },
];

function Slot({ type, label, accept, hint, multiple }: (typeof SLOTS)[number]) {
  const f = useApp((s) => s.files[type]), err = useApp((s) => s.errors[type]);
  const setFile = useApp((s) => s.setFile), setError = useApp((s) => s.setError), removeFile = useApp((s) => s.removeFile);
  const pick = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false), [db, setDb] = useState<[Tone, string]>();

  // varios archivos del mismo reporte se unen en uno (los repetidos se quitan al leerlo: una pieza por serial, una entrega por DN)
  async function load(...fs: File[]) {
    setBusy(true);
    const name = fs.length > 1 ? `${fs.length} archivos: ${fs.map((x) => x.name).join(', ')}` : fs[0].name;
    try {
      const parts = await Promise.all(fs.map((x) => parseFile(x).catch((e) => { throw new Error(`${x.name}: ${e instanceof Error ? e.message : 'no se pudo leer'}`); })));
      const f = { ...(parts.length > 1 ? mergeParsed(parts) : parts[0]), name, loadedAt: shortDate(new Date()), cargado: local() };
      setFile(type, f);
      // el WIP se guarda en el historial (un resumen por estación × modelo, sin seriales); si falla, se sigue usando en el equipo
      if (type === 'WIP') {
        const r = readWip(f, f.cargado), corte = (r.corte || r.ultimo || f.cargado).slice(0, 16);
        setDb(undefined);
        if (!r.missing.length && corte) {
          setDb(['info', 'Guardando en el historial…']);
          saveWipCorte({ archivo: name.slice(0, 300), corte, piezas: r.piezas.length, terminadas: r.terminadas.length, resumen: resumenWip(r), detalle: detalleWip(r.piezas) })
            .then((x) => setDb(x.repetido ? ['neutral', `Este corte (${corte}) ya estaba en el historial.`] : ['ok', `Guardado en el historial: corte ${corte}, ${r.piezas.length} piezas en proceso.`]),
              (e) => setDb(['warn', `No se guardó en el historial: ${e.message}`]));
        }
      }
    } catch (e) {
      setError(type, e instanceof Error ? e.message : `${name}: no se pudo leer`);
    } finally {
      setBusy(false);
    }
  }
  const detail = f && plural(f.rows.length, 'fila');
  return (
    <div className="app-slot">
      <FileChip type={label} accept={accept} onFile={load} multiple={multiple}
        status={err ? 'error' : busy ? 'comparing' : f ? 'loaded' : 'empty'}
        meta={err ?? (busy ? 'Leyendo…' : f ? `${f.name} · ${detail}` : hint)} />
      {db && <p className="app-muted" role="status"><Badge tone={db[0]}>Historial</Badge> {db[1]}</p>}
      {(f || err) && (
        <div className="yc-row">
          <input ref={pick} type="file" hidden accept={accept} multiple={multiple} onChange={(e) => { const xs = [...(e.target.files ?? [])]; e.target.value = ''; if (xs.length) load(...xs); }} />
          <Button variant="quiet" onClick={() => pick.current?.click()}>Cambiar archivo</Button>
          {/* quita el archivo de la app; lo ya guardado en el historial se borra desde Historial */}
          <Button variant="quiet" onClick={() => confirm(`¿Quitar ${f?.name ?? 'el archivo'} de la carga? Lo guardado en el historial no se borra.`) && removeFile(type)}>Borrar archivo</Button>
        </div>
      )}
    </div>
  );
}

export default function Carga() {
  const files = useApp((s) => s.files), modelos = useApp((s) => s.modelos);
  const go = useNavigate(), area = useArea(), slots = SLOTS.filter((s) => area.files.includes(s.type)), alguno = slots.some((s) => files[s.type]);
  if (area.id === 'pallets') return <><PageHead title="Carga de datos · PALLETS" sub="Cada DN del export de SFC se vuelve un item en Pallets. Se guarda en este equipo hasta que cierres sesión (la base de Pallets está en pausa)." /><NuevoPallet /></>;
  return (
    <>
      <PageHead title={`Carga de datos · ${area.name}`} sub={area.id === 'yield' ? 'Los archivos se leen en este equipo. El resumen del TCQS por día × modelo × estación se guarda solo en la base, con los modelos de Juliet que se actualizan en Base de datos.' : 'Los archivos se leen en este equipo y se quedan guardados en él hasta que cierres sesión.'} />
      <section className="app-files app-files-lg" aria-label="Archivos">
        {slots.map((s) => <Slot key={s.type} {...s} />)}
      </section>
      <div className="yc-row">
        <Button variant="primary" disabled={!alguno} onClick={() => go(`/${area.id}/validacion`)}>Validar datos</Button>
        <span className="app-muted">{alguno ? (modelos || area.id === 'wip' ? 'Listo para validar.' : 'Sin lista de modelos se usan todos los modelos.') : `Carga ${slots.map((s) => s.label.toLowerCase()).join(' o ')} para continuar.`}</span>
      </div>
    </>
  );
}
