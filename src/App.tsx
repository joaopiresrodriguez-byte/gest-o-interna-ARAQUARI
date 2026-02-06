import React from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import DashboardAvisos from './pages/DashboardAvisos';
import Operacional from './pages/Operacional';
import PessoalB1 from './pages/PessoalB1';
import InstrucaoB3 from './pages/InstrucaoB3';
import PatrimonioB4 from './pages/PatrimonioB4';
import SocialB5 from './pages/SocialB5';
import SSCI from './pages/SSCI';
import Login from './pages/Login';
import GestaoUsuarios from './pages/GestaoUsuarios';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Toaster } from 'sonner';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 flex flex-col items-center justify-center h-screen bg-red-50 text-red-900">
          <h1 className="text-2xl font-bold mb-4">Algo deu errado 😢</h1>
          <pre className="bg-white p-4 rounded border border-red-200 text-xs overflow-auto max-w-2xl">
            {this.state.error?.toString()}
            <br />
            <br />
            {this.state.error?.stack}
          </pre>
          <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-red-600 text-white rounded">
            Recarregar Página
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Sidebar Component
const SidebarLink = ({
  to,
  icon,
  label
}: {
  to: string;
  icon: string;
  label: string;
}) => (
  <NavLink
    to={to}
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

const AppLayout: React.FC = () => {
  const { signOut, user, profile } = useAuth();
  const userName = user?.email?.split('@')[0] || 'Usuário';

  // Prevent infinite redirect loop if profile fails to load
  if (!profile) {
    const { profileError } = useAuth();

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
            <button onClick={() => window.location.reload()} className="px-4 py-2 bg-primary text-white font-bold rounded-lg hover:bg-primary/90 transition-colors">
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
      {/* Sidebar - Global Navigation */}
      <aside className="w-64 bg-sidebar-bg flex flex-col h-full flex-shrink-0 shadow-xl relative z-50">
        <div className="p-6 flex items-center gap-3 border-b border-gray-700">
          <div
            className="bg-center bg-no-repeat bg-cover rounded-full size-12 shadow-md border-2 border-[#8B5A2B]"
            style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuBhhkhZqDlWCkshTqvj49ObzKfPKSTNrk8jLEZpSAaoyFHhzejl3L6l_g1NZkZ1gen8Ccn-QS-xmIystBvz0nu1WNiaYjR6bzF-KWFnnv8i2Urv0at8T9f6Hg63iDrqbXlk8h3V7o8n_Vmv3XOVphoOEnBGSIDkK--xG2SN7JQLLCSPmxhXDvnN0uylpKXjNigsF67qeaR9VnBDdq5rdbRO6xnEAV-CFm-cpQjJrc9-a2p3GCLfDptK5_wDNtMtVoHgBNvUPuycbYU")' }}
          />
          <div className="flex flex-col">
            <h1 className="text-white text-base font-black leading-tight tracking-wide uppercase">Gestão Interna</h1>
            <h1 className="text-primary text-sm font-bold leading-tight tracking-wider uppercase">CBMSC Araquari</h1>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-6 flex flex-col gap-2 px-3">
          {profile?.is_manager && (
            <SidebarLink to="/gestao" icon="admin_panel_settings" label="GESTÃO DE ACESSOS" />
          )}
          {profile?.p_avisos && <SidebarLink to="/avisos" icon="notifications_active" label="AVISOS" />}
          {profile?.p_operacional && <SidebarLink to="/operacional" icon="assignment" label="OPERACIONAL" />}
          {profile?.p_ssci && <SidebarLink to="/ssci" icon="gavel" label="SSCI" />}
          {profile?.p_pessoal && <SidebarLink to="/pessoal" icon="groups" label="B1 - PESSOAL" />}
          {profile?.p_instrucao && <SidebarLink to="/instrucao" icon="menu_book" label="B3 - INSTRUÇÃO" />}
          {profile?.p_logistica && <SidebarLink to="/logistica" icon="local_shipping" label="B4 - LOGÍSTICA" />}
          {profile?.p_social && <SidebarLink to="/social" icon="campaign" label="B5 - REL. PÚBLICAS" />}
        </nav>

        <div className="p-4 border-t border-gray-700">
          <button onClick={signOut} className="w-full flex items-center gap-3 text-gray-400 hover:text-white cursor-pointer transition-colors px-2 py-2 rounded-lg hover:bg-white/5">
            <span className="material-symbols-outlined">logout</span>
            <div className="flex flex-col items-start">
              <span className="text-sm font-bold">Sair do Sistema</span>
              <span className="text-[10px] opacity-50">{userName}</span>
            </div>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 h-full overflow-hidden bg-gray-100 relative">
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
      </main>
    </div>
  );
};

// Component to handle Auth state logic
const ProtectedApp: React.FC = () => {
  const { session, loading } = useAuth();

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

  if (!session) {
    return <Login />;
  }

  return <AppLayout />;
}

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" richColors />
        <ErrorBoundary>
          <ProtectedApp />
        </ErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;