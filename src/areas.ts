// Áreas de la app: cada una con sus archivos, su flujo (riel izquierdo) y sus consultas (riel derecho).
// Las rutas van con el área delante: /yield/carga, /wip/validacion, /pallets/descargas…
import { useLocation } from 'react-router-dom';
import type { FileType } from './store.ts';

export type AreaId = 'yield' | 'wip' | 'pallets';
export type Item = { label: string; to: string; icon: string };
export interface Area {
  id: AreaId; name: string; hint: string; icon: string;
  /** Archivos que se cargan en esta área (Carga y Validación muestran solo estos). */
  files: FileType[];
  /** Riel izquierdo: carga → validación → la vista principal del área. */
  flow: Item[];
  /** Riel derecho: consultas del área. */
  views: Item[];
}

// íconos de trazo (24×24): uno por página, para los rieles cerrados
export const I = {
  carga: 'M12 16V4m0 0-4 4m4-4 4 4M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3', valid: 'M9 12l2 2 4-4M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z',
  yield: 'M4 19h16M7 16V9m5 7V5m5 11v-5', wip: 'M3 12h4l2-6 4 12 2-6h6', dl: 'M12 4v11m0 0-4-4m4 4 4-4M4 19h16', pal: 'M4 8l8-4 8 4-8 4-8-4zm0 0v8l8 4 8-4V8M12 12v8',
  inicio: 'M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z', graf: 'M4 20V10m6 10V4m6 16v-8m4 8H2', label: 'M4 5h16v14H4zM8 9v6m3-6v6m3-6v6m3-6v6',
  comp: 'M7 7h13m0 0-3-3m3 3-3 3M17 17H4m0 0 3-3m-3 3 3 3', ndf: 'M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5', hist: 'M12 7v5l3 3M12 21a9 9 0 1 0-9-9',
  cuentas: 'M16 19v-1a4 4 0 0 0-8 0v1M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM20 19v-1a3 3 0 0 0-2-2.8M17 5.2a3 3 0 0 1 0 5.6', base: 'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zm0 0v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
  areas: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
};

const base = (a: AreaId) => [{ label: 'Carga de datos', to: `/${a}/carga`, icon: I.carga }, { label: 'Validación', to: `/${a}/validacion`, icon: I.valid }];
const consulta = (a: AreaId) => [{ label: 'Historial', to: `/${a}/historial`, icon: I.hist }, { label: 'Descargas', to: `/${a}/descargas`, icon: I.dl }];

export const AREAS: Area[] = [
  { id: 'wip', name: 'WIP', hint: 'Dónde está cada pieza y desde hace cuánto: flujo por estación y línea de tiempo.', icon: I.wip, files: ['WIP'],
    flow: [...base('wip'), { label: 'WIP', to: '/wip', icon: I.wip }], views: consulta('wip') },
  { id: 'yield', name: 'YIELD', hint: 'FPY, Final Yield y NDF por estación, con gráficas y comparativas.', icon: I.yield, files: ['TCQS', 'FALLAS'],
    flow: [...base('yield'), { label: 'Yield por estación', to: '/yield/estaciones', icon: I.yield }],
    views: [{ label: 'Inicio', to: '/yield', icon: I.inicio }, { label: 'Gráficos', to: '/yield/graficos', icon: I.graf }, { label: 'Comparativas', to: '/yield/comparativas', icon: I.comp },
      { label: 'NDF', to: '/yield/ndf', icon: I.ndf }, ...consulta('yield')] },
  { id: 'pallets', name: 'PALLETS', hint: 'Tarimas de embarque: entregas, seriales y etiqueta 4×6 in con QR.', icon: I.pal, files: ['DN', 'TARIMAS'],
    flow: [...base('pallets'), { label: 'Etiquetas', to: '/pallets', icon: I.label }], views: [{ label: 'Tarimas', to: '/pallets/tarimas', icon: I.pal }, ...consulta('pallets')] },
];

export const areaById = (id?: string) => AREAS.find((a) => a.id === id);
/** El área de una ruta («/wip/carga» → WIP); fuera de un área (inicio, cuentas…) no hay. */
export const areaOf = (path: string) => areaById(path.split('/')[1]);
/** Áreas que ve un usuario. shortcut: todos ven las tres hasta que el administrador asigne áreas (backend). */
export const areasDe = (_user: string | null) => AREAS;

/** Área de la página actual (las páginas compartidas —Carga, Validación, Historial, Descargas— la toman de la ruta). */
export const useArea = () => areaOf(useLocation().pathname) ?? AREAS[1];
