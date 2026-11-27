import React, { createContext, useState, useEffect, useContext } from 'react';
// accessibility: placeholder / aria-label - This file context does not render HTML forms directly.
import { supabase } from '../services/supabase';
import { Session, User } from '@supabase/supabase-js';
import { TenantSettings } from '../services/types';
import { DEFAULT_TENANT_SETTINGS, resolveTenantId } from '../config/tenant';

export interface UserProfile {
    id: string;
    organization_id?: string;
    email: string;
    is_manager: boolean;
    p_avisos: 'reader' | 'editor' | null;
    p_operacional: 'reader' | 'editor' | null;
    p_ssci: 'reader' | 'editor' | null;
    p_pessoal: 'reader' | 'editor' | null;
    p_instrucao: 'reader' | 'editor' | null;
    p_logistica: 'reader' | 'editor' | null;
    p_social: 'reader' | 'editor' | null;
    // Google OAuth fields
    avatar_url?: string | null;
    full_name?: string | null;
    status?: string;
    provider?: string;
    updated_at?: string | null;
}

interface AuthContextType {
    session: Session | null;
    user: User | null;
    profile: UserProfile | null;
    tenantSettings: TenantSettings;
    profileError: any; // Added for debugging
    loading: boolean;
    signOut: () => Promise<void>;
    refreshProfile: () => Promise<void>;
    refreshTenantSettings: () => Promise<void>;
    isPasswordRecovery: boolean;
    setIsPasswordRecovery: (val: boolean) => void;
}

const AuthContext = createContext<AuthContextType>({
    session: null,
    user: null,
    profile: null,
    tenantSettings: DEFAULT_TENANT_SETTINGS,
    profileError: null,
    loading: true,
    signOut: async () => { },
    refreshProfile: async () => { },
    refreshTenantSettings: async () => { },
    isPasswordRecovery: false,
    setIsPasswordRecovery: () => { },
});

// Limite de tempo de sessão: 24 horas (em milissegundos)
const SESSION_MAX_DURATION_MS = 24 * 60 * 60 * 1000;
const SESSION_START_KEY = 'cbmsc_session_start_time';

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [tenantSettings, setTenantSettings] = useState<TenantSettings>(DEFAULT_TENANT_SETTINGS);
    const [profileError, setProfileError] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

    const checkSessionExpiration = (): boolean => {
        const startTimeStr = localStorage.getItem(SESSION_START_KEY);
        if (!startTimeStr) return false;
        const startTime = parseInt(startTimeStr, 10);
        if (isNaN(startTime)) return false;
        const now = Date.now();
        if (now - startTime >= SESSION_MAX_DURATION_MS) {
            console.warn('[Segurança] Sessão atingiu o limite de 24 horas. Desconectando usuário...');
            localStorage.removeItem(SESSION_START_KEY);
            supabase.auth.signOut().catch(() => {});
            setSession(null);
            setUser(null);
            setProfile(null);
            return true;
        }
        return false;
    };

    const updateRootBrandTheme = (primary?: string, secondary?: string) => {
        if (typeof document === 'undefined') return;
        const root = document.documentElement;
        const brandColor = primary && primary.startsWith('#') ? primary : '#d81818';
        root.style.setProperty('--brand-primary', brandColor);
        // Gera variações úteis para sombras, bordas e efeitos
        root.style.setProperty('--brand-primary-light', brandColor + 'dd');
        root.style.setProperty('--brand-primary-dark', brandColor);
        if (secondary) {
            root.style.setProperty('--brand-secondary', secondary);
        }
    };

    const fetchTenantSettings = async (orgId?: string | null) => {
        try {
            const targetOrgId = resolveTenantId(orgId);
            const { data, error } = await supabase
                .from('tenant_settings')
                .select('*')
                .eq('organization_id', targetOrgId)
                .maybeSingle();

            if (!error && data) {
                const settings = {
                    ...DEFAULT_TENANT_SETTINGS,
                    ...data,
                    logo_url: data.logo_url || DEFAULT_TENANT_SETTINGS.logo_url,
                };
                setTenantSettings(settings);
                updateRootBrandTheme(settings.primary_color, settings.secondary_color);
            } else {
                setTenantSettings(DEFAULT_TENANT_SETTINGS);
                updateRootBrandTheme(DEFAULT_TENANT_SETTINGS.primary_color, DEFAULT_TENANT_SETTINGS.secondary_color);
            }
        } catch (err) {
            console.warn('Erro ao carregar tenant settings, usando padrão:', err);
            setTenantSettings(DEFAULT_TENANT_SETTINGS);
            updateRootBrandTheme(DEFAULT_TENANT_SETTINGS.primary_color, DEFAULT_TENANT_SETTINGS.secondary_color);
        }
    };

    const fetchProfile = async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .maybeSingle();

            if (error) {
                console.error('Error fetching profile:', error);
                setProfileError(error);
                setProfile(null);
                await fetchTenantSettings(null);
            } else {
                setProfile(data);
                setProfileError(null);
                await fetchTenantSettings(data?.organization_id);
            }
        } catch (err) {
            console.error("Unexpected error in fetchProfile:", err);
            setProfileError(err);
            await fetchTenantSettings(null);
        }
    };

    useEffect(() => {
        let mounted = true;

        const handleAuthChange = async (session: Session | null) => {
            if (!mounted) return;

            const currentUser = session?.user ?? null;

            // Se há usuário autenticado, verificar ou iniciar controle de 24 horas de sessão
            if (currentUser) {
                const isExpired = checkSessionExpiration();
                if (isExpired) return;

                if (!localStorage.getItem(SESSION_START_KEY)) {
                    localStorage.setItem(SESSION_START_KEY, Date.now().toString());
                }
            } else {
                localStorage.removeItem(SESSION_START_KEY);
            }

            setSession(session);
            setUser(currentUser);

            if (currentUser) {
                await fetchProfile(currentUser.id);
                // Registrar log de acesso do usuário no banco de dados
                // Buscar organization_id do perfil para garantir o isolamento tenant
                try {
                    const { data: profileData } = await supabase
                        .from('profiles')
                        .select('organization_id')
                        .eq('id', currentUser.id)
                        .maybeSingle();
                    if (profileData?.organization_id) {
                        await supabase.from('user_access_logs').insert({
                            user_id: currentUser.id,
                            user_email: currentUser.email || 'desconhecido@cbm.sc.gov.br',
                            accessed_at: new Date().toISOString(),
                            organization_id: profileData.organization_id,
                        });
                    }
                } catch (e) {
                    console.warn('Erro ao registrar log de acesso:', e);
                }
            } else {
                setProfile(null);
                setProfileError(null);
            }

            if (mounted) setLoading(false);
        };

        // Detect password recovery mode or error hash directly from URL hash
        const hash = window.location.hash;
        if (hash.includes('type=recovery')) {
            setIsPasswordRecovery(true);
        }

        // Get initial session explicitly to ensure loading state resolves
        supabase.auth.getSession().then(({ data: { session }, error }) => {
            if (error) {
                console.warn('Error fetching initial session:', error);
            }
            if (mounted) {
                handleAuthChange(session);
                setLoading(false);
            }
        }).catch(err => {
            console.error('Failed to get session:', err);
            if (mounted) setLoading(false);
        });

        // Start auth state listener
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            console.log("Auth Event:", _event, session?.user?.email);
            if (_event === 'SIGNED_IN') {
                localStorage.setItem(SESSION_START_KEY, Date.now().toString());
            } else if (_event === 'SIGNED_OUT') {
                localStorage.removeItem(SESSION_START_KEY);
            }

            if (_event === 'PASSWORD_RECOVERY') {
                setIsPasswordRecovery(true);
            }
            handleAuthChange(session);
        });

        // Intervalo periódico para expirar a sessão após 24h caso a aba fique aberta
        const sessionInterval = setInterval(() => {
            checkSessionExpiration();
        }, 60 * 1000); // Checa a cada 1 minuto

        return () => {
            mounted = false;
            clearInterval(sessionInterval);
            subscription.unsubscribe();
        };
    }, []);

    const refreshProfile = async () => {
        if (user) await fetchProfile(user.id);
    };

    const refreshTenantSettings = async () => {
        await fetchTenantSettings(profile?.organization_id);
    };

    const signOut = async () => {
        localStorage.removeItem(SESSION_START_KEY);
        await supabase.auth.signOut();
    };

    return (
        <AuthContext.Provider value={{ session, user, profile, tenantSettings, profileError, loading, signOut, refreshProfile, refreshTenantSettings, isPasswordRecovery, setIsPasswordRecovery }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
