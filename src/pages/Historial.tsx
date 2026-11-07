import { useNavigate } from 'react-router-dom';
import { HistoryList } from '../components/ui.tsx';
import { useApp } from '../store.ts';
import { PageHead } from './Layout.tsx';

export default function Historial() {
  const { history } = useApp();
  const go = useNavigate();
  function backup() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(history, null, 2)], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `yield-control-respaldo-${new Date().toISOString().slice(0, 10)}.json` });
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <PageHead title="Historial" sub="Archivos cargados en este equipo. El último de cada tipo queda guardado hasta que salgas; el respaldo descarga la lista en JSON." />
      <HistoryList items={history} onBackup={backup} onCompare={() => go('/carga')} />
    </>
  );
}
