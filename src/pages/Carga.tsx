import { useState, type DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, FileChip, PeriodTabs } from '../components/ui.tsx';
import { parseFile } from '../lib/files.ts';
import { FILE_TYPES, shortDate, useApp, type FileType } from '../store.ts';
import { PageHead } from './Layout.tsx';

const plural = (n: number, w: string) => `${n.toLocaleString('es-MX')} ${w}${n === 1 ? '' : 's'}`;

function Drop({ type }: { type: FileType }) {
  const { files, errors, setFile, setError } = useApp();
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const f = files[type], err = errors[type];

  async function load(file?: File) {
    if (!file) return;
    setBusy(true);
    try {
      setFile(type, { ...(await parseFile(file)), name: file.name, loadedAt: shortDate(new Date()) });
    } catch (e) {
      setError(type, `${file.name}: ${e instanceof Error ? e.message : 'no se pudo leer'}`);
    } finally {
      setBusy(false);
    }
  }
  const drop = (e: DragEvent) => { e.preventDefault(); setOver(false); load(e.dataTransfer.files[0]); };

  return (
    <label className={`app-drop${over ? ' is-over' : ''}`} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={drop}>
      <input type="file" accept=".xlsx,.csv,.txt" className="app-visually-hidden" onChange={(e) => { load(e.target.files?.[0]); e.target.value = ''; }} />
      <FileChip
        type={type}
        status={err ? 'error' : busy ? 'comparing' : f ? 'loaded' : 'empty'}
        meta={err ?? (busy ? 'Leyendo…' : f ? `${f.name} · ${plural(f.rows.length, 'fila')} · ${plural(f.headers.length, 'columna')}` : undefined)}
      />
    </label>
  );
}

export default function Carga() {
  const { period, setPeriod, files } = useApp();
  const go = useNavigate();
  const loaded = FILE_TYPES.filter((t) => files[t]).length;
  return (
    <>
      <PageHead title="Carga de datos" sub="Carga los tres archivos del mismo periodo (.xlsx o .csv). Se leen en este equipo; no se envían a ningún servidor.">
        <PeriodTabs value={period} onChange={setPeriod} />
      </PageHead>
      <section className="app-files app-files-lg" aria-label="Archivos">
        {FILE_TYPES.map((t) => <Drop key={t} type={t} />)}
      </section>
      <div className="yc-row">
        <Button variant="primary" disabled={loaded < 2} onClick={() => go('/comparacion')}>Comparar archivos</Button>
        <span className="app-muted">{loaded < 2 ? 'Carga al menos dos archivos para comparar.' : `${loaded} de 3 archivos cargados.`}</span>
      </div>
    </>
  );
}
