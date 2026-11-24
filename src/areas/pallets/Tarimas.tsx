// Todas las tarimas, por fecha y hora de subida: las de la base (de todos los equipos) y las que solo están en este equipo.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Select } from '../../components/ui.tsx';
import { loadTarimasDb, type TarimaDb } from '../../lib/db.ts';
import { download } from '../../lib/download.ts';
import { readTarimas, revisar, serialsOf, tarimasFile, toCsv, type Tarima } from '../../lib/pallets.ts';
import { local } from '../../lib/wip.ts';
import { useApp } from '../../store.ts';
import { PageHead } from '../../pages/Layout.tsx';

type Fila = { t: Tarima; cuando: string; usuario: string; donde: 'base' | 'equipo' };

export default function Tarimas() {
  const file = useApp((s) => s.files.TARIMAS);
  const [db, setDb] = useState<TarimaDb[]>(), [err, setErr] = useState<string>(), [dia, setDia] = useState(''), [q, setQ] = useState('');
  useEffect(() => { loadTarimasDb().then(setDb, (e) => { setErr(e.message); setDb([]); }); }, []);
  const filas = useMemo(() => {
    const deDb: Fila[] = (db ?? []).map((x) => ({ t: x.datos, cuando: local(new Date(x.creada)), usuario: x.usuario, donde: 'base' }));
    const soloAqui: Fila[] = (file ? readTarimas(file).tarimas : []).filter((t) => !deDb.some((x) => x.t.pallet === t.pallet))
      .map((t) => ({ t, cuando: t.creada, usuario: '', donde: 'equipo' }));
    return [...deDb, ...soloAqui].sort((a, b) => (a.cuando < b.cuando ? 1 : -1));
  }, [db, file]);
  const dias = [...new Set(filas.map((f) => f.cuando.slice(0, 10)))];
  const vis = filas.filter((f) => (!dia || f.cuando.startsWith(dia)) && (!q || `${f.t.pallet} ${f.t.dn} ${f.t.nvdn} ${f.t.so} ${f.t.ref} ${f.t.serials}`.toLowerCase().includes(q.toLowerCase())));
  const grupos = [...new Set(vis.map((f) => f.cuando.slice(0, 10)))];

  return (
    <>
      <PageHead title="Tarimas" sub="Todas las tarimas escaneadas o cargadas, por fecha y hora de subida.">
        <Button disabled={!vis.length} onClick={() => download(`tarimas-${dia || 'todas'}.csv`, new Blob([toCsv(tarimasFile(vis.map((f) => f.t)))], { type: 'text/csv' }))}>Exportar CSV ({vis.length})</Button>
      </PageHead>
      {err && <p className="app-muted" role="status"><Badge tone="warn">Base</Badge> Sin conexión con la base: {err} Se muestran las de este equipo.</p>}
      <section className="yc-card app-wip-filters app-tar-filters" aria-label="Filtros">
        <Select label="Día" value={dia} onChange={setDia} options={[{ value: '', label: `Todos (${dias.length})` }, ...dias.map((d) => ({ value: d, label: d || 'Sin fecha' }))]} />
        <label className="yc-field">Buscar<input className="yc-input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pallet #, DN, SO, serial…" /></label>
      </section>
      {!db ? <p className="app-muted">Cargando…</p> : !vis.length ? <p className="yc-card app-empty">{filas.length ? 'Ninguna tarima con estos filtros.' : <>Aún no hay tarimas. Arma una en <Link to="/pallets">Etiquetas</Link>.</>}</p> : grupos.map((g) => (
        <section key={g} className="yc-card app-tar-day" aria-label={`Tarimas del ${g || 'día sin fecha'}`}>
          <header><h2 className="app-h3">{g || 'Sin fecha'}</h2><span className="app-muted">{vis.filter((f) => f.cuando.startsWith(g)).length} tarimas</span></header>
          <div className="yc-table-wrap">
            <table className="yc-table">
              <thead><tr><th>Hora</th><th>Pallet #</th><th>DN</th><th>NVIDIA DN</th><th>SO</th><th className="num">Piezas</th><th>Estado</th><th>Subió</th><th /></tr></thead>
              <tbody>{vis.filter((f) => f.cuando.startsWith(g)).map(({ t, cuando, usuario, donde }) => {
                const listo = revisar(t, new Set()).listo;
                return (
                  <tr key={t.pallet}>
                    <td className="code">{cuando.slice(11, 16) || '—'}</td><td className="code">{t.pallet}</td><td className="code">{t.dn || '—'}</td><td className="code">{t.nvdn || '—'}</td><td className="code">{t.so || '—'}</td>
                    <td className="num">{serialsOf(t).length} / {t.qty || '—'}</td>
                    <td><span className="yc-row">{t.printed ? <Badge tone="info">Impresa</Badge> : listo ? <Badge tone="ok">Lista</Badge> : <Badge tone="warn">Incompleta</Badge>}{t.prueba && <Badge tone="warn">Prueba</Badge>}</span></td>
                    <td>{donde === 'base' ? usuario : <Badge tone="neutral">Solo en este equipo</Badge>}</td>
                    <td><Link className="yc-btn yc-btn-quiet" to={`/pallets?abrir=${encodeURIComponent(t.pallet)}`}>Abrir</Link></td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        </section>
      ))}
    </>
  );
}
