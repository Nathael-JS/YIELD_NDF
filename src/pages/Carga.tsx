import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, FileChip } from '../components/ui.tsx';
import { parseFile } from '../lib/files.ts';
import { local } from '../lib/wip.ts';
import { shortDate, useApp, type FileType } from '../store.ts';
import { PageHead } from './Layout.tsx';

const plural = (n: number, w: string) => `${n.toLocaleString('es-MX')} ${w}${n === 1 ? '' : 's'}`;
const SLOTS: { type: FileType; label: string; accept: string; hint: string }[] = [
  { type: 'TCQS', label: 'TCQS', accept: '.csv,.xlsx', hint: 'Yield por orden, modelo y estación (.csv o .xlsx)' },
  { type: 'FALLAS', label: 'PRIMERAS FALLAS', accept: '.csv,.xlsx', hint: 'FirstFail por unidad con su código de error (.csv o .xlsx): para NDF' },
  { type: 'WIP', label: 'WIP', accept: '.xlsx,.csv', hint: 'Reporte WIP del MES por pieza, general o de una orden (.xlsx): dónde está cada una y desde hace cuánto' },
];

function Slot({ type, label, accept, hint }: (typeof SLOTS)[number]) {
  const f = useApp((s) => s.files[type]), err = useApp((s) => s.errors[type]);
  const setFile = useApp((s) => s.setFile), setError = useApp((s) => s.setError), removeFile = useApp((s) => s.removeFile);
  const pick = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function load(file: File) {
    setBusy(true);
    try {
      setFile(type, { ...(await parseFile(file)), name: file.name, loadedAt: shortDate(new Date()), cargado: local() });
    } catch (e) {
      setError(type, `${file.name}: ${e instanceof Error ? e.message : 'no se pudo leer'}`);
    } finally {
      setBusy(false);
    }
  }
  const detail = f && plural(f.rows.length, 'fila');
  return (
    <div className="app-slot">
      <FileChip type={label} accept={accept} onFile={load}
        status={err ? 'error' : busy ? 'comparing' : f ? 'loaded' : 'empty'}
        meta={err ?? (busy ? 'Leyendo…' : f ? `${f.name} · ${detail}` : hint)} />
      {(f || err) && (
        <div className="yc-row">
          <input ref={pick} type="file" hidden accept={accept} onChange={(e) => { const x = e.target.files?.[0]; e.target.value = ''; if (x) load(x); }} />
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
  const go = useNavigate();
  return (
    <>
      <PageHead title="Carga de datos" sub="Los archivos se leen en este equipo. El resumen del TCQS por día × modelo × estación se guarda solo en la base, con los modelos de Juliet que se actualizan en Base de datos." />
      <section className="app-files app-files-lg" aria-label="Archivos">
        {SLOTS.map((s) => <Slot key={s.type} {...s} />)}
      </section>
      <div className="yc-row">
        <Button variant="primary" disabled={!files.TCQS && !files.WIP} onClick={() => go('/validacion')}>Validar datos</Button>
        <span className="app-muted">{files.TCQS || files.WIP ? (modelos ? 'Listo para validar: cada archivo se valida por separado.' : 'Sin lista de modelos se usan todos los modelos.') : 'Carga el TCQS o el WIP para continuar.'}</span>
      </div>
    </>
  );
}
