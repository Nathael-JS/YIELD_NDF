// Base de datos · Estructura de flujo del WIP: el reporte de yield de producción (solo Process Stage, Board, Model y Station).
// Se guarda en la base para todos; el Dashboard de WIP ubica cada estación con ella.
import { useEffect, useState } from 'react';
import { Badge, FileChip, type Tone } from '../../components/ui.tsx';
import { loadWipFlujo, saveWipFlujo, type WipFlujo } from '../../lib/db.ts';
import { parseFile } from '../../lib/files.ts';
import { readFlujo, type Paso } from '../../lib/wip.ts';
import { shortDate } from '../../store.ts';

/** Etapa → boards → estaciones (sin repetir), en el orden del archivo. */
const arbol = (pasos: Paso[]) => {
  const m = new Map<string, Map<string, Set<string>>>();
  for (const p of pasos) {
    const b = m.get(p.stage) ?? m.set(p.stage, new Map()).get(p.stage)!;
    (b.get(p.board) ?? b.set(p.board, new Set()).get(p.board)!).add(p.station);
  }
  return [...m].map(([stage, bs]) => ({ stage, boards: [...bs].map(([board, st]) => ({ board, estaciones: [...st] })) }));
};

export default function FlujoWip() {
  const [f, setF] = useState<WipFlujo>(), [busy, setBusy] = useState(false), [msg, setMsg] = useState<[Tone, string]>();
  useEffect(() => { loadWipFlujo().then(setF, (e) => setMsg(['warn', `Sin conexión con la base: ${e.message}`])); }, []);
  async function cargar(file: File) {
    setBusy(true); setMsg(undefined);
    try {
      const r = readFlujo(await parseFile(file));
      if (r.error) return setMsg(['bad', `${file.name}: ${r.error}`]);
      await saveWipFlujo(file.name, r.pasos);
      setF(await loadWipFlujo());
      setMsg(['ok', `${file.name}: ${r.pasos.length} estaciones guardadas en la base para todos.`]);
    } catch (e) { setMsg(['bad', `${file.name}: ${(e as Error).message}`]); } finally { setBusy(false); }
  }
  const a = arbol(f?.pasos ?? []);
  return (
    <section className="yc-card yc-pad app-sec" aria-labelledby="flujo-t">
      <h2 id="flujo-t" className="app-h3">Estructura de flujo · WIP</h2>
      <p className="app-muted">El reporte de yield de producción (.csv o .xlsx). Solo se usan sus columnas Process Stage, Board Name, Model y Station; con ellas el Dashboard de WIP ubica cada estación. Solo un administrador la cambia.</p>
      <FileChip type="FLUJO · WIP" accept=".csv,.xlsx" onFile={cargar} status={busy ? 'comparing' : f?.pasos.length ? 'loaded' : 'empty'}
        meta={busy ? 'Leyendo…' : f?.pasos.length ? `${f.pasos.length} estaciones · ${a.length} etapas · ${f.archivo} · ${f.usuario} · ${shortDate(new Date(f.guardado_en!))}` : 'Sin estructura: el Dashboard agrupa solo por estación'} />
      {msg && <p className="app-muted" role="status"><Badge tone={msg[0]}>Flujo</Badge> {msg[1]}</p>}
      {!!a.length && (
        <ol className="app-flujo" aria-label="Etapas">
          {a.map((s) => (
            <li key={s.stage}>
              <b>{s.stage}</b>
              {s.boards.map((b) => <span key={b.board} className="app-flujo-b" title={b.estaciones.join(' → ')}>{b.board || '—'} <span className="app-muted">{b.estaciones.length}</span></span>)}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
