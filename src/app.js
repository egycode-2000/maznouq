// Entry point for مزنوق: starts the controller and registers the offline service worker.
import './controller.js';

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
