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