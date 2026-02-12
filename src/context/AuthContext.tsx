import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../services/supabase';
import { Session, User } from '@supabase/supabase-js';

export interface UserProfile {
    id: string;
    email: string;
    is_manager: boolean;
    p_avisos: 'reader' | 'editor' | null;
    p_operacional: 'reader' | 'editor' | null;
    p_ssci: 'reader' | 'editor' | null;
    p_pessoal: 'reader' | 'editor' | null;
    p_instrucao: 'reader' | 'editor' | null;
    p_logistica: 'reader' | 'editor' | null;
    p_social: 'reader' | 'editor' | null;
}

interface AuthContextType {
    session: Session | null;
    user: User | null;
    profile: UserProfile | null;
    profileError: any; // Added for debugging
    loading: boolean;
    signOut: () => Promise<void>;
    refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    session: null,
    user: null,
    profile: null,
    profileError: null,
    loading: true,
    signOut: async () => { },
    refreshProfile: async () => { },
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [profileError, setProfileError] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const fetchProfile = async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) {
                console.error('Error fetching profile:', error);
                setProfileError(error);
                setProfile(null);
            } else {
                setProfile(data);
                setProfileError(null);
            }
        } catch (err) {
            console.error("Unexpected error in fetchProfile:", err);
            setProfileError(err);
        }
    };

    useEffect(() => {
        let mounted = true;

        const handleAuthChange = async (session: Session | null) => {
            if (!mounted) return;

            const currentUser = session?.user ?? null;
            setSession(session);
            setUser(currentUser);

            if (currentUser) {
                await fetchProfile(currentUser.id);
            } else {
                setProfile(null);
                setProfileError(null);
            }

            if (mounted) setLoading(false);
        };

        // Get initial session and start listener
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            console.log("Auth Event:", _event, session?.user?.email);
            handleAuthChange(session);
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, []);

    const refreshProfile = async () => {
        if (user) await fetchProfile(user.id);
    };

    const signOut = async () => {
        await supabase.auth.signOut();
    };

    return (
        <AuthContext.Provider value={{ session, user, profile, profileError, loading, signOut, refreshProfile }}>
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
