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
import Inicio from './pages/Inicio.tsx';
import Layout from './pages/Layout.tsx';
import Login from './pages/Login.tsx';
// el resto de las páginas se descarga al visitarlas: la app abre más rápido
const Yield = lazy(() => import('./pages/Yield.tsx'));
const Wip = lazy(() => import('./pages/Wip.tsx'));
const Validacion = lazy(() => import('./pages/Validacion.tsx'));
const Seguridad = lazy(() => import('./pages/Seguridad.tsx'));
const Ndf = lazy(() => import('./pages/Ndf.tsx'));
const Historial = lazy(() => import('./pages/Historial.tsx'));
const Graficos = lazy(() => import('./pages/Graficos.tsx'));
const Cuentas = lazy(() => import('./pages/Cuentas.tsx'));
const Comparativas = lazy(() => import('./pages/Comparativas.tsx'));
const Carga = lazy(() => import('./pages/Carga.tsx'));
const Base = lazy(() => import('./pages/Base.tsx'));

const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Inicio /> },
      { path: '/carga', element: <Carga /> },
      { path: '/validacion', element: <Validacion /> },
      { path: '/yield', element: <Yield /> },
      { path: '/wip', element: <Wip /> },
      { path: '/graficos', element: <Graficos /> },
      { path: '/comparativas', element: <Comparativas /> },
      { path: '/ndf', element: <Ndf /> },
      { path: '/historial', element: <Historial /> },
      { path: '/cuentas', element: <Cuentas /> },
      { path: '/base', element: <Base /> },
      { path: '/seguridad', element: <Seguridad /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
