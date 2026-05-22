import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import AppErrorBoundary from './components/AppErrorBoundary.tsx';
import './index.css';
import { trackEvent } from './telemetry';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
);

// Register PWA Service Worker for offline capabilities
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const baseUrl = (import.meta as any).env?.BASE_URL || '/';
    const swUrl = `${baseUrl}sw.js`;
    navigator.serviceWorker.register(swUrl)
      .then((reg) => {
        console.log('Spiritual Tasbih Service Worker registered with scope:', reg.scope);

        const askForRefresh = () => {
          const accepted = window.confirm('A new version is available. Reload now to update?');
          trackEvent('sw_update_prompt_shown', { accepted });
          if (accepted && reg.waiting) {
            trackEvent('sw_update_skip_waiting_sent');
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
        };

        if (reg.waiting) askForRefresh();

        reg.addEventListener('updatefound', () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              trackEvent('sw_update_installed_waiting');
              askForRefresh();
            }
          });
        });

        navigator.serviceWorker.addEventListener('controllerchange', () => {
          trackEvent('sw_controller_changed_reload');
          window.location.reload();
        });
      })
      .catch((err) => {
        console.error('Service Worker registration failed:', err);
        trackEvent('sw_registration_failed', { message: String(err) });
      });
  });
}
