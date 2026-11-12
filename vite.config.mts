import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

// Interfaz en web/ (dos páginas: jugador y panel). El servidor Node sirve el resultado de dist/.
export default defineConfig({
  root: 'web',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    assetsInlineLimit: 0, // el CSP del servidor no permite fuentes en data:
    rollupOptions: { input: { index: fileURLToPath(new URL('./web/index.html', import.meta.url)), host: fileURLToPath(new URL('./web/host.html', import.meta.url)) } },
  },
  server: {
    port: 5173,
    proxy: { '/ws': { target: 'ws://localhost:3000', ws: true }, '/api': 'http://localhost:3000', '/health': 'http://localhost:3000' },
  },
});
