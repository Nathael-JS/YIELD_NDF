// Etiquetas (EN DESARROLLO, se rehace por Pallet ID desde los items): entregas del listado (DN) → tarima con sus seriales → etiqueta 4×6 in (QR con todo + Code128 del Pallet #).
// Las tarimas se guardan en la base (Pallet # único en toda la base) y, como respaldo sin conexión, en este equipo
// (el archivo TARIMAS: la misma tabla del CSV que se exporta y se vuelve a cargar).
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Badge, Button, Segmented, SerialInput } from '../../components/ui.tsx';
import { PalletLabel, qrPng, readQrImage, type LabelVariant } from '../../components/label.tsx';
import { loadTarimasDb, saveTarimaDb, type TarimaDb } from '../../lib/db.ts';
import { download } from '../../lib/download.ts';
import { defaultsFor, desdeEntrega, fromQr, labelOf, nueva, qrText, readEntregas, readTarimas, revisar, serialsOf, tarimasFile, toCsv, type Tarima, type TarimaKey } from '../../lib/pallets.ts';
import { local, readWip } from '../../lib/wip.ts';
import { shortDate, useApp } from '../../store.ts';
import { PageHead } from '../../pages/Layout.tsx';

/** de dónde sale cada campo: el listado de entregas, a mano (DN y NVIDIA DN; otro archivo aún por definir) o lo escribe quien arma la tarima */
type Campo = { key: TarimaKey; label: string; src?: 'listado' | 'mano'; mono?: boolean };
/** Las áreas del shipping report (quién llena cada campo); todas las casillas se ven aunque no haya archivo cargado. */
const AREAS: { id: string; name: string; hint: string; campos: Campo[] }[] = [
  { id: 'shipping', name: 'Shipping', hint: 'Solicitud, transporte y cierre', campos: [
    { key: 'ref', label: 'Internal Ref', mono: true }, { key: 'customer', label: 'Cliente', src: 'listado' }, { key: 'destination', label: 'Destino', src: 'listado' },
    { key: 'to', label: 'T/O', src: 'listado', mono: true }, { key: 'truckHour', label: 'Hora de solicitud de truck' }, { key: 'carrier', label: 'Carrier' },
    { key: 'plates', label: 'Truck # / placas' }, { key: 'hts', label: 'HTS code', mono: true },
  ] },
  { id: 'fulfillment', name: 'Fulfillment', hint: 'Orden, producto y cantidades', campos: [
    { key: 'dn', label: 'FXNN DN', src: 'mano', mono: true }, { key: 'nvdn', label: 'NVIDIA DN', src: 'mano', mono: true }, { key: 'so', label: 'FXNN SO', src: 'listado', mono: true },
    { key: 'po', label: 'PO del cliente', src: 'listado', mono: true }, { key: 'pn', label: 'Part number', src: 'listado', mono: true }, { key: 'qty', label: 'Piezas', src: 'listado' },
    { key: 'cartons', label: 'Cajas' }, { key: 'coo', label: 'COO' }, { key: 'battery', label: 'Nota de batería' }, { key: 'incoterm', label: 'Incoterm' },
  ] },
  { id: 'itc', name: 'ITC', hint: 'Tarima, medidas, pesos y sellos', campos: [
    { key: 'pallet', label: 'Pallet #', mono: true }, { key: 'dims', label: 'Medidas L x A x H (cm)' }, { key: 'nw', label: 'Peso neto (kg)', src: 'listado' },
    { key: 'gw', label: 'Peso bruto (kg)', src: 'listado' }, { key: 'seal', label: 'Sello Foxconn' }, { key: 'dock', label: 'Dock #' }, { key: 'shipDate', label: 'Fecha de envío' },
  ] },
];
const REQ = new Set<TarimaKey>(['pallet', 'ref', 'customer', 'destination', 'dn', 'nvdn', 'pn', 'qty', 'cartons', 'nw', 'gw', 'dims', 'hts', 'coo', 'shipDate']);
const VARIANTES = [{ value: 'qr' as const, label: 'QR grande' }, { value: 'text' as const, label: 'Más texto' }];
const SRC = { listado: 'del listado', mano: 'a mano' };
const abiertasDe = (x: Tarima) => new Set(AREAS.filter((a, n) => n < 2 || a.campos.some((c) => REQ.has(c.key) && !x[c.key].trim())).map((a) => a.id));

export default function Etiquetas() {
  const files = useApp((s) => s.files), setFile = useApp((s) => s.setFile);
  const dn = useMemo(() => files.DN && readEntregas(files.DN), [files.DN]);
  const mias = useMemo(() => (files.TARIMAS ? readTarimas(files.TARIMAS).tarimas : []), [files.TARIMAS]);
  // serial → estación en el WIP cargado (extra: solo avisa)
  const wip = useMemo(() => { if (!files.WIP) return undefined; const r = readWip(files.WIP, files.WIP.cargado); return new Map([...r.piezas, ...r.terminadas, ...r.ocultas].map((p) => [p.serial.toUpperCase(), p.station])); }, [files.WIP]);
  const entregas = dn?.entregas ?? [];
  // las de la base (de todos los equipos); sin conexión, la página sigue con las de este equipo
  const [db, setDb] = useState<TarimaDb[]>(), [dbMsg, setDbMsg] = useState<string>();
  useEffect(() => { loadTarimasDb().then(setDb, (e) => setDbMsg(`Sin conexión con la base: ${e.message} Se guarda en este equipo.`)); }, []);
  const delDb = (db ?? []).map((x) => x.datos).filter((x) => !mias.some((m) => m.pallet === x.pallet));

  const [tab, setTab] = useState<'entregas' | 'tarimas'>('entregas'), [q, setQ] = useState('');
  const [t, setT] = useState<Tarima>(nueva), [orig, setOrig] = useState<string>(); // orig: Pallet # con que se guardó (para editar sin duplicar)
  const [variant, setVariant] = useState<LabelVariant>('qr'), [busy, setBusy] = useState(false), [msg, setMsg] = useState<string>();
  const [guia, setGuia] = useState(''); // DN del listado, como guía para escribirlo a mano
  const [abiertas, setAbiertas] = useState<Set<string>>(() => abiertasDe(nueva())); // las abre o cierra el usuario; no se cierran solas al llenarlas

  const todas = [...mias, ...delDb];
  const usados = new Set(todas.map((m) => m.pallet.trim().toUpperCase()).filter((p) => p && p !== (orig ?? '').trim().toUpperCase()));
  const save = (list: Tarima[]) => setFile('TARIMAS', { ...tarimasFile(list), name: 'Tarimas de este equipo', loadedAt: shortDate(new Date()) });
  /** Guarda en la base (si el Pallet # ya existe allá, no se guarda) y en este equipo; sin conexión, solo en el equipo. */
  const guardar = async (x: Tarima) => {
    if (usados.has(x.pallet.trim().toUpperCase())) return;
    const y = { ...x, creada: x.creada || local() };
    try { await saveTarimaDb(y, orig); setDbMsg(undefined); }
    catch (e) {
      if ((e as { status?: number }).status === 409) { setMsg((e as Error).message); return; }
      setDbMsg(`No se guardó en la base (${(e as Error).message}); quedó en este equipo.`);
    }
    save([...mias.filter((m) => !orig || m.pallet !== orig), y]); setOrig(y.pallet); setT(y);
  };
  const nuevaRef = () => {
    const d = new Date().toISOString().slice(0, 10).replace(/-/g, ''), n = Math.max(0, ...todas.map((m) => Number(m.ref.match(new RegExp(`-${d}-(\\d+)$`))?.[1] ?? 0)));
    return `FGNS-${d}-${String(n + 1).padStart(3, '0')}`;
  };
  const abrir = (x: Tarima, saved?: string) => { setT(x); setOrig(saved); setMsg(undefined); setGuia(''); setAbiertas(abiertasDe(x)); };
  // «Abrir» desde la página Tarimas: /pallets?abrir=PALFX…
  const [params, setParams] = useSearchParams(), pedir = params.get('abrir');
  useEffect(() => {
    const x = pedir && todas.find((m) => m.pallet === pedir);
    if (x) { setTab('tarimas'); abrir(x, x.pallet); setParams({}, { replace: true }); }
  }, [pedir, db]); // solo al pedir una tarima o al llegar las de la base

  const chk = revisar(t, usados, wip);
  const set = (k: TarimaKey, v: string) => setT({ ...t, [k]: v, printed: '' });
  const cambios = JSON.stringify(t) !== JSON.stringify(todas.find((m) => m.pallet === orig));
  const estado: [string, 'ok' | 'warn' | 'info'] = t.printed && !cambios ? ['Impresa', 'info'] : chk.listo ? ['Lista para imprimir', 'ok'] : ['Incompleta', 'warn'];

  const pdf = async (x: Tarima) => {
    setBusy(true);
    try { const { labelsPdf } = await import('../../pages/pdf.tsx'); download(`etiqueta-${x.pallet}.pdf`, await labelsPdf([{ d: labelOf(x), qr: qrText(x) }])); await guardar({ ...x, printed: shortDate(new Date()) }); }
    catch (e) { setMsg(`No se pudo generar el PDF: ${e instanceof Error ? e.message : e}`); } finally { setBusy(false); }
  };
  // un QR de etiqueta (foto o captura) abre esa tarima: la guardada si ya existe; si no, nueva y completada con el listado
  const cargarQr = async (file: File) => {
    setMsg(undefined);
    try {
      const x = fromQr((await readQrImage(file)) ?? '');
      if (!x) { setMsg(`${file.name}: no se encontró el QR de una etiqueta de tarima.`); return; }
      const g = todas.find((m) => m.pallet === x.pallet);
      if (g) { setTab('tarimas'); abrir(g, g.pallet); return; }
      const e = entregas.find((m) => m.so === x.so);
      const extra: Partial<Tarima> = { ...defaultsFor(x.pn, todas), ...(e && { customer: e.customer, destination: e.destination, desc: e.desc }) };
      setTab('tarimas'); abrir(Object.fromEntries(Object.entries(x).map(([k, v]) => [k, v || extra[k as TarimaKey] || ''])) as Tarima);
    } catch (e) { setMsg(`${file.name}: ${e instanceof Error ? e.message : 'no se pudo leer'}`); }
  };
  const exportar = () => download(`tarimas-${new Date().toISOString().slice(0, 10)}.csv`, new Blob([toCsv(tarimasFile(todas))], { type: 'text/csv' }));

  const match = (s: string) => !q || s.toLowerCase().includes(q.toLowerCase());
  const lista = tab === 'entregas'
    ? entregas.filter((e) => match(`${e.dn} ${e.so} ${e.model}`)).map((e) => ({ key: `e${e.dn}`, title: `DN ${e.dn}`, strong: e.model, sub: `${e.qty} pzas · ${e.destination}`, note: `${todas.filter((m) => m.so === e.so).length} tarimas armadas`, on: t.so === e.so && !orig, open: () => { abrir({ ...desdeEntrega(e), ...defaultsFor(e.model, todas), ref: nuevaRef() }); setGuia(e.dn); } }))
    : todas.filter((m) => match(`${m.pallet} ${m.dn} ${m.ref}`)).map((m) => ({
      key: m.pallet, title: m.pallet, strong: m.pn, sub: `${serialsOf(m).length} seriales · DN ${m.dn || '—'}`, note: m.printed ? `Impresa ${m.printed}` : 'Guardada',
      on: orig === m.pallet, open: () => abrir(m, m.pallet) }));

  return (
    <>
      <PageHead title="Etiquetas · en desarrollo" sub="Versión anterior: se rehace para separar cada DN por Pallet ID. Sirve para probar la etiqueta 4×6 in, el QR y el escáner.">
        <label className="yc-btn yc-btn-secondary app-pal-qrin">Cargar QR<input type="file" accept="image/*" className="yc-sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) cargarQr(f); }} /></label>
        <Button onClick={exportar} disabled={!todas.length}>Exportar CSV</Button>
      </PageHead>
      {msg && <p className="app-muted" role="alert"><Badge tone="bad">Aviso</Badge> {msg}</p>}
      {dbMsg && <p className="app-muted" role="status"><Badge tone="warn">Base</Badge> {dbMsg}</p>}
      <div className="app-pal">
        <aside className="yc-card app-pal-list" aria-label="Entregas y tarimas">
          <Segmented label="Ver" options={[{ value: 'entregas' as const, label: `Entregas (${entregas.length})` }, { value: 'tarimas' as const, label: `Tarimas (${todas.length})` }]} value={tab} onChange={setTab} />
          <label className="yc-field"><span className="yc-sr-only">Buscar</span><input className="yc-input" type="search" placeholder={tab === 'entregas' ? 'DN, SO o modelo…' : 'Pallet #, DN o Internal Ref…'} value={q} onChange={(x) => setQ(x.target.value)} /></label>
          {dn?.missing.length ? <p className="app-muted"><Badge tone="bad">Listado</Badge> Le faltan: {dn.missing.join(', ')}.</p> : null}
          <ul>
            {lista.map((x) => (
              <li key={x.key}>
                <button type="button" className="app-pal-dn" aria-current={x.on || undefined} onClick={x.open}>
                  <span className="app-mono">{x.title}</span><strong>{x.strong}</strong><span className="app-muted">{x.sub}</span><span className="app-muted">{x.note}</span>
                </button>
              </li>
            ))}
            {!lista.length && <li className="app-muted">{q ? `Nada con «${q}».` : tab === 'entregas' ? <>Carga el listado de entregas en <Link to="/pallets/carga">Carga de datos</Link>, o llena la tarima a mano.</> : 'Aún no hay tarimas.'}</li>}
          </ul>
          <Button variant="quiet" onClick={() => abrir(nueva())}>Tarima en blanco</Button>
        </aside>

        <section className="app-pal-form" aria-label="Tarima">
          <header className="yc-card app-pal-status">
            <div><span className="yc-kpi-label">{orig ? 'Tarima guardada' : 'Tarima nueva'}</span><strong className="app-mono">{t.dn ? `DN ${t.dn}` : t.so ? `SO ${t.so}` : 'Sin entrega'}</strong><span className="app-muted">{t.desc || t.pn || 'Elige una entrega del listado o llena las casillas.'}</span></div>
            <Badge tone={estado[1]}>{estado[0]}</Badge>
          </header>
          {AREAS.map((a) => {
            const done = a.campos.filter((c) => t[c.key].trim()).length;
            return (
              <details key={a.id} className="yc-card app-pal-area" open={abiertas.has(a.id)}
                onToggle={(x) => { const o = x.currentTarget.open; setAbiertas((s) => (o === s.has(a.id) ? s : new Set(o ? [...s, a.id] : [...s].filter((i) => i !== a.id)))); }}>
                <summary>
                  <span><strong>{a.name}</strong><span className="app-muted"> · {a.hint}</span></span>
                  <span className="app-pal-prog" aria-label={`${done} de ${a.campos.length} campos`}><span className="app-pal-bar"><i style={{ width: `${(done / a.campos.length) * 100}%` }} /></span>{done} / {a.campos.length}</span>
                </summary>
                <div className="app-pal-fields">
                  {a.campos.map((c) => (
                    <label key={c.key} className={`yc-field${c.src ? ` is-${c.src}` : ''}`}>
                      <span>{c.label}{REQ.has(c.key) && <span className="app-pal-req" aria-label="obligatorio"> *</span>}{c.src && <span className="app-pal-src">{SRC[c.src]}</span>}</span>
                      <input className={`yc-input${c.mono ? ' yc-mono' : ''}`} value={t[c.key]} onChange={(x) => set(c.key, x.target.value)} placeholder={c.key === 'dn' && guia ? `Listado: ${guia}` : undefined}
                        aria-invalid={(c.key === 'nw' && chk.pesoMal) || (c.key === 'pallet' && (chk.formato || chk.repetido)) || undefined} />
                    </label>
                  ))}
                  {a.id === 'itc' && chk.pesoMal && <p className="app-pal-err" role="alert">El peso neto no puede ser mayor que el bruto.</p>}
                  {a.id === 'itc' && chk.repetido && <p className="app-pal-err" role="alert">El Pallet # {t.pallet} ya está en otra tarima.</p>}
                  {a.id === 'itc' && chk.formato && <p className="app-pal-err" role="alert">El Pallet # debe ser como PALFX98195.</p>}
                </div>
              </details>
            );
          })}
          <section className="yc-card app-pal-area app-pal-serials" aria-label="Seriales">
            <label className="app-pal-test"><input type="checkbox" checked={!!t.prueba} onChange={(e) => setT({ ...t, prueba: e.target.checked ? 'sí' : '', qty: e.target.checked ? '9' : String(entregas.find((x) => x.so === t.so)?.qty ?? t.qty), printed: '' })} />
              <span><strong>Modo prueba ×9</strong> · cada lectura entra 9 veces (la escaneada + 8 copias) para llenar el QR como una tarima de 9 piezas. La etiqueta sale marcada PRUEBA.</span></label>
            <SerialInput key={t.so + orig} value={serialsOf(t)} onChange={(s) => set('serials', s.join(' '))} expected={chk.qty} label="Seriales de la tarima" repeat={t.prueba ? 9 : 1} />
            {chk.duplicados > 0 && <p className="app-pal-err" role="alert">Hay {chk.duplicados} seriales repetidos: quítalos o vuelve a encender el modo prueba.</p>}
            {chk.qty > 0 && chk.seriales !== chk.qty && <p className="app-muted">{chk.seriales < chk.qty ? `Faltan ${chk.qty - chk.seriales} seriales para cuadrar con las piezas.` : `Sobran ${chk.seriales - chk.qty} seriales.`}</p>}
            {wip && (chk.sinStock.length || chk.fueraWip.length) ? (
              <div className="app-pal-wip" role="status">
                <Badge tone="warn">WIP</Badge>
                {chk.sinStock.length > 0 && <span>{chk.sinStock.length} aún en línea: {chk.sinStock.slice(0, 4).map((s) => `${s} (${wip.get(s)})`).join(', ')}{chk.sinStock.length > 4 ? '…' : ''}.</span>}
                {chk.fueraWip.length > 0 && <span>{chk.fueraWip.length} no aparecen en el WIP cargado.</span>}
              </div>
            ) : wip && chk.seriales > 0 ? <p className="app-muted"><Badge tone="ok">WIP</Badge> Todos los seriales están terminados o en empaque (STOCKIN, FG, PACK).</p> : null}
          </section>
        </section>

        <aside className="app-pal-preview" aria-label="Vista previa de la etiqueta">
          <div className="yc-card app-pal-side">
            <header><h2 className="app-h3">Etiqueta 4×6 in</h2><Segmented label="Variante" options={VARIANTES} value={variant} onChange={setVariant} /></header>
            <div className="yc-label-wrap yc-label-print" key={JSON.stringify(t) + variant}><PalletLabel d={labelOf(t)} qr={qrText(t)} variant={variant} /></div>
            {!chk.listo && <p className="app-muted">{chk.faltan.length ? `Faltan ${chk.faltan.length}: ${chk.faltan.slice(0, 3).join(', ')}${chk.faltan.length > 3 ? '…' : ''}.` : chk.duplicados ? 'Hay seriales repetidos.' : chk.seriales !== chk.qty ? 'Los seriales no cuadran con las piezas.' : 'Revisa el Pallet # y los pesos.'}</p>}
            <div className="yc-row">
              <Button variant="primary" disabled={!chk.listo || busy} onClick={() => pdf(t)}>{busy ? 'Generando…' : 'Descargar PDF'}</Button>
              <Button disabled={!chk.listo} onClick={() => { window.print(); guardar({ ...t, printed: shortDate(new Date()) }); }}>Imprimir</Button>
              <Button variant="quiet" disabled={!t.pallet || !cambios || chk.repetido} onClick={() => guardar(t)}>{orig ? 'Guardar cambios' : 'Guardar'}</Button>
            </div>
            <Button variant="quiet" disabled={!t.pallet} onClick={async () => { try { download(`qr-${t.pallet}.png`, await qrPng(qrText(t))); } catch (e) { setMsg(`QR: ${e instanceof Error ? e.message : e}`); } }}>Descargar QR (PNG)</Button>
            <p className="app-muted">El PDF mide 4×6 in: imprímelo a «tamaño real». El QR lleva todos los datos y los {chk.seriales} seriales.</p>
          </div>
        </aside>
      </div>
    </>
  );
}
