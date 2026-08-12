import React, { useState, useEffect, useCallback } from 'react';
import { PersonnelService } from '../../services/personnelService';
import { InternalNotification } from '../../services/types';
import { toast } from 'sonner';

export default function NotificacoesB1() {
    const [notifications, setNotifications] = useState<InternalNotification[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [showAll, setShowAll] = useState(false);
    const [form, setForm] = useState({ title: '', message: '' });
    const [saving, setSaving] = useState(false);
    const [filter, setFilter] = useState<'all' | 'unread'>('all');

    const load = useCallback(async () => {
        setLoading(true);
        const data = await PersonnelService.getNotifications(100);
        setNotifications(data);
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleMarkRead = async (id: string) => {
        try {
            await PersonnelService.markAsRead(id);
            setNotifications(ns => ns.map(n => n.id === id ? { ...n, is_read: true } : n));
        } catch {
            toast.error('Erro ao marcar como lida');
        }
    };

    const handleMarkAllRead = async () => {
        try {
            await PersonnelService.markAllAsRead();
            setNotifications(ns => ns.map(n => ({ ...n, is_read: true })));
            toast.success('Todas marcadas como lidas');
        } catch {
            toast.error('Erro ao atualizar notificações');
        }
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.title.trim() || !form.message.trim()) {
            toast.error('Preencha título e mensagem');
            return;
        }
        setSaving(true);
        try {
            await PersonnelService.addNotification({
                title: form.title.trim(),
                message: form.message.trim(),
                source_event: 'manual',
                is_read: false,
            });
            toast.success('Notificação enviada');
            setShowForm(false);
            setForm({ title: '', message: '' });
            await load();
        } catch {
            toast.error('Erro ao enviar notificação');
        } finally {
            setSaving(false);
        }
    };

    const displayed = filter === 'unread' ? notifications.filter(n => !n.is_read) : notifications;
    const visibleDisplayed = showAll ? displayed : displayed.slice(0, 3);
    const unreadCount = notifications.filter(n => !n.is_read).length;

    const sourceEventLabel = (event: string) => {
        const labels: Record<string, string> = {
            manual: 'Manual',
            escala_publicada: 'Escala publicada',
            ferias_aprovadas: 'Férias aprovadas',
            troca_registrada: 'Troca registrada',
            qualificacao_expirando: 'Qualificação expirando',
            epi_vencendo: 'EPI vencendo',
        };
        return labels[event] || event;
    };

    return (
        <div className="space-y-4 text-white">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-white">notifications</span>
                        Avisos Internos
                        {unreadCount > 0 && (
                            <span className="w-5 h-5 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center">
                                {unreadCount}
                            </span>
                        )}
                    </h3>
                    <p className="text-xs text-white/80 mt-0.5">
                        {unreadCount > 0 ? (
                            <span className="text-red-300 font-bold">{unreadCount} não lida{unreadCount > 1 ? 's' : ''}</span>
                        ) : (
                            'Todas lidas'
                        )}
                        {' · '}{notifications.length} no total
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                        <button
                            onClick={handleMarkAllRead}
                            className="text-xs px-3 py-1.5 bg-stone-800 border border-stone-700 rounded-lg text-white hover:bg-stone-700 transition-colors font-medium"
                        >
                            Marcar todas como lidas
                        </button>
                    )}
                    <button
                        onClick={() => setShowForm(v => !v)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-colors shadow-sm"
                    >
                        <span className="material-symbols-outlined text-base">{showForm ? 'close' : 'add'}</span>
                        {showForm ? 'Cancelar' : 'Nova Notificação'}
                    </button>
                </div>
            </div>

            {/* Compose form */}
            {showForm && (
                <form onSubmit={handleSend} className="bg-stone-800/90 border border-stone-700 rounded-2xl p-4 space-y-3">
                    <h4 className="text-sm font-bold text-white">Enviar Notificação Interna</h4>
                    <div className="space-y-2">
                        <input
                            type="text"
                            value={form.title}
                            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                            placeholder="Título da notificação"
                            maxLength={120}
                            className="w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-2 text-sm text-white placeholder-white/50 focus:outline-none focus:border-red-500"
                        />
                        <textarea
                            value={form.message}
                            onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                            placeholder="Mensagem..."
                            rows={3}
                            maxLength={500}
                            className="w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-2 text-sm text-white placeholder-white/50 focus:outline-none focus:border-red-500 resize-none"
                        />
                    </div>
                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-colors disabled:opacity-50"
                        >
                            {saving ? 'Enviando...' : 'Enviar'}
                        </button>
                    </div>
                </form>
            )}

            {/* Filter tabs */}
            <div className="flex gap-1 bg-stone-800 rounded-lg p-0.5 w-fit">
                {[
                    { key: 'all', label: 'Todas' },
                    { key: 'unread', label: `Não lidas${unreadCount > 0 ? ` (${unreadCount})` : ''}` }
                ].map(f => (
                    <button
                        key={f.key}
                        onClick={() => setFilter(f.key as typeof filter)}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                            filter === f.key ? 'bg-red-600 text-white shadow-sm' : 'text-white/70 hover:text-white'
                        }`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {/* Notification list */}
            {loading ? (
                <div className="text-center py-8 text-white/70 text-sm">Carregando...</div>
            ) : displayed.length === 0 ? (
                <div className="text-center py-10 text-white/60">
                    <span className="material-symbols-outlined text-4xl block mb-2 opacity-60 text-white">notifications_none</span>
                    <p className="text-sm font-medium text-white">{filter === 'unread' ? 'Nenhuma notificação não lida' : 'Nenhuma notificação'}</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {visibleDisplayed.map(n => (
                        <div
                            key={n.id}
                            className={`bg-stone-800/90 border rounded-xl p-3.5 flex items-start gap-3 transition-all cursor-pointer ${
                                !n.is_read ? 'border-red-500/60 bg-stone-800 hover:border-red-400' : 'border-stone-700/80 hover:border-stone-600'
                            }`}
                            onClick={() => !n.is_read && n.id && handleMarkRead(n.id)}
                        >
                            <div className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${!n.is_read ? 'bg-red-500 shadow-sm' : 'bg-transparent'}`} />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                    <p className="text-sm font-bold text-white truncate">{n.title}</p>
                                    <span className="text-[10px] text-white/70 shrink-0 font-semibold">{n.time_ago}</span>
                                </div>
                                <p className="text-xs text-white/90 mt-1 leading-relaxed line-clamp-2">{n.message}</p>
                                <p className="text-[10px] text-white/70 mt-1.5 flex items-center gap-1 font-medium">
                                    <span className="material-symbols-outlined text-xs text-white/80">label</span>
                                    {sourceEventLabel(n.source_event)}
                                    {!n.is_read && <span className="ml-1 text-red-300 font-bold">· Clique para marcar como lida</span>}
                                </p>
                            </div>
                        </div>
                    ))}

                    {displayed.length > 3 && (
                        <div className="text-center pt-2">
                            <button
                                onClick={() => setShowAll(!showAll)}
                                className="inline-flex items-center gap-1.5 px-4 py-2 bg-stone-800 hover:bg-stone-700 text-white rounded-xl text-xs font-bold transition-all border border-stone-700 shadow-sm"
                            >
                                <span className="material-symbols-outlined text-base text-white">
                                    {showAll ? 'expand_less' : 'expand_more'}
                                </span>
                                {showAll ? 'Ver menos' : `Ver mais (${displayed.length - 3} restantes)`}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
