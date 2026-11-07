import { useData } from '../store.ts';
import { NeedTcqs, PageHead } from './Layout.tsx';
import { slides } from './slides.tsx';

export default function Graficos() {
  const { records } = useData();
  return (
    <>
      <PageHead title="Gráficos" sub="Pareto · Barras · Líneas · Histograma · Dispersión, con los datos de Juliet." />
      {records.length ? <div className="app-charts">{slides(records, 'dia', 'todas las estaciones').map((s) => <div key={s.id}>{s.content}</div>)}</div> : <NeedTcqs />}
    </>
  );
}
