import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Build targets:
 *  - Electron (`file://` runtime): we need relative asset paths (`./`).
 *  - GitHub Pages (`https://user.github.io/leeadman/`): assets must resolve
 *    under the repo sub-path. We set this via the `LEEADMAN_PWA` env var so
 *    the same source tree builds both.
 *
 * Set `LEEADMAN_PWA=1` (and optionally `LEEADMAN_BASE=/leeadman/`) when
 * building the web bundle for Pages. The default keeps Electron working.
 */
const isPwa = process.env.LEEADMAN_PWA === '1';
const base = isPwa ? process.env.LEEADMAN_BASE || '/leeadman/' : './';

export default defineConfig({
  plugins: [react()],
  base,
  define: {
    'import.meta.env.LEEADMAN_PWA': JSON.stringify(isPwa ? '1' : ''),
  },
  server: { port: 5173, strictPort: true },
});
