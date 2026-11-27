import { lazy, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './styles/tokens.css';
import './styles/yc.css';
import './styles/app.css';
const Inicio = lazy(() => import('./areas/yield/Inicio.tsx'));
import Areas from './pages/Areas.tsx';
import Layout from './pages/Layout.tsx';
import Login from './pages/Login.tsx';
import Seguridad from './pages/Seguridad.tsx'; // ya va en el paquete principal: Layout la muestra si falta el MFA
// el resto de las páginas se descarga al visitarlas: la app abre más rápido
const Yield = lazy(() => import('./areas/yield/Yield.tsx'));
const Wip = lazy(() => import('./areas/wip/Wip.tsx'));
const Descargas = lazy(() => import('./pages/Descargas.tsx'));
const Pallets = lazy(() => import('./areas/pallets/Pallets.tsx'));
const Etiquetas = lazy(() => import('./areas/pallets/Etiquetas.tsx'));
const Conexion = lazy(() => import('./areas/pallets/Conexion.tsx'));
const HistorialPallets = lazy(() => import('./areas/pallets/Historial.tsx'));
const Tabla = lazy(() => import('./areas/pallets/Tabla.tsx'));
const HistorialWip = lazy(() => import('./areas/wip/Historial.tsx'));
const DashboardWip = lazy(() => import('./areas/wip/Dashboard.tsx'));
const HistoricoWip = lazy(() => import('./areas/wip/Historico.tsx'));
const Validacion = lazy(() => import('./pages/Validacion.tsx'));
const Ndf = lazy(() => import('./areas/yield/Ndf.tsx'));
const Historial = lazy(() => import('./areas/yield/Historial.tsx'));
const Graficos = lazy(() => import('./areas/yield/Graficos.tsx'));
const Cuentas = lazy(() => import('./pages/Cuentas.tsx'));
const Comparativas = lazy(() => import('./areas/yield/Comparativas.tsx'));
const Carga = lazy(() => import('./pages/Carga.tsx'));
const Base = lazy(() => import('./pages/Base.tsx'));

const viejas: [string, string][] = [['/carga', '/yield/carga'], ['/validacion', '/yield/validacion'], ['/graficos', '/yield/graficos'], ['/comparativas', '/yield/comparativas'],
  ['/ndf', '/yield/ndf'], ['/historial', '/yield/historial'], ['/descargas', '/yield/descargas']];

const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Areas /> },
      // YIELD
      { path: '/yield', element: <Inicio /> },
      { path: '/yield/estaciones', element: <Yield /> },
      { path: '/yield/graficos', element: <Graficos /> },
      { path: '/yield/comparativas', element: <Comparativas /> },
      { path: '/yield/ndf', element: <Ndf /> },
      { path: '/yield/historial', element: <Historial /> },
      // WIP
      { path: '/wip', element: <DashboardWip /> },
      { path: '/wip/piezas', element: <Wip /> },
      { path: '/wip/historico', element: <HistoricoWip /> },
      { path: '/wip/historial', element: <HistorialWip /> },
      // PALLETS
      { path: '/pallets', element: <Pallets /> },
      { path: '/pallets/etiquetas', element: <Etiquetas /> },
      { path: '/pallets/wip', element: <Conexion /> },
      { path: '/pallets/tabla', element: <Tabla /> },
      { path: '/pallets/historial', element: <HistorialPallets /> },
      // compartidas: cada una muestra lo de su área
      ...['yield', 'wip', 'pallets'].flatMap((a) => [
        { path: `/${a}/carga`, element: <Carga /> }, { path: `/${a}/validacion`, element: <Validacion /> }, { path: `/${a}/descargas`, element: <Descargas /> },
      ]),
      { path: '/cuentas', element: <Cuentas /> },
      { path: '/base', element: <Base /> },
      { path: '/seguridad', element: <Seguridad /> },
      // direcciones anteriores a las áreas
      ...viejas.map(([from, to]) => ({ path: from, element: <Navigate to={to} replace /> })),
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
