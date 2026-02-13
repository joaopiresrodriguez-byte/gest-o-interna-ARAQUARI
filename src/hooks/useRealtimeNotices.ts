import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { PendingNotice } from '../services/SupabaseService';
import { toast } from 'sonner';

export const useRealtimeNotices = (initialNotices: PendingNotice[] = []) => {
    const [notices, setNotices] = useState<PendingNotice[]>(initialNotices);

    useEffect(() => {
        setNotices(initialNotices);
    }, [initialNotices]);

    useEffect(() => {
        const channel = supabase
            .channel('realtime_notices')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'avisos_pendencias',
                },
                (payload) => {
                    const newNotice = payload.new as PendingNotice;
                    setNotices((prev) => [newNotice, ...prev]);
                    toast.info('Nova pendência reportada!', {
                        description: newNotice.description,
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    return { notices, setNotices };
};
