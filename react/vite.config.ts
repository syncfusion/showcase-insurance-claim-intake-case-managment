import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import startupPreload from './scripts/startup-preload.mjs';

const SYNFUSION_PACKAGES = [
  'ej2-base', 'ej2-data', 'ej2-svg-base', 'ej2-drawings', 'ej2-lists',
  'ej2-popups', 'ej2-navigations', 'ej2-dropdowns', 'ej2-inputs', 'ej2-calendars',
  'ej2-buttons', 'ej2-charts', 'ej2-maps', 'ej2-grids', 'ej2-kanban',
  'ej2-pdfviewer', 'ej2-interactive-chat', 'ej2-react-base'
];

export default defineConfig(({ mode }) => ({
  base: '/insurance-claims-intake-portal/react/',
  plugins: [
    react(),
    startupPreload({
      base: '/insurance-claims-intake-portal/react/',
      defaultRoute: 'dashboard',
      routes: {
        dashboard: '/src/pages/DashboardPage.tsx',
        claims: '/src/pages/ClaimsListPage.tsx',
        board: '/src/pages/ClaimsBoardPage.tsx',
        detail: '/src/pages/ClaimDetailPage.tsx'
      },
      themes: { light: /^assets\/nonexistent$/, dark: /^assets\/nonexistent$/ }
    })
  ],
  resolve: {
    alias: {
      '@': '/src'
    }
  },
  build: {
    target: 'es2020',
    modulePreload: { polyfill: false },
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          for (const pkg of SYNFUSION_PACKAGES) {
            if (id.includes(`@syncfusion/${pkg}`)) return `syncfusion-${pkg}`;
          }
          if (id.includes('@syncfusion')) return 'syncfusion';
        }
      }
    }
  }
}));