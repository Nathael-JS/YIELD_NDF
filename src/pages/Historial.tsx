import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, HistoryList } from '../components/ui.tsx';
import { loadSummary } from '../lib/db.ts';
import { fromDb } from '../lib/tcqs.ts';
import { shortDate, useApp } from '../store.ts';
import { PageHead } from './Layout.tsx';
import { download } from '../lib/download.ts';

export default function Historial() {
  const { history, setFile } = useApp();
  const go = useNavigate();
  const [msg, setMsg] = useState<string>();
  // el histórico de Neon entra como si fuera un TCQS: todas las pantallas lo leen igual
  const loadDb = async () => {
    setMsg('Cargando…');
    try {
      const rows = await loadSummary();
      if (!rows.length) return setMsg('La base todavía no tiene datos: guárdalos desde Validación.');
      setFile('TCQS', { ...fromDb(rows), name: `Neon · histórico (${rows.length} filas)`, loadedAt: shortDate(new Date()) });
      go('/yield');
    } catch (e) {
      setMsg(`No se pudo leer la base: ${e instanceof Error ? e.message : e}`);
    }
  };
  const backup = () => download(`yield-control-respaldo-${new Date().toISOString().slice(0, 10)}.json`, new Blob([JSON.stringify(history, null, 2)], { type: 'application/json' }));
  return (
    <>
      <PageHead title="Historial" sub="Archivos cargados en este equipo. El último de cada tipo queda guardado hasta que salgas; el respaldo descarga la lista en JSON." />
      <HistoryList items={history} onBackup={backup} onCompare={() => go('/carga')} />
      <section className="yc-card yc-pad app-db">
        <div>
          <h2 className="app-h3">Base de datos (Neon)</h2>
          <p className="app-muted">Resumen por día × modelo × estación de todo lo guardado desde Validación. Sirve para ver semanas y meses sin volver a cargar archivos.</p>
          {msg && <p className="app-muted" role="status"><Badge tone="info">Neon</Badge> {msg}</p>}
        </div>
        <Button variant="primary" onClick={loadDb}>Cargar histórico</Button>
      </section>
    </>
  );
}
