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
import { AuthProvider, useAuth } from './context/AuthContext';
import { Toaster } from 'sonner';

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
  const { signOut, user } = useAuth();
  const userName = user?.email?.split('@')[0] || 'Usuário';

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
          <SidebarLink to="/avisos" icon="notifications_active" label="AVISOS" />
          <SidebarLink to="/operacional" icon="assignment" label="OPERACIONAL" />
          <SidebarLink to="/ssci" icon="gavel" label="SSCI" />
          <SidebarLink to="/pessoal" icon="groups" label="B1 - PESSOAL" />
          <SidebarLink to="/instrucao" icon="menu_book" label="B3 - INSTRUÇÃO" />
          <SidebarLink to="/logistica" icon="local_shipping" label="B4 - LOGÍSTICA" />
          <SidebarLink to="/social" icon="campaign" label="B5 - REL. PÚBLICAS" />
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
          <Route path="/avisos" element={<DashboardAvisos />} />
          <Route path="/operacional" element={<Operacional />} />
          <Route path="/ssci" element={<SSCI />} />
          <Route path="/pessoal" element={<PessoalB1 />} />
          <Route path="/instrucao" element={<InstrucaoB3 />} />
          <Route path="/logistica" element={<PatrimonioB4 />} />
          <Route path="/social" element={<SocialB5 />} />
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
        <ProtectedApp />
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;