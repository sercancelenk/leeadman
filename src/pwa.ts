/**
 * Registers the PWA service worker in the deployed web build and skips
 * registration in the Electron host (where it is unnecessary and `file://`
 * scope is incompatible with the SW API).
 *
 * Re-registers on every page load so a newly deployed build can install its
 * fresh SW. When a new SW is in `installing` state we immediately ask it to
 * skip waiting so the next navigation gets the latest code. Users never see
 * a "refresh to update" banner — updates are silent and applied on the next
 * navigation.
 */

function shouldRegister(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return false;
  // Electron host injects window.leeadman; skip SW there.
  if ((window as unknown as { leeadman?: unknown }).leeadman) return false;
  // file:// protocol cannot host a SW.
  if (window.location.protocol === 'file:') return false;
  // Only register when the bundle was built with LEEADMAN_PWA=1.
  if (!import.meta.env.LEEADMAN_PWA) return false;
  return true;
}

export function registerServiceWorker(): void {
  if (!shouldRegister()) return;

  const swUrl = `${import.meta.env.BASE_URL || '/'}sw.js`;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(swUrl, { scope: import.meta.env.BASE_URL || '/' })
      .then((registration) => {
        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              installing.postMessage('SKIP_WAITING');
            }
          });
        });
      })
      .catch((err) => {
        console.warn('[leeadman] service worker registration failed:', err);
      });

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  });
}
