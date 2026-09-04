import React, { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'pwa_banner_dismissed_until';
const DISMISS_DAYS = 7;

const InstallBanner: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Não exibir se já está instalado como PWA standalone
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    // Verificar se o usuário dispensou o banner recentemente
    const dismissedUntil = localStorage.getItem(DISMISSED_KEY);
    if (dismissedUntil && Date.now() < Number(dismissedUntil)) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setVisible(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    const until = Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000;
    localStorage.setItem(DISMISSED_KEY, String(until));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      id="pwa-install-banner"
      role="banner"
      aria-label="Banner de instalação do aplicativo"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        padding: '12px 16px',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        borderTop: '2px solid #cc0000',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.4)',
        animation: 'slideUp 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}
    >
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>

      {/* Ícone do app */}
      <img
        src="/icons/icon-72x72.png"
        alt="Ícone CBMSC"
        width={44}
        height={44}
        style={{ borderRadius: '10px', flexShrink: 0 }}
      />

      {/* Texto */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: 0,
          color: '#ffffff',
          fontSize: '13px',
          fontWeight: 600,
          fontFamily: "'Work Sans', sans-serif",
          lineHeight: 1.3,
        }}>
          Instale o app no seu celular
        </p>
        <p style={{
          margin: '2px 0 0',
          color: '#9ca3af',
          fontSize: '11px',
          fontFamily: "'Work Sans', sans-serif",
          lineHeight: 1.3,
        }}>
          Acesso rápido sem abrir o navegador
        </p>
      </div>

      {/* Botão Instalar */}
      <button
        id="pwa-install-btn"
        onClick={handleInstall}
        style={{
          background: '#cc0000',
          color: '#ffffff',
          border: 'none',
          borderRadius: '8px',
          padding: '8px 14px',
          fontSize: '12px',
          fontWeight: 700,
          fontFamily: "'Work Sans', sans-serif",
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          flexShrink: 0,
          transition: 'background 0.2s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = '#aa0000')}
        onMouseLeave={e => (e.currentTarget.style.background = '#cc0000')}
      >
        Instalar
      </button>

      {/* Botão Fechar */}
      <button
        id="pwa-dismiss-btn"
        onClick={handleDismiss}
        aria-label="Fechar banner"
        style={{
          background: 'none',
          border: 'none',
          color: '#6b7280',
          cursor: 'pointer',
          padding: '4px',
          flexShrink: 0,
          fontSize: '18px',
          lineHeight: 1,
          display: 'flex',
          alignItems: 'center',
          transition: 'color 0.2s',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = '#ffffff')}
        onMouseLeave={e => (e.currentTarget.style.color = '#6b7280')}
      >
        ✕
      </button>
    </div>
  );
};

export default InstallBanner;
