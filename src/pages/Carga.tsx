import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, FileChip } from '../components/ui.tsx';
import { parseFile } from '../lib/files.ts';
import { modelsFrom } from '../lib/tcqs.ts';
import { shortDate, useApp, type FileType } from '../store.ts';
import { PageHead } from './Layout.tsx';

const plural = (n: number, w: string) => `${n.toLocaleString('es-MX')} ${w}${n === 1 ? '' : 's'}`;
const SLOTS: { type: FileType; label: string; accept: string; hint: string }[] = [
  { type: 'TCQS', label: 'TCQS', accept: '.csv,.xlsx', hint: 'Yield por orden, modelo y estación (.csv o .xlsx)' },
  { type: 'MODELOS', label: 'MODELOS · JULIET', accept: '.xlsx', hint: 'Excel del build con el BOM: define qué modelos son del proyecto' },
];

function Slot({ type, label, accept, hint }: (typeof SLOTS)[number]) {
  const f = useApp((s) => s.files[type]), err = useApp((s) => s.errors[type]);
  const setFile = useApp((s) => s.setFile), setError = useApp((s) => s.setError);
  const [busy, setBusy] = useState(false);

  async function load(file: File) {
    setBusy(true);
    try {
      setFile(type, { ...(await parseFile(file)), name: file.name, loadedAt: shortDate(new Date()) });
    } catch (e) {
      setError(type, `${file.name}: ${e instanceof Error ? e.message : 'no se pudo leer'}`);
    } finally {
      setBusy(false);
    }
  }
  const detail = f && (type === 'MODELOS' ? plural(modelsFrom(f).length, 'modelo') : plural(f.rows.length, 'fila'));
  return (
    <FileChip type={label} accept={accept} onFile={load}
      status={err ? 'error' : busy ? 'comparing' : f ? 'loaded' : 'empty'}
      meta={err ?? (busy ? 'Leyendo…' : f ? `${f.name} · ${detail}` : hint)} />
  );
}

export default function Carga() {
  const files = useApp((s) => s.files);
  const go = useNavigate();
  return (
    <>
      <PageHead title="Carga de datos" sub="Los archivos se leen en este equipo. Con el TCQS y el BOM cargados, el resumen por día × modelo × estación se guarda solo en Neon." />
      <section className="app-files app-files-lg" aria-label="Archivos">
        {SLOTS.map((s) => <Slot key={s.type} {...s} />)}
      </section>
      <div className="yc-row">
        <Button variant="primary" disabled={!files.TCQS} onClick={() => go('/validacion')}>Validar datos</Button>
        <span className="app-muted">{files.TCQS ? (files.MODELOS ? 'Listo para validar.' : 'Sin el Excel de modelos se usan todos los modelos del TCQS.') : 'Carga el TCQS para continuar.'}</span>
      </div>
      <section aria-label="Pendientes">
        <h2 className="app-h3">Pendientes</h2>
        <div className="app-files">
          <FileChip type="DATA ANALYSIS" meta="Pendiente · se cruzará por serial + estación" />
          <FileChip type="QM" meta="Pendiente · se cruzará por serial + estación" />
        </div>
      </section>
    </>
  );
}
