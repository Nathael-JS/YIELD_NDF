import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// la versión de la app (para «Novedades»): solo el número, no todo el package.json en el navegador
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

// en desarrollo la API la sirve `npm start` (server/index.js) en el puerto 3000
export default defineConfig({
  plugins: [react()], define: { __VERSION__: JSON.stringify(version) }, server: { proxy: { '/api': 'http://localhost:3000' } },
  // los dos pesados (PDF y la escena 3D del login) se cargan aparte, solo cuando se usan
  build: { chunkSizeWarningLimit: 1300 },
});
