import React, { useState } from 'react';
import { supabase } from '../services/supabase';

const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSignUp, setIsSignUp] = useState(false); // Toggle between Login and Sign Up

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (isSignUp) {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                });
                if (error) throw error;
                alert('Cadastro realizado! Verifique seu email para confirmar.');
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
            }
        } catch (err: any) {
            setError(err.message || 'Erro na autenticação');
        } finally {
            setLoading(false);
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
                            <span className="material-symbols-outlined text-lg">error</span>
                            {error}
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

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Senha</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 material-symbols-outlined">lock</span>
                            <input
                                type="password"
                                required
                                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-medium text-gray-700 placeholder-gray-400"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="mt-2 w-full py-3 bg-gradient-to-r from-red-700 to-red-600 hover:from-red-800 hover:to-red-700 text-white font-bold rounded-lg shadow-lg shadow-red-900/20 transform transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        ) : (
                            isSignUp ? 'Criar Conta' : 'Acessar Sistema'
                        )}
                    </button>
                </form>

                <div className="mt-6 text-center text-xs text-gray-500 font-medium">
                    {isSignUp ? (
                        <p>Já possui conta? <button onClick={() => setIsSignUp(false)} className="text-primary hover:underline">Fazer login</button></p>
                    ) : (
                        <p>Não tem acesso? <button onClick={() => setIsSignUp(true)} className="text-primary hover:underline">Criar conta</button></p>
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
