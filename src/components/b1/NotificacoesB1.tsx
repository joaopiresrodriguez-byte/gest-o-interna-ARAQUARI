import React, { useState, useEffect, useCallback } from 'react';
import { PersonnelService } from '../../services/personnelService';
import { InternalNotification } from '../../services/types';
import { toast } from 'sonner';

export default function NotificacoesB1() {
    const [notifications, setNotifications] = useState<InternalNotification[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
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
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                    <h3 className="text-base font-semibold text-primary-text">Notificações Internas</h3>
                    <p className="text-xs text-secondary-text mt-0.5">
                        {unreadCount > 0 ? <span className="text-cbm-red font-medium">{unreadCount} não lida{unreadCount > 1 ? 's' : ''}</span> : 'Todas lidas'}
                        {' · '}{notifications.length} no total
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                        <button onClick={handleMarkAllRead}
                            className="text-xs px-3 py-1.5 bg-secondary border border-rustic-border rounded-lg text-secondary-text hover:text-primary-text transition-colors">
                            Marcar todas como lidas
                        </button>
                    )}
                    <button
                        onClick={() => setShowForm(v => !v)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-cbm-red text-white rounded-lg text-sm font-medium hover:bg-opacity-90 transition-opacity"
                    >
                        <span className="material-symbols-outlined text-base">{showForm ? 'close' : 'add'}</span>
                        {showForm ? 'Cancelar' : 'Nova Notificação'}
                    </button>
                </div>
            </div>

            {/* Compose form */}
            {showForm && (
                <form onSubmit={handleSend} className="bg-primary border border-rustic-border rounded-2xl p-4 space-y-3">
                    <h4 className="text-sm font-semibold text-primary-text">Enviar Notificação Interna</h4>
                    <div className="space-y-2">
                        <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                            placeholder="Título da notificação" maxLength={120}
                            className="w-full bg-secondary border border-rustic-border rounded-lg px-3 py-2 text-sm text-primary-text placeholder-secondary-text focus:outline-none focus:border-cbm-red" />
                        <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                            placeholder="Mensagem..." rows={3} maxLength={500}
                            className="w-full bg-secondary border border-rustic-border rounded-lg px-3 py-2 text-sm text-primary-text placeholder-secondary-text focus:outline-none focus:border-cbm-red resize-none" />
                    </div>
                    <div className="flex justify-end">
                        <button type="submit" disabled={saving}
                            className="px-4 py-2 bg-cbm-red text-white rounded-lg text-sm font-medium hover:bg-opacity-90 transition-opacity disabled:opacity-50">
                            {saving ? 'Enviando...' : 'Enviar'}
                        </button>
                    </div>
                </form>
            )}

            {/* Filter tabs */}
            <div className="flex gap-1 bg-secondary rounded-lg p-0.5 w-fit">
                {[{ key: 'all', label: 'Todas' }, { key: 'unread', label: `Não lidas${unreadCount > 0 ? ` (${unreadCount})` : ''}` }].map(f => (
                    <button key={f.key} onClick={() => setFilter(f.key as typeof filter)}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${filter === f.key ? 'bg-primary text-primary-text shadow-sm' : 'text-secondary-text hover:text-primary-text'}`}>
                        {f.label}
                    </button>
                ))}
            </div>

            {/* Notification list */}
            {loading ? (
                <div className="text-center py-8 text-secondary-text text-sm">Carregando...</div>
            ) : displayed.length === 0 ? (
                <div className="text-center py-10 text-secondary-text">
                    <span className="material-symbols-outlined text-4xl block mb-2 opacity-30">notifications_none</span>
                    <p className="text-sm">{filter === 'unread' ? 'Nenhuma notificação não lida' : 'Nenhuma notificação'}</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {displayed.map(n => (
                        <div key={n.id}
                            className={`bg-primary border rounded-xl p-3 flex items-start gap-3 transition-all cursor-pointer ${!n.is_read ? 'border-cbm-red/40 hover:border-cbm-red/60' : 'border-rustic-border hover:border-rustic-border/80'}`}
                            onClick={() => !n.is_read && n.id && handleMarkRead(n.id)}>
                            <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${!n.is_read ? 'bg-cbm-red' : 'bg-transparent'}`} />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                    <p className={`text-sm font-semibold truncate ${!n.is_read ? 'text-primary-text' : 'text-secondary-text'}`}>{n.title}</p>
                                    <span className="text-xs text-secondary-text shrink-0">{n.time_ago}</span>
                                </div>
                                <p className="text-xs text-secondary-text mt-0.5 line-clamp-2">{n.message}</p>
                                <p className="text-xs text-secondary-text/60 mt-1 flex items-center gap-1">
                                    <span className="material-symbols-outlined text-xs">label</span>
                                    {sourceEventLabel(n.source_event)}
                                    {!n.is_read && <span className="ml-1 text-cbm-red/70">· Clique para marcar como lida</span>}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
