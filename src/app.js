// Entry point for مزنوق: starts the controller, registers the offline service worker,
// and tells the user when a newer version has been downloaded.
import './controller.js';
import { downloadBackupFile } from './ctl/system.js';
import { loadValue } from './storage.js';
import { SETUP_KEY } from './state.js';

// «فيه نسخة جديدة»: shown when a new service worker takes over while the app is open.
// The update never touches the data, but a phone or browser can clear it on its own, so the one tap
// downloads a backup file first, then reloads with the new files.
function showUpdateBanner() {
  if (document.querySelector('.update-banner')) return;
  const banner = document.createElement('button');
  banner.type = 'button';
  banner.className = 'update-banner';
  banner.textContent = 'فيه نسخة جديدة · خد نسخة احتياطية واحدث';
  banner.addEventListener('click', async () => {
    banner.disabled = true;
    try {
      if (await loadValue(SETUP_KEY)) {
        banner.textContent = 'بننزّل النسخة الاحتياطية...';
        await downloadBackupFile({ photos: true });
        await new Promise((r) => { setTimeout(r, 1200); });
      }
    } catch {
      // The update goes on even if the download did not work.
    }
    window.location.reload();
  });
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
