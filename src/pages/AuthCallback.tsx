import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';

// Handles the OAuth redirect from Google.
// Flow:
//   1. Read session from Supabase (auto-set after Google redirect)
//   2. Look up profile by EMAIL first (prevents duplicate pending users for existing email accounts)
//   3. Look up profile by ID second
//   4. New user without existing email/id -> create profile with status='pendente' -> /acesso-pendente
const AuthCallback: React.FC = () => {
    const navigate = useNavigate();
    const [statusMsg, setStatusMsg] = useState('Verificando acesso...');

    useEffect(() => {
        const handleCallback = async () => {
            const { data: { session }, error } = await supabase.auth.getSession();

            if (error || !session) {
                console.error('Callback: sem sessão ou erro', error);
                navigate('/login');
                return;
            }

            setStatusMsg('Carregando perfil...');
            const userEmail = session.user.email;
            const userId = session.user.id;
            const userMeta = session.user.user_metadata;

            if (!userEmail) {
                console.error('Callback: e-mail ausente na sessão');
                navigate('/login');
                return;
            }

            // PASSO 1: Buscar perfil pelo EMAIL
            const { data: profileByEmail } = await supabase
                .from('profiles')
                .select('*')
                .eq('email', userEmail)
                .maybeSingle();

            if (profileByEmail) {
                if (profileByEmail.status === 'pendente') {
                    await supabase.auth.signOut();
                    navigate('/login?erro=acesso_pendente');
                    return;
                }

                if (profileByEmail.status && profileByEmail.status !== 'ativo') {
                    await supabase.auth.signOut();
                    navigate('/login?erro=acesso_negado');
                    return;
                }

                // Se o ID mudou (novo login Google para conta já cadastrada por email)
                // atualizar o ID e dados do Google
                if (profileByEmail.id !== userId) {
                    await supabase
                        .from('profiles')
                        .update({
                            id: userId,
                            provider: 'google',
                            avatar_url: userMeta?.avatar_url || profileByEmail.avatar_url,
                            full_name: userMeta?.full_name || profileByEmail.full_name,
                            updated_at: new Date().toISOString()
                        })
                        .eq('email', userEmail);
                } else if (!profileByEmail.avatar_url && userMeta?.avatar_url) {
                    await supabase
                        .from('profiles')
                        .update({
                            avatar_url: userMeta.avatar_url,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', userId);
                }

                navigate('/avisos');
                return;
            }

            // PASSO 2: Buscar perfil pelo ID
            const { data: profileById } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .maybeSingle();

            if (profileById) {
                if (profileById.status && profileById.status !== 'ativo') {
                    await supabase.auth.signOut();
                    navigate('/login?erro=acesso_negado');
                    return;
                }
                navigate('/avisos');
                return;
            }

            // PASSO 3: Usuário completamente novo — criar perfil pendente
            setStatusMsg('Registrando solicitação de acesso...');
            await supabase
                .from('profiles')
                .insert({
                    id: userId,
                    email: userEmail,
                    full_name: userMeta?.full_name ?? null,
                    avatar_url: userMeta?.avatar_url ?? null,
                    status: 'pendente',
                    role: 'pendente',
                    provider: 'google',
                    is_manager: false,
                    created_at: new Date().toISOString()
                });

            navigate('/acesso-pendente');
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
