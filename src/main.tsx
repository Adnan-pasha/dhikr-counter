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
  const banner = document.createElement('div');
  banner.id = 'sw-update-banner';
  banner.style.cssText = [
    'position:fixed', 'bottom:80px', 'left:50%', 'transform:translateX(-50%)',
    'z-index:9999', 'background:#1e293b', 'border:1px solid rgba(245,158,11,0.4)',
    'color:#f1f5f9', 'padding:12px 16px', 'border-radius:20px',
    'box-shadow:0 8px 32px rgba(0,0,0,0.4)', 'display:flex',
    'align-items:center', 'gap:12px', 'font-family:sans-serif',
    'font-size:12px', 'max-width:320px', 'width:90%',
  ].join(';');

  banner.innerHTML = `
    <span style="flex:1">✨ New version available!</span>
    <button id="sw-update-dismiss" style="background:transparent;border:1px solid #475569;color:#94a3b8;padding:4px 10px;border-radius:8px;cursor:pointer;font-size:11px;font-weight:700">Later</button>
    <button id="sw-update-confirm" style="background:linear-gradient(135deg,#f59e0b,#f97316);border:none;color:#0f172a;padding:4px 12px;border-radius:8px;cursor:pointer;font-size:11px;font-weight:900">Update</button>
  `;

  document.body.appendChild(banner);
  trackEvent('sw_update_prompt_shown', { accepted: null });

  document.getElementById('sw-update-confirm')?.addEventListener('click', () => {
    trackEvent('sw_update_skip_waiting_sent');
    banner.remove();
    if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
  });

  document.getElementById('sw-update-dismiss')?.addEventListener('click', () => {
    trackEvent('sw_update_prompt_shown', { accepted: false });
    banner.remove();
  });
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
