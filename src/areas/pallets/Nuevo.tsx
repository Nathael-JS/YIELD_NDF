// Carga · Pallets: «Nuevo Pallet / Shipping Order» pide el export de SFC y crea un item por DN.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, FileChip, type Tone } from '../../components/ui.tsx';
import { parseFile } from '../../lib/files.ts';
import { excedidos, grupos, plantilla, POR_PALLET, readSfc } from '../../lib/sfc.ts';
import { local } from '../../lib/wip.ts';
import { useApp } from '../../store.ts';
import { usePallets } from './items.ts';

export default function NuevoPallet() {
  const user = useApp((s) => s.user) ?? '', { items, upsert, sync, push, db } = usePallets();
  useEffect(() => { sync(); }, [sync]); // lo escrito a mano en otro equipo se conserva al volver a cargar un DN
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState<[Tone, string, string[]?]>();

  async function load(file: File) {
    setBusy(true); setMsg(undefined);
    try {
      const r = readSfc(await parseFile(file));
      if (r.missing.length) return setMsg(['bad', `${file.name} no parece un export de SFC: faltan las columnas ${r.missing.join(', ')}.`]);
      if (!r.items.length) return setMsg(['warn', `${file.name} no trae seriales con DN.`]);
      const ahora = local(), ya = new Set(items.map((x) => x.dn));
      upsert(r.items.map((x) => ({ ...x, ...plantilla(x.pnSfc, items), so: '', shipped: '', custPo: '', custDn: '', archivo: file.name, usuario: user, creado: ahora })));
      push(r.items.map((x) => x.dn));
      const nuevos = r.items.filter((x) => !ya.has(x.dn)).length, pallets = r.items.reduce((n, x) => n + grupos(x).filter((g) => g.pallet).length, 0), exc = r.items.reduce((n, x) => n + excedidos(x).length, 0);
      setMsg(['ok', `${nuevos} ${nuevos === 1 ? 'item nuevo' : 'items nuevos'}${r.items.length - nuevos ? ` y ${r.items.length - nuevos} actualizados (lo escrito a mano se conserva)` : ''}.`,
        [`${pallets} ${pallets === 1 ? 'pallet' : 'pallets'} en grupos de hasta ${POR_PALLET}.`, exc ? `${exc} ${exc === 1 ? 'pallet' : 'pallets'} con más de ${POR_PALLET} piezas: revísalos al ampliar el item.` : '', r.repetidos ? `${r.repetidos} ${r.repetidos === 1 ? 'serial repetido se contó' : 'seriales repetidos se contaron'} una vez.` : ''].filter(Boolean)]);
    } catch (e) {
      setMsg(['bad', `${file.name}: ${e instanceof Error ? e.message : 'no se pudo leer'}`]);
    } finally { setBusy(false); }
  }

  return (
    <section className="yc-card yc-pad app-new" aria-label="Nuevo Pallet / Shipping Order">
      <div>
        <h2 className="app-h3">Nuevo Pallet / Shipping Order</h2>
        <p className="app-muted">Carga el export de SFC: cada DN del archivo crea un item con sus seriales, cartons y Pallet ID. Un DN que ya existe se actualiza.</p>
      </div>
      <FileChip type="SFC" accept=".xlsx,.csv" onFile={load} status={busy ? 'comparing' : msg?.[0] === 'bad' ? 'error' : msg ? 'loaded' : 'empty'}
        meta={busy ? 'Leyendo…' : 'Export de SFC (.xlsx o .csv), una fila por serial'} />
      {db && <p className="app-muted" role="status"><Badge tone={db[0]}>Base</Badge> {db[1]}</p>}
      {msg && (
        <div role="status" className="app-new-msg">
          <p className="app-muted"><Badge tone={msg[0]}>{msg[0] === 'ok' ? 'Listo' : 'Aviso'}</Badge> {msg[1]} {msg[0] === 'ok' && <Link to="/pallets">Ver pallets</Link>}</p>
          {msg[2]?.map((x) => <p key={x} className="app-muted">{x}</p>)}
        </div>
      )}
    </section>
  );
}
