import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';

// Handles the OAuth redirect from Google.
// Flow:
//   1. Read session from Supabase (auto-set after Google redirect)
//   2. Look up profile by session.user.id
//   3a. No profile  → create with status='pendente' → /acesso-pendente
//   3b. Profile, status!='ativo' → signOut → /login?erro=acesso_pendente
//   3c. Profile, status='ativo' → sync avatar if empty → /avisos
const AuthCallback: React.FC = () => {
    const navigate = useNavigate();
    const [statusMsg, setStatusMsg] = useState('Verificando acesso...');

    useEffect(() => {
        const handleCallback = async () => {
            // getSession picks up the tokens from the URL hash/query set by Supabase
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();

            if (sessionError || !session) {
                console.error('Callback: sem sessão ou erro', sessionError);
                navigate('/login');
                return;
            }

            setStatusMsg('Carregando perfil...');

            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .maybeSingle();

            if (profileError) {
                console.error('Callback: erro ao buscar perfil', profileError);
                navigate('/login');
                return;
            }

            // New Google user — create pending profile
            if (!profile) {
                setStatusMsg('Registrando solicitação de acesso...');
                const { error: insertError } = await supabase
                    .from('profiles')
                    .insert({
                        id: session.user.id,
                        email: session.user.email,
                        full_name: session.user.user_metadata?.full_name ?? null,
                        avatar_url: session.user.user_metadata?.avatar_url ?? null,
                        status: 'pendente',
                        provider: 'google',
                        is_manager: false,
                    });

                if (insertError) {
                    console.error('Callback: erro ao criar perfil pendente', insertError);
                }

                navigate('/acesso-pendente');
                return;
            }

            // Profile exists but not active
            if (profile.status !== 'ativo') {
                await supabase.auth.signOut();
                navigate('/login?erro=acesso_pendente');
                return;
            }

            // Active user — sync avatar from Google if profile has none (Bloco 5)
            if (
                !profile.avatar_url &&
                session.user.user_metadata?.avatar_url
            ) {
                await supabase
                    .from('profiles')
                    .update({ avatar_url: session.user.user_metadata.avatar_url })
                    .eq('id', session.user.id);
            }

            navigate('/avisos');
        };

        handleCallback();
    }, [navigate]);

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-gray-900">
            <div className="flex flex-col items-center gap-4">
                <span className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-white font-bold animate-pulse">{statusMsg}</p>
            </div>
        </div>
    );
};

export default AuthCallback;
