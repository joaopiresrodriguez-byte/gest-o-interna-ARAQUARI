import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { startSyncScheduler } from './services/syncScheduler';

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

// Registra o Service Worker para suporte PWA (cache offline + instalação)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then(reg => {
        console.log('SW registrado:', reg.scope);
      })
      .catch(err => {
        console.error('Erro ao registrar SW:', err);
      });
  });
}