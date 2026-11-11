// Entry point for مزنوق: starts the controller, registers the offline service worker,
// and tells the user when a newer version has been downloaded.
import './controller.js';

// «فيه نسخة جديدة»: shown when a new service worker takes over while the app is open.
// Pressing it reloads the page, so the new files are the ones running. Data is not touched.
function showUpdateBanner() {
  if (document.querySelector('.update-banner')) return;
  const banner = document.createElement('button');
  banner.type = 'button';
  banner.className = 'update-banner';
  banner.textContent = 'فيه نسخة جديدة من مزنوق · اضغط للتحديث';
  banner.addEventListener('click', () => window.location.reload());
  document.body.append(banner);
}

if ('serviceWorker' in navigator) {
  // On the very first visit there is no old version, so the first takeover is not an update.
  const hadVersion = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadVersion) showUpdateBanner();
  });
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    // Look for a newer version each time the app comes back to the front.
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) reg.update().catch(() => {});
    });
  }).catch(() => {});
}
