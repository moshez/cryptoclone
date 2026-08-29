let reloading = false;
let updateApplied = false;

export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  if (import.meta.env.DEV) return;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Reload once when a NEW build's worker takes control, so the page runs
    // the new build. Progress is persisted on every state change, so
    // nothing is lost. First-install claim (updateApplied false) must not
    // reload, and the guard prevents a loop.
    if (!updateApplied || reloading) return;
    reloading = true;
    location.reload();
  });

  const url = `${import.meta.env.BASE_URL}sw.js`;
  navigator.serviceWorker
    .register(url, { updateViaCache: 'none' })
    .then((registration) => {
      registration.update().catch(() => {});
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          registration.update().catch(() => {});
        }
      });
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            updateApplied = true;
            worker.postMessage('SKIP_WAITING');
          }
        });
      });
    })
    .catch(() => {});
}
