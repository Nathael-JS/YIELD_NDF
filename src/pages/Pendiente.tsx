import { Badge } from '../components/ui.tsx';
import { PageHead } from './Layout.tsx';

/** Pasos cuyo cálculo falta definir con los archivos reales (ver PLAN.md). */
export default function Pendiente({ title, what }: { title: string; what: string }) {
  return (
    <>
      <PageHead title={title} sub={what}><Badge tone="info">En diseño</Badge></PageHead>
      <p className="yc-card app-empty">Este paso se construye cuando estén definidas las columnas y reglas de los archivos TCQS, DATA ANALYSIS y QM.</p>
    </>
  );
}
