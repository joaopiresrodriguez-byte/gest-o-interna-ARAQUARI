import React, { useState } from 'react';
import { supabase } from '../services/supabase';

// Maps Supabase error messages to user-friendly Portuguese
const translateError = (msg: string): string => {
    const map: Record<string, string> = {
        'Invalid login credentials': 'Email ou senha incorretos.',
        'Email not confirmed': 'Email não confirmado. Verifique sua caixa de entrada.',
        'User already registered': 'Este email já possui uma conta cadastrada.',
        'Password should be at least 6 characters': 'A senha deve ter no mínimo 6 caracteres.',
        'Signup requires a valid password': 'Informe uma senha válida.',
        'Email rate limit exceeded': 'Muitas tentativas. Aguarde alguns minutos.',
        'For security purposes, you can only request this after': 'Muitas tentativas. Aguarde alguns minutos.',
    };
    for (const [key, value] of Object.entries(map)) {
        if (msg.includes(key)) return value;
    }
    if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('fetch')) {
        return 'Erro de conexão com o servidor. Verifique sua internet e tente novamente.';
    }
    return msg;
};

type ViewMode = 'login' | 'signup' | 'forgot';

const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [viewMode, setViewMode] = useState<ViewMode>('login');

    const switchView = (mode: ViewMode) => {
        setError(null);
        setSuccess(null);
        setViewMode(mode);
    };

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            if (viewMode === 'forgot') {
                const { error } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: `${window.location.origin}/`,
                });
                if (error) throw error;
                setSuccess('Email de recuperação enviado! Verifique sua caixa de entrada.');
            } else if (viewMode === 'signup') {
                const { error } = await supabase.auth.signUp({ email, password });
                if (error) throw error;
                setSuccess('Cadastro realizado! Verifique seu email para confirmar a conta.');
            } else {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
            }
        } catch (err: any) {
            setError(translateError(err.message || 'Erro inesperado. Tente novamente.'));
        } finally {
            setLoading(false);
        }
    };

    const getTitle = () => {
        switch (viewMode) {
            case 'signup': return 'Criar Conta';
            case 'forgot': return 'Recuperar Senha';
            default: return 'Acessar Sistema';
        }
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center relative bg-gray-900 overflow-hidden">
            {/* Background Image with Overlay */}
            <div
                className="absolute inset-0 z-0 bg-cover bg-center"
                style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1555529733-0e670560f7e1?q=80&w=2670&auto=format&fit=crop")' }}
            >
                <div className="absolute inset-0 bg-gradient-to-tr from-red-900/90 to-black/60 backdrop-blur-[2px]"></div>
            </div>

            {/* Login Card */}
            <div className="relative z-10 w-full max-w-md p-8 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 animate-in fade-in zoom-in duration-500">
                <div className="flex flex-col items-center mb-8">
                    <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center mb-4 shadow-lg border-4 border-red-100">
                        <span className="material-symbols-outlined text-4xl text-white">local_fire_department</span>
                    </div>
                    <h1 className="text-2xl font-black text-gray-800 uppercase tracking-tight text-center">Gestão Interna</h1>
                    <p className="text-sm font-bold text-primary uppercase tracking-widest">CBMSC Araquari</p>
                </div>

                <form onSubmit={handleAuth} className="flex flex-col gap-4">
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg flex items-center gap-2">
                            <span className="material-symbols-outlined text-lg flex-shrink-0">error</span>
                            <span>{error}</span>
                        </div>
                    )}

                    {success && (
                        <div className="p-3 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg flex items-center gap-2">
                            <span className="material-symbols-outlined text-lg flex-shrink-0">check_circle</span>
                            <span>{success}</span>
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Email Institucional</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 material-symbols-outlined">mail</span>
                            <input
                                type="email"
                                required
                                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-medium text-gray-700 placeholder-gray-400"
                                placeholder="nome@cbm.sc.gov.br"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                    </div>

                    {viewMode !== 'forgot' && (
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Senha</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 material-symbols-outlined">lock</span>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    className="w-full pl-10 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-medium text-gray-700 placeholder-gray-400"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                    tabIndex={-1}
                                >
                                    <span className="material-symbols-outlined text-xl">
                                        {showPassword ? 'visibility_off' : 'visibility'}
                                    </span>
                                </button>
                            </div>
                        </div>
                    )}

                    {viewMode === 'login' && (
                        <div className="flex justify-end -mt-2">
                            <button
                                type="button"
                                onClick={() => switchView('forgot')}
                                className="text-xs text-primary hover:underline font-medium"
                            >
                                Esqueceu a senha?
                            </button>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="mt-2 w-full py-3 bg-gradient-to-r from-red-700 to-red-600 hover:from-red-800 hover:to-red-700 text-white font-bold rounded-lg shadow-lg shadow-red-900/20 transform transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        ) : (
                            getTitle()
                        )}
                    </button>
                </form>

                <div className="mt-6 text-center text-xs text-gray-500 font-medium space-y-2">
                    {viewMode === 'login' && (
                        <p>Não tem acesso? <button onClick={() => switchView('signup')} className="text-primary hover:underline">Criar conta</button></p>
                    )}
                    {viewMode === 'signup' && (
                        <p>Já possui conta? <button onClick={() => switchView('login')} className="text-primary hover:underline">Fazer login</button></p>
                    )}
                    {viewMode === 'forgot' && (
                        <p>Lembrou a senha? <button onClick={() => switchView('login')} className="text-primary hover:underline">Voltar ao login</button></p>
                    )}
                </div>

                <div className="mt-8 text-center border-t border-gray-100 pt-4">
                    <p className="text-[10px] text-gray-400">© 2026 Corpo de Bombeiros Militar de Santa Catarina</p>
                </div>
            </div>
        </div>
    );
};

export default Login;
