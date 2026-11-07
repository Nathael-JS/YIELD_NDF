import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// en desarrollo la API la sirve `npm start` (server/index.js) en el puerto 3000
export default defineConfig({ plugins: [react()], server: { proxy: { '/api': 'http://localhost:3000' } } });
