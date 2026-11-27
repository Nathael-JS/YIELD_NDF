// Base de datos · Rutas por modelo: la línea de estaciones, sus reparaciones, los retornos y los saltos (como el diagrama de ruta del MES).
// La guardada vale para todos; sin guardada vale la base (src/lib/ruta.ts) o lo que enseñan la estructura de yield y el WIP. Solo un administrador la cambia.
import { useEffect, useMemo, useState } from 'react';
import { RouteMap } from '../../components/flow.tsx';
import { Badge, Button, Select, type Tone } from '../../components/ui.tsx';
import { loadWipFlujo, loadWipRutas, saveWipRuta, type WipRuta } from '../../lib/db.ts';
import { armarRuta, mapaDe, RUTAS_BASE, rutaATexto, textoARuta } from '../../lib/ruta.ts';
import { lugarDe, type Paso } from '../../lib/wip.ts';
import { useApp, shortDate } from '../../store.ts';

export default function RutasWip() {
  const admin = useApp((s) => s.admin);
  const [rutas, setRutas] = useState<WipRuta[]>([]), [pasos, setPasos] = useState<Paso[]>([]), [model, setModel] = useState('');
  const [texto, setTexto] = useState(''), [msg, setMsg] = useState<[Tone, string]>(), [busy, setBusy] = useState(false);
  const recargar = () => loadWipRutas().then(setRutas, (e) => setMsg(['warn', `Sin conexión con la base: ${e.message}`]));
  useEffect(() => { recargar(); loadWipFlujo().then((f) => setPasos(f.pasos), () => {}); }, []);
  const modelos = useMemo(() => [...new Set([...rutas.map((r) => r.model), ...RUTAS_BASE.map((r) => r.model), ...pasos.map((p) => p.model)])].filter(Boolean).sort(), [rutas, pasos]);
  const guardada = rutas.find((r) => r.model === model), base = RUTAS_BASE.find((r) => r.model === model);
  // al elegir un modelo, el texto parte de la guardada, la base o la estructura de yield
  useEffect(() => {
    if (model) setTexto(rutaATexto(armarRuta(model, guardada ?? base, pasos.filter((p) => p.model === model).map((p) => p.station), [])));
  }, [model, guardada, base, pasos]);
  useEffect(() => setMsg(undefined), [model]);
  const leida = model ? textoARuta(model, texto) : undefined;
  const mapa = leida && !leida.error ? mapaDe(leida.ruta, [], (s) => lugarDe(pasos, model, s)) : undefined;

  async function enviar(borrar: boolean) {
    if (!leida || (!borrar && leida.error)) return;
    setBusy(true);
    try {
      await saveWipRuta(borrar ? { model, estaciones: [], retornos: [], saltos: [] } : leida.ruta);
      await recargar();
      setMsg(['ok', borrar ? `Se quitó la ruta guardada de ${model}: vale ${base ? 'la base' : 'lo que enseñan el WIP y la estructura de yield'}.` : `Ruta de ${model} guardada para todos.`]);
    } catch (e) { setMsg(['bad', (e as Error).message]); } finally { setBusy(false); }
  }

  return (
    <section className="yc-card yc-pad app-sec app-rutas" aria-labelledby="rutas-t">
      <h2 id="rutas-t" className="app-h3">Rutas por modelo · WIP</h2>
      <p className="app-muted">La línea de estaciones en orden, sus reparaciones (R_), los retornos de una reparación a otra estación y los saltos de la línea, como el diagrama de ruta del MES. El Dashboard la dibuja al elegir un modelo; además aprende del WIP las estaciones y retornos que falten. Solo un administrador la cambia.</p>
      <div className="app-rutas-head">
        <Select label="Modelo" value={model} onChange={setModel} options={[{ value: '', label: `Elige un modelo (${modelos.length})` }, ...modelos.map((m) => ({ value: m, label: `${m}${rutas.some((r) => r.model === m) ? ' · guardada' : RUTAS_BASE.some((r) => r.model === m) ? ' · base' : ''}` }))]} />
        {model && <span className="app-muted">{guardada ? `Guardada por ${guardada.usuario}${guardada.guardada ? ` · ${shortDate(new Date(guardada.guardada))}` : ''}` : base ? 'Base: el diagrama de ruta del MES' : 'Sin guardar: sale de la estructura de yield'}</span>}
      </div>
      {model && (
        <>
          <div className="app-rutas-body">
            <label className="yc-field">Ruta (una estación por renglón; «R» si tiene reparación; «R_X &gt; Y» retorno; «X &gt; Y» salto)
              <textarea className="yc-input app-rutas-txt" value={texto} onChange={(e) => setTexto(e.target.value)} spellCheck={false} rows={14} readOnly={!admin} />
            </label>
            {leida?.error ? <p role="alert"><Badge tone="bad">Ruta</Badge> {leida.error}</p>
              : <p className="app-muted">{leida!.ruta.estaciones.length} estaciones · {leida!.ruta.estaciones.filter((e) => e.rep).length} con reparación · {leida!.ruta.retornos.length} retornos · {leida!.ruta.saltos.length} saltos</p>}
          </div>
          {mapa && <RouteMap title={`Vista previa de la ruta de ${model}`} {...mapa} />}
          {admin ? (
            <div className="yc-row">
              <Button variant="primary" disabled={busy || !!leida?.error} onClick={() => enviar(false)}>Guardar para todos</Button>
              {guardada && <Button disabled={busy} onClick={() => enviar(true)}>Quitar la guardada</Button>}
            </div>
          ) : <p className="app-muted">Solo un administrador guarda rutas.</p>}
        </>
      )}
      {msg && <p className="app-muted" role="status"><Badge tone={msg[0]}>Rutas</Badge> {msg[1]}</p>}
    </section>
  );
}
