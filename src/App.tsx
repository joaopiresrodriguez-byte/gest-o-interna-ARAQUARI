import React, { lazy, Suspense, useCallback } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Toaster } from 'sonner';
import { LoadingFallback } from './components/LoadingFallback';
import { RouteErrorBoundary } from './components/RouteErrorBoundary';
import NotificationBell from './components/NotificationBell';
import InstallBanner from './components/shared/InstallBanner';

// Lazy loading de páginas para code splitting
const DashboardAvisos = lazy(() => import('./pages/DashboardAvisos'));
const Operacional = lazy(() => import('./pages/Operacional'));
const PessoalB1 = lazy(() => import('./pages/PessoalB1'));
const InstrucaoB3 = lazy(() => import('./pages/InstrucaoB3'));
const PatrimonioB4 = lazy(() => import('./pages/PatrimonioB4'));
const SocialB5 = lazy(() => import('./pages/SocialB5'));
const SSCI = lazy(() => import('./pages/SSCI'));
const Login = lazy(() => import('./pages/Login'));
const GestaoUsuarios = lazy(() => import('./pages/GestaoUsuarios'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const ExtratoPublico = lazy(() => import('./pages/ExtratoPublico'));
const BcIntencaoPublica = lazy(() => import('./pages/BcIntencaoPublica').then(m => ({ default: m.BcIntencaoPublica })));
const SolicitarApoioPublico = lazy(() => import('./pages/SolicitarApoioPublico'));
const AuthCallback = lazy(() => import('./pages/AuthCallback'));
const AcessoPendente = lazy(() => import('./pages/AcessoPendente'));

import ChangePasswordModal from './components/ChangePasswordModal';



// Sidebar Link Component — Memoized to prevent unnecessary re-renders
const SidebarLink = React.memo<{
  to: string;
  icon: string;
  label: string;
  onNavigate?: () => void;
}>(({
  to,
  icon,
  label,
  onNavigate,
}) => {
  // Prefetch function to load the lazy component chunk on hover
  const prefetch = () => {
    const componentMap: Record<string, () => Promise<any>> = {
      '/avisos': () => import('./pages/DashboardAvisos'),
      '/operacional': () => import('./pages/Operacional'),
      '/ssci': () => import('./pages/SSCI'),
      '/pessoal': () => import('./pages/PessoalB1'),
      '/instrucao': () => import('./pages/InstrucaoB3'),
      '/logistica': () => import('./pages/PatrimonioB4'),
      '/social': () => import('./pages/SocialB5'),
      '/gestao': () => import('./pages/GestaoUsuarios'),
    };

    const importFn = componentMap[to];
    if (importFn) {
      importFn().catch(() => { }); // Silent catch, just prefetching
    }
  };

  return (
    <NavLink
      to={to}
      onMouseEnter={prefetch}
      onClick={onNavigate}
      className={({ isActive }) => `w-full flex items-center gap-3 px-4 py-3 rounded-lg border-l-4 transition-all group ${isActive
        ? 'bg-white/10 border-primary text-white shadow-sm'
        : 'hover:bg-white/5 border-transparent text-gray-400 hover:text-white'
        }`}
    >
      {({ isActive }) => (
        <>
          <span className={`material-symbols-outlined ${isActive ? 'text-primary' : ''}`}>{icon}</span>
          <span className={`text-sm font-medium tracking-wide ${isActive ? 'font-bold' : ''}`}>{label}</span>
        </>
      )}
    </NavLink>
  );
});

SidebarLink.displayName = 'SidebarLink';

// Bottom Navigation Item for mobile
const BottomNavItem = React.memo<{
  to: string;
  icon: string;
  label: string;
  onClick?: () => void;
}>(({ to, icon, label, onClick }) => {
  if (onClick) {
    // Special button (e.g. "Menu")
    return (
      <button
        onClick={onClick}
        className="flex flex-col items-center justify-center gap-0.5 flex-1 py-2 text-gray-400 transition-colors active:text-primary"
        aria-label={label}
      >
        <span className="material-symbols-outlined text-[22px]">{icon}</span>
        <span className="text-[9px] font-semibold uppercase tracking-wider">{label}</span>
      </button>
    );
  }

  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `flex flex-col items-center justify-center gap-0.5 flex-1 py-2 transition-colors ${isActive ? 'text-primary' : 'text-gray-400'}`
      }
      aria-label={label}
    >
      {({ isActive }) => (
        <>
          <span className={`material-symbols-outlined text-[22px] ${isActive ? 'filled' : ''}`}>{icon}</span>
          <span className="text-[9px] font-semibold uppercase tracking-wider">{label}</span>
        </>
      )}
    </NavLink>
  );
});

BottomNavItem.displayName = 'BottomNavItem';

const AppLayout: React.FC = () => {
  const { signOut, user, profile, profileError } = useAuth();
  const [isChangePasswordOpen, setIsChangePasswordOpen] = React.useState(false);
  const [sidebarAberta, setSidebarAberta] = React.useState(false);
  const userName = user?.email?.split('@')[0] || 'Usuário';
  const location = useLocation();

  // Close sidebar whenever route changes (mobile navigation)
  React.useEffect(() => {
    setSidebarAberta(false);
  }, [location.pathname]);

  const abrirSidebar = useCallback(() => setSidebarAberta(true), []);
  const fecharSidebar = useCallback(() => setSidebarAberta(false), []);

  // Prevent body scroll when sidebar is open on mobile
  React.useEffect(() => {
    if (sidebarAberta) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [sidebarAberta]);

  // Prevent infinite redirect loop if profile fails to load
  if (!profile) {

    return (
      <div className="flex h-screen w-screen bg-gray-100 items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center space-y-4">
          <div className="mx-auto bg-yellow-100 text-yellow-700 p-3 rounded-full w-fit">
            <span className="material-symbols-outlined text-4xl">warning</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-800">Perfil não Encontrado</h2>
          <p className="text-gray-600">
            Seu usuário foi autenticado, mas o perfil de acesso ainda não foi carregado.
            Isso pode acontecer se o cadastro for muito recente ou houver um erro de conexão.
          </p>

          {profileError && (
            <div className="bg-red-50 p-3 rounded text-left text-xs font-mono text-red-800 border border-red-200 overflow-auto max-h-32">
              <strong>Erro Técnico:</strong><br />
              Code: {profileError.code}<br />
              Message: {profileError.message}<br />
              Hint: {profileError.hint || 'Nenhum'}
            </div>
          )}

          <div className="flex gap-3 justify-center pt-4">
            <button onClick={() => window.location.reload()} className="px-4 py-2 bg-primary text-white font-bold rounded-lg hover:bg-primary/90 transition-colors" aria-label="Tentar novamente o carregamento do perfil">
              Tentar Novamente
            </button>
            <button onClick={signOut} className="px-4 py-2 border border-gray-300 font-bold rounded-lg hover:bg-gray-50 transition-colors">
              Sair
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full bg-gray-100 font-display overflow-hidden">

      {/* ── OVERLAY MOBILE ── Visible only when sidebar open on mobile */}
      {sidebarAberta && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={fecharSidebar}
          aria-hidden="true"
        />
      )}

      {/* ── SIDEBAR ── Fixed gaveta on mobile, relative on desktop */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-72 bg-sidebar-bg flex flex-col h-full flex-shrink-0 shadow-xl
          transition-transform duration-300 ease-in-out
          ${sidebarAberta ? 'translate-x-0' : '-translate-x-full'}
          md:relative md:translate-x-0 md:w-64
        `}
        aria-label="Menu de navegação"
      >
        {/* Sidebar Header */}
        <div className="p-6 flex items-center gap-3 border-b border-gray-700">
          <div
            className="bg-center bg-no-repeat bg-cover rounded-full size-12 shadow-md border-2 border-[#8B5A2B]"
            style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuBhhkhZqDlWCkshTqvj49ObzKfPKSTNrk8jLEZpSAaoyFHhzejl3L6l_g1NZkZ1gen8Ccn-QS-xmIystBvz0nu1WNiaYjR6bzF-KWFnnv8i2Urv0at8T9f6Hg63iDrqbXlk8h3V7o8n_Vmv3XOVphoOEnBGSIDkK--xG2SN7JQLLCSPmxhXDvnN0uylpKXjNigsF67qeaR9VnBDdq5rdbRO6xnEAV-CFm-cpQjJrc9-a2p3GCLfDptK5_wDNtMtVoHgBNvUPuycbYU")' }}
          />
          <div className="flex flex-col flex-1">
            <h1 className="text-white text-base font-black leading-tight tracking-wide uppercase">Gestão Interna</h1>
            <h1 className="text-primary text-sm font-bold leading-tight tracking-wider uppercase">CBMSC Araquari</h1>
          </div>
          {/* NotificationBell shown inside sidebar on desktop; hidden on mobile (moved to header) */}
          <div className="hidden md:block">
            <NotificationBell />
          </div>
          {/* Close button for mobile */}
          <button
            onClick={fecharSidebar}
            className="md:hidden p-1 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/10"
            aria-label="Fechar menu"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Navigation links */}
        <nav className="flex-1 overflow-y-auto py-6 flex flex-col gap-2 px-3">
          {profile?.is_manager && (
            <SidebarLink to="/gestao" icon="admin_panel_settings" label="GESTÃO DE ACESSOS" onNavigate={fecharSidebar} />
          )}
          {profile?.p_avisos && <SidebarLink to="/avisos" icon="notifications_active" label="AVISOS" onNavigate={fecharSidebar} />}
          {profile?.p_operacional && <SidebarLink to="/operacional" icon="assignment" label="OPERACIONAL" onNavigate={fecharSidebar} />}
          {profile?.p_ssci && <SidebarLink to="/ssci" icon="gavel" label="SSCI" onNavigate={fecharSidebar} />}
          {profile?.p_pessoal && <SidebarLink to="/pessoal" icon="groups" label="B1 - PESSOAL" onNavigate={fecharSidebar} />}
          {profile?.p_instrucao && <SidebarLink to="/instrucao" icon="menu_book" label="B3 - INSTRUÇÃO" onNavigate={fecharSidebar} />}
          {profile?.p_logistica && <SidebarLink to="/logistica" icon="local_shipping" label="B4 - LOGÍSTICA" onNavigate={fecharSidebar} />}
          {profile?.p_social && <SidebarLink to="/social" icon="campaign" label="B5 - REL. PÚBLICAS" onNavigate={fecharSidebar} />}
        </nav>

        {/* Sidebar Footer — user actions */}
        <div className="p-4 border-t border-gray-700 flex flex-col gap-2">
          <button onClick={() => setIsChangePasswordOpen(true)} className="w-full flex items-center gap-3 text-gray-400 hover:text-white cursor-pointer transition-colors px-2 py-2 rounded-lg hover:bg-white/5">
            <span className="material-symbols-outlined text-gray-400">lock</span>
            <div className="flex flex-col items-start">
              <span className="text-sm font-bold">Alterar Senha</span>
              <span className="text-[10px] opacity-50">Segurança da conta</span>
            </div>
          </button>

          <button onClick={signOut} className="w-full flex items-center gap-3 text-gray-400 hover:text-white cursor-pointer transition-colors px-2 py-2 rounded-lg hover:bg-white/5">
            <span className="material-symbols-outlined">logout</span>
            <div className="flex flex-col items-start">
              <span className="text-sm font-bold">Sair do Sistema</span>
              <span className="text-[10px] opacity-50">{userName}</span>
            </div>
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT AREA ── */}
      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">

        {/* ── MOBILE HEADER ── Only visible on mobile (md:hidden) */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-sidebar-bg border-b border-gray-700 sticky top-0 z-30 flex-shrink-0">
          {/* Hambúrguer */}
          <button
            id="btn-abrir-menu-mobile"
            onClick={abrirSidebar}
            className="p-2 text-gray-300 hover:text-white rounded-lg hover:bg-white/10 transition-colors active:bg-white/20"
            aria-label="Abrir menu de navegação"
            aria-expanded={sidebarAberta}
          >
            <span className="material-symbols-outlined text-[26px]">menu</span>
          </button>

          {/* Logo / Title */}
          <div className="flex flex-col items-center">
            <span className="text-white text-xs font-black leading-tight tracking-wide uppercase">Gestão Interna</span>
            <span className="text-primary text-[10px] font-bold leading-tight tracking-wider uppercase">CBMSC Araquari</span>
          </div>

          {/* Notifications on mobile header */}
          <NotificationBell />
        </header>

        {/* ── ROUTE CONTENT ── */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-gray-100 relative pb-16 md:pb-0">
          <RouteErrorBoundary>
            <Suspense fallback={<LoadingFallback />}>
              <Routes>
                <Route path="/" element={<Navigate to="/avisos" replace />} />

                {profile?.is_manager && <Route path="/gestao" element={<GestaoUsuarios />} />}

                <Route path="/avisos" element={profile?.p_avisos ? <DashboardAvisos /> : <Navigate to="/" replace />} />
                <Route path="/operacional" element={profile?.p_operacional ? <Operacional /> : <Navigate to="/" replace />} />
                <Route path="/ssci" element={profile?.p_ssci ? <SSCI /> : <Navigate to="/" replace />} />
                <Route path="/pessoal" element={profile?.p_pessoal ? <PessoalB1 /> : <Navigate to="/" replace />} />
                <Route path="/instrucao" element={profile?.p_instrucao ? <InstrucaoB3 /> : <Navigate to="/" replace />} />
                <Route path="/logistica" element={profile?.p_logistica ? <PatrimonioB4 /> : <Navigate to="/" replace />} />
                <Route path="/social" element={profile?.p_social ? <SocialB5 /> : <Navigate to="/" replace />} />

                <Route path="*" element={<Navigate to="/avisos" replace />} />
              </Routes>
            </Suspense>
          </RouteErrorBoundary>
        </main>

        {/* ── BOTTOM NAVIGATION (mobile only) ── */}
        <nav
          className="md:hidden fixed bottom-0 left-0 right-0 z-30 flex items-stretch bg-sidebar-bg border-t border-gray-700 safe-area-bottom"
          aria-label="Navegação rápida"
        >
          {profile?.p_avisos && (
            <BottomNavItem to="/avisos" icon="notifications_active" label="Avisos" />
          )}
          {profile?.p_operacional && (
            <BottomNavItem to="/operacional" icon="assignment" label="Operacional" />
          )}
          {profile?.p_pessoal && (
            <BottomNavItem to="/pessoal" icon="groups" label="B1" />
          )}
          {profile?.p_logistica && (
            <BottomNavItem to="/logistica" icon="local_shipping" label="B4" />
          )}
          <BottomNavItem to="" icon="grid_view" label="Menu" onClick={abrirSidebar} />
        </nav>
      </div>

      <ChangePasswordModal isOpen={isChangePasswordOpen} onClose={() => setIsChangePasswordOpen(false)} />
    </div>
  );
};

// Component to handle Auth state logic
const ProtectedApp: React.FC = () => {
  const { session, profile, loading, signOut, isPasswordRecovery } = useAuth();

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-900">
        <div className="flex flex-col items-center gap-4">
          <span className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></span>
          <p className="text-white font-bold animate-pulse">Carregando Sistema...</p>
        </div>
      </div>
    );
  }

  if (isPasswordRecovery) {
    return (
      <Suspense fallback={<LoadingFallback message="Carregando recuperação..." />}>
        <ResetPassword />
      </Suspense>
    );
  }

  if (!session) {
    return (
      <Suspense fallback={<LoadingFallback message="Carregando login..." />}>
        <Login />
      </Suspense>
    );
  }

  // Profile loaded and status is not 'ativo' — block access
  if (profile && profile.status && profile.status !== 'ativo') {
    signOut();
    return (
      <Suspense fallback={<LoadingFallback message="Carregando login..." />}>
        <Login />
      </Suspense>
    );
  }

  return <AppLayout />;
}

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" richColors />
        <RouteErrorBoundary>
          <Routes>
            <Route
              path="/bc-intencao"
              element={
                <Suspense fallback={<LoadingFallback message="Carregando formulário de intenção..." />}>
                  <BcIntencaoPublica />
                </Suspense>
              }
            />
            <Route
              path="/extrato/:tipo/:id"
              element={
                <Suspense fallback={<LoadingFallback message="Carregando extrato público..." />}>
                  <ExtratoPublico />
                </Suspense>
              }
            />
            <Route
              path="/extrato/compartimento/:id"
              element={
                <Suspense fallback={<LoadingFallback message="Carregando extrato público do compartimento..." />}>
                  <ExtratoPublico />
                </Suspense>
              }
            />
            <Route
              path="/solicitar-apoio"
              element={
                <Suspense fallback={<LoadingFallback message="Carregando formulário de solicitação de apoio..." />}>
                  <SolicitarApoioPublico />
                </Suspense>
              }
            />
            {/* Public OAuth callback — must be before /* to avoid ProtectedApp */}
            <Route
              path="/auth/callback"
              element={
                <Suspense fallback={<LoadingFallback message="Verificando acesso..." />}>
                  <AuthCallback />
                </Suspense>
              }
            />
            <Route
              path="/acesso-pendente"
              element={
                <Suspense fallback={<LoadingFallback message="Carregando..." />}>
                  <AcessoPendente />
                </Suspense>
              }
            />
            <Route path="/*" element={<ProtectedApp />} />
          </Routes>
        </RouteErrorBoundary>
      </AuthProvider>
      <InstallBanner />
    </BrowserRouter>
  );
};

export default App;