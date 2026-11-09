import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, HistoryList, type HistoryItem } from '../components/ui.tsx';
import { loadCargas, loadSummary, type Carga } from '../lib/db.ts';
import { fromDb, pctText, shortDay } from '../lib/tcqs.ts';
import { shortDate, useApp } from '../store.ts';
import { PageHead } from './Layout.tsx';

type Row = HistoryItem & { carga: Carga };
const when = (iso: string) => shortDate(new Date(iso));

/** Historial de lo cargado, leído de Neon y agrupado por sesión (cada inicio de sesión es una). */
export default function Historial() {
  const setFile = useApp((s) => s.setFile), session = useApp((s) => s.session);
  const go = useNavigate();
  const [cargas, setCargas] = useState<Carga[]>();
  const [msg, setMsg] = useState<string>();
  useEffect(() => { loadCargas().then(setCargas).catch((e) => setMsg(`No se pudo leer la base: ${e.message}`)); }, []);

  // lo leído de Neon entra como si fuera un TCQS: todas las pantallas lo leen igual
  const open = async (desde?: string, hasta?: string, label = 'todo el histórico') => {
    setMsg('Cargando…');
    try {
      const rows = await loadSummary(desde, hasta);
      if (!rows.length) return setMsg('No hay datos guardados para ese rango.');
      setFile('TCQS', { ...fromDb(rows), name: `Base · ${label}`, loadedAt: shortDate(new Date()) });
      go('/yield');
    } catch (e) {
      setMsg(`No se pudo leer la base: ${e instanceof Error ? e.message : e}`);
    }
  };

  const sessions = new Map<string, Carga[]>();
  for (const c of cargas ?? []) (sessions.get(c.sesion) ?? sessions.set(c.sesion, []).get(c.sesion)!).push(c);
  return (
    <>
      <PageHead title="Historial" sub="Todo lo cargado y guardado en la base, por sesión. Cada carga se abre en Yield con su rango de fechas.">
        <Button variant="primary" onClick={() => open()} disabled={!cargas?.length}>Ver todo el histórico</Button>
      </PageHead>
      {msg && <p className="app-muted" role="status"><Badge tone="info">Base</Badge> {msg}</p>}
      {cargas && !cargas.length && <p className="yc-card app-empty">Todavía no hay cargas guardadas. Se guardan solas al cargar el TCQS y el Excel de modelos.</p>}
      {[...sessions].map(([id, list]) => (
        <HistoryList<Row>
          key={id}
          title={`${id === session ? 'Esta sesión' : 'Sesión'} · ${when(list.at(-1)!.guardado_en)} · ${list[0].usuario}`}
          action="Abrir"
          items={list.map((c) => ({
            carga: c, type: 'TCQS', name: c.archivo, date: when(c.guardado_en),
            period: `${shortDay(c.desde)} – ${shortDay(c.hasta)} · ${c.entradas.toLocaleString('es-MX')} entradas · FPY ${pctText((c.primer_pase / c.entradas) * 100)} %`,
          }))}
          onCompare={({ carga: c }) => open(c.desde, c.hasta, `${c.archivo} (${shortDay(c.desde)} – ${shortDay(c.hasta)})`)}
        />
      ))}
    </>
  );
}
