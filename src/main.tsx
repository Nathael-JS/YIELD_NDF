import { StrictMode } from 'react';
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
import Carga from './pages/Carga.tsx';
import Comparacion from './pages/Comparacion.tsx';
import Graficos from './pages/Graficos.tsx';
import Historial from './pages/Historial.tsx';
import Inicio from './pages/Inicio.tsx';
import Layout from './pages/Layout.tsx';
import Login from './pages/Login.tsx';
import Match from './pages/Match.tsx';
import Pendiente from './pages/Pendiente.tsx';
import Validacion from './pages/Validacion.tsx';

const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Inicio /> },
      { path: '/carga', element: <Carga /> },
      { path: '/comparacion', element: <Comparacion /> },
      { path: '/validacion', element: <Validacion /> },
      { path: '/match', element: <Match /> },
      { path: '/muestra', element: <Pendiente title="Muestra" what="Yield, WIP y Pareto del periodo con los datos validados." /> },
      { path: '/graficos', element: <Graficos /> },
      { path: '/historial', element: <Historial /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
