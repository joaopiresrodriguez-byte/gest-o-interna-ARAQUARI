
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Safe storage adapter to prevent "SecurityError" in restricted browsers
const safeStorage = {
    getItem: (key: string) => {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            console.warn('LocalStorage access denied', e);
            return null;
        }
    },
    setItem: (key: string, value: string) => {
        try {
            localStorage.setItem(key, value);
        } catch (e) {
            // QuotaExceededError or SecurityError
            console.warn('LocalStorage unavailable', e);
        }
    },
    removeItem: (key: string) => {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.warn('LocalStorage unavailable', e);
        }
    },
};

export const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        storage: safeStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
    }
});

