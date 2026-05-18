import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { migrateLegacyStorage } from './lib/legacyStorageMigration';
import { registerServiceWorker } from './pwa';

// Copy any pre-rename `leeadman-*` localStorage / sessionStorage keys to
// their `cadence-*` equivalents BEFORE anything else reads from storage.
// Idempotent and self-marking; see `legacyStorageMigration.ts`.
migrateLegacyStorage();

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Cadence: root element #root not found in document.');
}

createRoot(rootEl).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

registerServiceWorker();
