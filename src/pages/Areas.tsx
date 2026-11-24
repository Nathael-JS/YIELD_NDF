// Inicio: elegir área en el menú giratorio. Recuerda la última área en este navegador.
import { useNavigate } from 'react-router-dom';
import { AreaWheel } from '../components/AreaWheel.tsx';
import { areasDe } from '../areas.ts';
import { useApp } from '../store.ts';
import { PageHead } from './Layout.tsx';

const KEY = 'yc-area';
const ultima = () => { try { return localStorage.getItem(KEY) ?? ''; } catch { return ''; } };

export default function Areas() {
  const user = useApp((s) => s.user), files = useApp((s) => s.files), go = useNavigate();
  const areas = areasDe(user);
  const meta = (fs: string[]) => {
    const l = fs.map((f) => files[f as keyof typeof files]).filter(Boolean);
    return l.length ? `${l.length} archivo${l.length === 1 ? '' : 's'} cargado${l.length === 1 ? '' : 's'} · ${l.map((f) => f!.name).join(', ')}` : 'Sin archivos cargados';
  };
  const enter = (id: string) => { try { localStorage.setItem(KEY, id); } catch { /* sin almacenamiento: no se recuerda */ } go(`/${id}`); };
  return (
    <>
      <PageHead title="¿En qué área trabajas?" sub="Cada área tiene su carga, su validación, sus vistas, su historial y sus descargas. Gira con las flechas o haz clic en una tarjeta." />
      <AreaWheel areas={areas.map((a) => ({ id: a.id, name: a.name, hint: a.hint, icon: a.icon, meta: meta(a.files) }))} onEnter={enter}
        start={((i) => (i < 0 ? 1 : i))(areas.findIndex((a) => a.id === ultima()))} label="Áreas" />
    </>
  );
}
