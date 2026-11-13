import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    env: { NEXT_PUBLIC_API_URL: 'http://localhost:3001' },
    coverage: {
      provider: 'v8',
      // Lógica y componentes de las features; no las rutas de app/ (composición)
      // ni la configuración. Ver ADR 0007.
      include: ['src/features/**/*.{ts,tsx}', 'src/lib/**/*.ts'],
      exclude: ['**/*.test.{ts,tsx}'],
      reporter: ['text-summary', 'text'],
      // Piso, no meta: un poco por debajo de lo medido al introducirlo (67 % de
      // líneas). Se sube cuando la cobertura sube; nunca se baja para que pase un PR.
      thresholds: { lines: 65, statements: 65, functions: 65, branches: 50 },
    },
  },
});
