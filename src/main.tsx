import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { startSyncScheduler } from './services/syncScheduler';
import { registerSW } from 'virtual:pwa-register';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Inicia o scheduler de sincronização com o Google Sheets em segundo plano
startSyncScheduler();

// Registra o Service Worker via vite-plugin-pwa (Workbox)
// autoUpdate: o SW se atualiza automaticamente em segundo plano
const updateSW = registerSW({
  // Quando há uma atualização disponível e o usuário recarrega
  onNeedRefresh() {
    // Notificação sutil no topo da tela — sem bloquear o usuário
    const banner = document.createElement('div');
    banner.id = 'pwa-update-banner';
    banner.innerHTML = `
      <span>🔄 Nova versão disponível!</span>
      <button id="pwa-update-btn" onclick="this.closest('#pwa-update-banner').style.display='none'; window.__pwaUpdateSW && window.__pwaUpdateSW(true)">
        Atualizar agora
      </button>
      <button onclick="this.closest('#pwa-update-banner').style.display='none'" style="background:transparent;border:none;color:rgba(255,255,255,0.6);font-size:18px;cursor:pointer;padding:0 4px;line-height:1">×</button>
    `;
    banner.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; z-index: 99999;
      background: #1d4ed8; color: white;
      display: flex; align-items: center; justify-content: center; gap: 12px;
      padding: 10px 16px; font-size: 13px; font-weight: 600;
      font-family: 'Work Sans', system-ui, sans-serif;
      box-shadow: 0 2px 8px rgba(0,0,0,0.25);
      animation: slideDown 0.3s ease;
    `;
    const btn = banner.querySelector('#pwa-update-btn') as HTMLButtonElement;
    if (btn) {
      btn.style.cssText = `
        background: white; color: #1d4ed8; border: none; border-radius: 6px;
        padding: 5px 12px; font-size: 12px; font-weight: bold; cursor: pointer;
      `;
    }
    document.body.appendChild(banner);
    // Expõe a função de atualização globalmente para o banner
    (window as any).__pwaUpdateSW = updateSW;
  },
  // Quando o app está em modo offline (SW instalado com sucesso)
  onOfflineReady() {
    console.log('App pronto para uso offline.');
  },
  // Erro no registro do SW
  onRegisterError(error) {
    console.error('Erro ao registrar Service Worker:', error);
  },
});