import { useState, useEffect, useRef, useCallback } from 'react';
import { PersonnelService } from '../services/personnelService';
import { InternalNotification } from '../services/types';

export default function NotificationBell() {
    const [open, setOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [notifications, setNotifications] = useState<InternalNotification[]>([]);
    const [loading, setLoading] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);

    const loadCount = useCallback(async () => {
        try {
            const count = await PersonnelService.getUnreadCount();
            setUnreadCount(count);
        } catch { /* silent */ }
    }, []);

    const loadNotifications = useCallback(async () => {
        setLoading(true);
        try {
            const list = await PersonnelService.getNotifications(15);
            setNotifications(list);
            setUnreadCount(list.filter(n => !n.is_read).length);
        } catch { /* silent */ }
        setLoading(false);
    }, []);

    useEffect(() => {
        loadCount();
        const interval = setInterval(loadCount, 60000);
        return () => clearInterval(interval);
    }, [loadCount]);

    useEffect(() => {
        if (open) loadNotifications();
    }, [open, loadNotifications]);

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
        };
        if (open) document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    const handleMarkRead = async (id: string) => {
        try {
            await PersonnelService.markAsRead(id);
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch { /* silent */ }
    };

    const handleMarkAllRead = async () => {
        try {
            await PersonnelService.markAllAsRead();
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            setUnreadCount(0);
        } catch { /* silent */ }
    };

    const timeAgo = (dateStr: string) => {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'agora';
        if (mins < 60) return `${mins}min`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h`;
        const days = Math.floor(hours / 24);
        return `${days}d`;
    };

    return (
        <div ref={panelRef} className="relative">
            <button
                onClick={() => setOpen(v => !v)}
                className="relative p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/5"
                title="Notificações"
            >
                <span className="material-symbols-outlined text-xl">notifications</span>
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-red-600 text-white text-[9px] font-black flex items-center justify-center animate-pulse">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl z-[999] overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
                        <h4 className="text-sm font-bold text-white">Notificações</h4>
                        {unreadCount > 0 && (
                            <button onClick={handleMarkAllRead} className="text-[10px] text-primary hover:underline font-medium">
                                Marcar todas como lidas
                            </button>
                        )}
                    </div>
                    <div className="max-h-72 overflow-y-auto">
                        {loading ? (
                            <div className="text-center py-6 text-gray-500 text-xs">Carregando...</div>
                        ) : notifications.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                                <span className="material-symbols-outlined text-3xl block mb-1 opacity-30">notifications_off</span>
                                <p className="text-xs">Nenhuma notificação</p>
                            </div>
                        ) : (
                            notifications.map(n => (
                                <button
                                    key={n.id}
                                    onClick={() => !n.is_read && n.id && handleMarkRead(n.id)}
                                    className={`w-full text-left px-4 py-3 border-b border-gray-700/50 hover:bg-gray-700/50 transition-colors ${!n.is_read ? 'bg-gray-700/30' : ''}`}
                                >
                                    <div className="flex items-start gap-2">
                                        {!n.is_read && <span className="w-2 h-2 rounded-full bg-red-500 mt-1.5 shrink-0" />}
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-xs truncate ${!n.is_read ? 'font-bold text-white' : 'text-gray-300'}`}>{n.title}</p>
                                            <p className="text-[10px] text-gray-400 line-clamp-2 mt-0.5">{n.message}</p>
                                            <p className="text-[9px] text-gray-500 mt-1">{timeAgo(n.created_at || '')}</p>
                                        </div>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
