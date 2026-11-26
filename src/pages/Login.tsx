import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { DEFAULT_TENANT_ID } from '../config/tenant';

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

interface OrgOption {
    id: string;
    name: string;
}

const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [viewMode, setViewMode] = useState<ViewMode>('login');
    const [signupType, setSignupType] = useState<'existing' | 'new_org'>('existing');
    const [newOrgName, setNewOrgName] = useState('');
    const [newOrgStation, setNewOrgStation] = useState('');
    const [selectedOrgId, setSelectedOrgId] = useState<string>(DEFAULT_TENANT_ID);
    const [availableOrgs, setAvailableOrgs] = useState<OrgOption[]>([]);
    const [fullName, setFullName] = useState('');
    const [otpToken, setOtpToken] = useState('');
    const [showOtpInput, setShowOtpInput] = useState(false);

    React.useEffect(() => {
        // Carregar organizações disponíveis para novos colaboradores
        const loadOrgs = async () => {
            const { data } = await supabase
                .from('organizations')
                .select('id, name')
                .eq('is_active', true)
                .order('name');
            if (data && data.length > 0) {
                setAvailableOrgs(data);
                setSelectedOrgId(data[0].id);
            }
        };
        loadOrgs();
    }, []);

    React.useEffect(() => {
        const hash = window.location.hash;
        const params = new URLSearchParams(window.location.search);
        const erroParam = params.get('erro');

        if (hash.includes('error_code=otp_expired') || hash.includes('otp_expired') || hash.includes('invalid+or+has+expired')) {
            setError('⚠️ O link por clique expirou ou foi pré-verificado. Digite seu e-mail para reenviar ou insira o código de 6 dígitos recebido.');
            setViewMode('forgot');
            setShowOtpInput(true);
            window.history.replaceState(null, '', window.location.pathname);
        }

        if (erroParam === 'acesso_pendente') {
            setError('⏳ Seu acesso ainda está aguardando aprovação do gestor.');
            window.history.replaceState(null, '', window.location.pathname);
        } else if (erroParam === 'acesso_negado') {
            setError('🚫 Seu acesso foi desativado. Entre em contato com o gestor.');
            window.history.replaceState(null, '', window.location.pathname);
        }
    }, []);

    const handleLoginGoogle = async () => {
        setLoading(true);
        setError(null);
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
                queryParams: {
                    access_type: 'offline',
                    prompt: 'consent',
                },
            },
        });
        if (error) {
            setError(translateError(error.message || 'Erro ao iniciar login com Google.'));
            setLoading(false);
        }
        // On success, browser redirects — no need to setLoading(false)
    };

    const switchView = (mode: ViewMode) => {
        setError(null);
        setSuccess(null);
        setViewMode(mode);
        setShowOtpInput(false);
        setOtpToken('');
        // Reset campos de cadastro ao trocar de modo
        setSignupType('existing');
        setNewOrgName('');
        setNewOrgStation('');
        setFullName('');
        if (availableOrgs.length > 0) {
            setSelectedOrgId(availableOrgs[0].id);
        }
    };

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            if (viewMode === 'forgot') {
                const targetEmail = email.trim().toLowerCase();

                if (showOtpInput && otpToken.trim()) {
                    let cleanToken = otpToken.trim();
                    if (cleanToken.includes('token=')) {
                        const match = cleanToken.match(/token=([^&]+)/);
                        if (match) cleanToken = match[1];
                    }

                    // Validar código OTP diretamente
                    const { error } = await supabase.auth.verifyOtp({
                        email: targetEmail,
                        token: cleanToken,
                        type: 'recovery',
                    });
                    if (error) throw error;
                    setSuccess('Código verificado com sucesso! Carregando formulário para nova senha...');
                    return;
                }

                const redirectUrl = `${window.location.origin}`;
                console.log('Sending password reset email to:', targetEmail, 'redirectTo:', redirectUrl);
                const { error } = await supabase.auth.resetPasswordForEmail(targetEmail, {
                    redirectTo: redirectUrl,
                });
                if (error) throw error;
                setShowOtpInput(true);
                setSuccess(`E-mail de recuperação enviado para ${targetEmail}! Verifique sua caixa de entrada (ou insira abaixo o código de 6 dígitos recebido no e-mail).`);
            } else if (viewMode === 'signup') {
                if (signupType === 'new_org' && !newOrgName.trim()) {
                    throw new Error('Informe o nome da sua empresa ou corporação.');
                }

                // 1. Cadastrar usuário no Supabase Auth com metadados para a trigger
                const { data: authData, error: authError } = await supabase.auth.signUp({
                    email: email.trim().toLowerCase(),
                    password,
                    options: {
                        data: {
                            full_name: fullName.trim() || undefined,
                            is_new_org: signupType === 'new_org',
                            org_name: signupType === 'new_org' ? newOrgName.trim() : undefined,
                            org_station: signupType === 'new_org' ? newOrgStation.trim() : undefined,
                            target_org_id: signupType === 'existing' ? (selectedOrgId || DEFAULT_TENANT_ID) : undefined,
                        }
                    }
                });
                if (authError) throw authError;

                const newUserId = authData.user?.id;
                if (!newUserId) {
                    setSuccess('Cadastro realizado! Verifique seu email para confirmar a conta.');
                    return;
                }

                if (signupType === 'new_org') {
                    // Garantir que a organização foi criada (se não criada pela trigger, cria aqui)
                    let orgId: string | null = null;
                    const { data: existingOrg } = await supabase
                        .from('organizations')
                        .select('id')
                        .eq('name', newOrgName.trim())
                        .maybeSingle();

                    if (existingOrg) {
                        orgId = existingOrg.id;
                    } else {
                        const slug = newOrgName.trim().toLowerCase()
                            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                            .replace(/[^a-z0-9]/g, '-')
                            .replace(/-+/g, '-') + '-' + Math.random().toString(36).substring(2, 6);

                        const { data: orgData } = await supabase
                            .from('organizations')
                            .insert({
                                name: newOrgName.trim(),
                                slug,
                                plan_tier: 'pro',
                                is_active: true
                            })
                            .select('id')
                            .single();
                        orgId = orgData?.id || null;
                    }

                    if (orgId) {
                        // Criar ou garantir tenant_settings
                        await supabase.from('tenant_settings').upsert({
                            organization_id: orgId,
                            unit_name: newOrgName.trim(),
                            station_name: newOrgStation.trim() || 'Central',
                            primary_color: '#b91c1c',
                            secondary_color: '#78350f',
                        }, { onConflict: 'organization_id' });

                        // Criar ou Atualizar Profile como GESTOR e ATIVO da nova organização
                        await supabase.from('profiles').upsert({
                            id: newUserId,
                            email: email.trim().toLowerCase(),
                            full_name: fullName.trim() || null,
                            organization_id: orgId,
                            status: 'ativo',
                            is_manager: true,
                            role: 'gestor',
                            p_avisos: 'editor',
                            p_operacional: 'editor',
                            p_ssci: 'editor',
                            p_pessoal: 'editor',
                            p_instrucao: 'editor',
                            p_logistica: 'editor',
                            p_social: 'editor',
                            provider: 'email',
                            created_at: new Date().toISOString()
                        }, { onConflict: 'id' });

                        setSuccess('Sua Organização foi criada com sucesso! Faça login para começar a gerenciar.');
                        setViewMode('login');
                        return;
                    }
                } else {
                    // Colaborador de organização existente: vincula ao tenant selecionado com status pendente
                    const targetOrg = selectedOrgId || DEFAULT_TENANT_ID;
                    await supabase.from('profiles').upsert({
                        id: newUserId,
                        email: email.trim().toLowerCase(),
                        full_name: fullName.trim() || null,
                        organization_id: targetOrg,
                        status: 'pendente',
                        is_manager: false,
                        role: 'operador',
                        provider: 'email',
                        created_at: new Date().toISOString()
                    }, { onConflict: 'id' });
                }

                setSuccess('Cadastro realizado! Sua solicitação será avaliada pelo gestor da sua unidade.');
                setViewMode('login');
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
            case 'forgot': return showOtpInput && otpToken ? 'Verificar Código' : 'Recuperar Senha';
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

                    {viewMode === 'signup' && (
                        <div className="bg-stone-100 p-1.5 rounded-xl flex gap-1 border border-stone-200">
                            <button
                                type="button"
                                onClick={() => setSignupType('existing')}
                                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
                                    signupType === 'existing'
                                        ? 'bg-white text-stone-900 shadow-xs'
                                        : 'text-stone-500 hover:text-stone-900'
                                }`}
                            >
                                Entrar em Unidade
                            </button>
                            <button
                                type="button"
                                onClick={() => setSignupType('new_org')}
                                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
                                    signupType === 'new_org'
                                        ? 'bg-primary text-white shadow-xs'
                                        : 'text-stone-500 hover:text-stone-900'
                                }`}
                            >
                                Criar Nova Organização
                            </button>
                        </div>
                    )}

                    {viewMode === 'signup' && signupType === 'existing' && availableOrgs.length > 0 && (
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">
                                Selecione a Organização / Unidade
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 material-symbols-outlined">corporate_fare</span>
                                <select
                                    value={selectedOrgId}
                                    onChange={e => setSelectedOrgId(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-medium text-gray-700 text-sm"
                                >
                                    {availableOrgs.map(org => (
                                        <option key={org.id} value={org.id}>
                                            {org.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}

                    {viewMode === 'signup' && signupType === 'new_org' && (
                        <div className="bg-red-50/70 p-3.5 rounded-xl border border-red-200 space-y-3">
                            <div>
                                <label className="block text-xs font-black text-red-900 uppercase mb-1">
                                    Nome da Empresa / Corporação
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ex: Bombeiros Voluntários de Joinville"
                                    value={newOrgName}
                                    onChange={e => setNewOrgName(e.target.value)}
                                    className="w-full px-3 py-2 bg-white border border-red-200 rounded-lg text-xs font-bold text-stone-800 outline-none focus:ring-2 focus:ring-primary/20"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black text-red-900 uppercase mb-1">
                                    Unidade / Posto (Opcional)
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ex: Sede Central ou 1º Pelotão"
                                    value={newOrgStation}
                                    onChange={e => setNewOrgStation(e.target.value)}
                                    className="w-full px-3 py-2 bg-white border border-red-200 rounded-lg text-xs font-bold text-stone-800 outline-none focus:ring-2 focus:ring-primary/20"
                                />
                            </div>
                        </div>
                    )}

                    {viewMode === 'signup' && (
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Nome Completo</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 material-symbols-outlined">person</span>
                                <input
                                    type="text"
                                    required
                                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-medium text-gray-700 placeholder-gray-400"
                                    placeholder="Seu nome"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                />
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">
                            {signupType === 'new_org' && viewMode === 'signup' ? 'Email do Gestor / Empresa' : 'Email Institucional'}
                        </label>
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

                    {viewMode === 'forgot' && showOtpInput && (
                        <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 space-y-2">
                            <label className="block text-xs font-bold text-amber-900 uppercase">
                                Código de Segurança (6 dígitos / Token)
                            </label>
                            <p className="text-[11px] text-amber-800 leading-tight">
                                Se o link no e-mail expirar devido a filtros de segurança, digite aqui o código de 6 dígitos recebido no e-mail:
                            </p>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 material-symbols-outlined">pin</span>
                                <input
                                    type="text"
                                    maxLength={10}
                                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all font-mono font-bold text-gray-800 tracking-widest placeholder-gray-400"
                                    placeholder="Digite o código"
                                    value={otpToken}
                                    onChange={(e) => setOtpToken(e.target.value)}
                                />
                            </div>
                        </div>
                    )}

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

                {/* Google OAuth — only shown on login view */}
                {viewMode === 'login' && (
                    <div className="mt-5">
                        <div className="flex items-center gap-3 my-4">
                            <div className="flex-1 h-px bg-gray-200" />
                            <span className="text-xs text-gray-400 font-medium whitespace-nowrap">ou continue com</span>
                            <div className="flex-1 h-px bg-gray-200" />
                        </div>

                        <button
                            id="btn-login-google"
                            type="button"
                            onClick={handleLoginGoogle}
                            disabled={loading}
                            className="w-full py-3 px-4 flex items-center justify-center gap-3 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md hover:border-gray-300 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {/* Google official SVG icon */}
                            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                                <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" />
                                <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" />
                                <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332Z" />
                                <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58Z" />
                            </svg>
                            <span className="text-sm font-semibold text-gray-700">Entrar com Google</span>
                        </button>
                    </div>
                )}

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
