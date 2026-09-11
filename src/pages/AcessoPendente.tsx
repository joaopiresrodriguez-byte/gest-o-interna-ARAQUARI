import React from 'react';
import { supabase } from '../services/supabase';

// Displayed when a new Google user has no approved profile yet.
const AcessoPendente: React.FC = () => {
    const [email, setEmail] = React.useState<string | null>(null);

    React.useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            setEmail(user?.email ?? null);
        });
    }, []);

    const handleSair = async () => {
        await supabase.auth.signOut();
        window.location.href = '/login';
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center relative bg-gray-900 overflow-hidden">
            {/* Background with overlay */}
            <div
                className="absolute inset-0 z-0 bg-cover bg-center"
                style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1555529733-0e670560f7e1?q=80&w=2670&auto=format&fit=crop")' }}
            >
                <div className="absolute inset-0 bg-gradient-to-tr from-red-900/90 to-black/60 backdrop-blur-[2px]" />
            </div>

            {/* Card */}
            <div className="relative z-10 w-full max-w-md p-8 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 animate-in fade-in zoom-in duration-500">
                <div className="flex flex-col items-center mb-8">
                    <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center mb-4 shadow-lg border-4 border-red-100">
                        <span className="material-symbols-outlined text-4xl text-white">local_fire_department</span>
                    </div>
                    <h1 className="text-2xl font-black text-gray-800 uppercase tracking-tight text-center">
                        Gestão Interna
                    </h1>
                    <p className="text-sm font-bold text-primary uppercase tracking-widest">CBMSC Araquari</p>
                </div>

                {/* Status Icon */}
                <div className="flex justify-center mb-6">
                    <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center border-2 border-amber-200">
                        <span className="material-symbols-outlined text-3xl text-amber-500">schedule</span>
                    </div>
                </div>

                <div className="text-center space-y-3 mb-8">
                    <h2 className="text-xl font-black text-gray-800">Solicitação de Acesso Enviada</h2>
                    <p className="text-sm text-gray-600 leading-relaxed">
                        Seu acesso ao sistema está aguardando aprovação do gestor.
                        Você será notificado quando o acesso for liberado.
                    </p>

                    {email && (
                        <div className="mt-4 px-4 py-2 bg-gray-50 rounded-lg border border-gray-200 inline-flex items-center gap-2">
                            <span className="material-symbols-outlined text-gray-400 text-base">mail</span>
                            <span className="text-sm font-medium text-gray-600">{email}</span>
                        </div>
                    )}
                </div>

                <button
                    onClick={handleSair}
                    className="w-full py-3 bg-gradient-to-r from-red-700 to-red-600 hover:from-red-800 hover:to-red-700 text-white font-bold rounded-lg shadow-lg shadow-red-900/20 transform transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                    <span className="material-symbols-outlined text-lg">logout</span>
                    Sair
                </button>

                <div className="mt-6 text-center border-t border-gray-100 pt-4">
                    <p className="text-[10px] text-gray-400">© 2026 Corpo de Bombeiros Militar de Santa Catarina</p>
                </div>
            </div>
        </div>
    );
};

export default AcessoPendente;
