import { useMemo } from 'react';
import { Personnel, Vacation, B1Course, EpiDelivery, InternalNotification, AlertItem } from '../../services/types';

interface Props {
    personnelList: Personnel[];
    vacations: Vacation[];
    courses: B1Course[];
    epiDeliveries: EpiDelivery[];
    notifications: InternalNotification[];
    alerts: AlertItem[];
    onNavigate: (tab: string) => void;
}

interface KpiCard {
    title: string;
    value: string | number;
    subtitle: string;
    icon: string;
    color: string;
    tab?: string;
}

export default function DashboardComandante({ personnelList, vacations, courses, epiDeliveries, notifications, alerts, onNavigate }: Props) {
    const today = new Date().toISOString().split('T')[0];

    const stats = useMemo(() => {
        const totalPessoal = personnelList.length;
        const emFerias = vacations.filter(v => v.start_date <= today && today <= v.end_date && v.status !== 'cancelado').length;
        const afastados = personnelList.filter(p => p.status === 'Afastado' || p.status === 'Licença').length;
        const disponiveis = totalPessoal - emFerias - afastados;
        const criticalAlerts = alerts.filter(a => a.severity === 'critical').length;
        const warningAlerts = alerts.filter(a => a.severity === 'warning').length;
        const expiredCourses = courses.filter(c => c.expiry_date && new Date(c.expiry_date) <= new Date()).length;
        const overdueEpi = epiDeliveries.filter(e => e.replacement_date && new Date(e.replacement_date) <= new Date()).length;
        const unreadNotifications = notifications.filter(n => !n.is_read).length;
        return { totalPessoal, emFerias, afastados, disponiveis, criticalAlerts, warningAlerts, expiredCourses, overdueEpi, unreadNotifications };
    }, [personnelList, vacations, courses, epiDeliveries, notifications, alerts, today]);

    // Cores fixas por card — não usar bg-primary (vermelho CBMSC)
    const kpis: KpiCard[] = [
        { title: 'Efetivo Total',     value: stats.totalPessoal,        subtitle: 'militares cadastrados',                                           icon: 'groups',         color: 'kpi-slate',   tab: 'EFETIVO' },
        { title: 'Disponíveis Hoje', value: stats.disponiveis,          subtitle: `${stats.emFerias} em férias · ${stats.afastados} afastados`,       icon: 'check_circle',   color: 'kpi-green',   tab: 'DISPONIBILIDADE' },
        { title: 'Alertas Críticos', value: stats.criticalAlerts,       subtitle: `${stats.warningAlerts} avisos`,                                    icon: 'warning',        color: 'kpi-red',     tab: 'ALERTAS' },
        { title: 'Notificações',     value: stats.unreadNotifications,  subtitle: `${notifications.length} total · ${stats.unreadNotifications} não lidas`, icon: 'notifications',  color: 'kpi-blue',    tab: 'NOTIFICACOES' },
        { title: 'Qualificações',    value: courses.length,             subtitle: `${stats.expiredCourses} expiradas`,                               icon: 'school',         color: stats.expiredCourses > 0 ? 'kpi-amber' : 'kpi-slate', tab: 'CURSOS' },
        { title: 'BMs e Licenças',   value: stats.emFerias + stats.afastados, subtitle: `${stats.emFerias} férias · ${stats.afastados} afastados`,   icon: 'beach_access',   color: 'kpi-orange',  tab: 'FERIAS' },
    ];

    const criticalAlertsList = alerts.filter(a => a.severity === 'critical').slice(0, 5);
    const recentNotifs = notifications.filter(n => !n.is_read).slice(0, 5);

    return (
        <div className="space-y-5">
            <div>
                <h3 className="text-base font-semibold text-primary-text">Dashboard do Comandante</h3>
                <p className="text-xs text-secondary-text mt-0.5">
                    Resumo operacional de {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
            </div>

            {/* KPI grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {kpis.map(kpi => {
                    const colorMap: Record<string, { bg: string; border: string; text: string; icon: string }> = {
                        'kpi-slate':  { bg: '#1e293b', border: '#334155', text: '#f1f5f9', icon: '#94a3b8' },
                        'kpi-green':  { bg: '#15803d', border: '#16a34a', text: '#f0fdf4', icon: '#86efac' },
                        'kpi-red':    { bg: '#dc2626', border: '#ef4444', text: '#fff1f2', icon: '#fca5a5' },
                        'kpi-blue':   { bg: '#1d4ed8', border: '#2563eb', text: '#eff6ff', icon: '#93c5fd' },
                        'kpi-amber':  { bg: '#b45309', border: '#d97706', text: '#fffbeb', icon: '#fcd34d' },
                        'kpi-orange': { bg: '#c2410c', border: '#ea580c', text: '#fff7ed', icon: '#fdba74' },
                    };
                    const c = colorMap[kpi.color] || colorMap['kpi-slate'];
                    return (
                        <button key={kpi.title}
                            onClick={() => kpi.tab && onNavigate(kpi.tab)}
                            style={{ backgroundColor: c.bg, borderColor: c.border }}
                            className="border rounded-xl p-3 text-left hover:brightness-110 transition-all">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="material-symbols-outlined text-base" style={{ color: c.icon }}>{kpi.icon}</span>
                                <span className="text-xs font-medium" style={{ color: c.text, opacity: 0.85 }}>{kpi.title}</span>
                            </div>
                            <p className="text-2xl font-bold" style={{ color: c.text }}>{kpi.value}</p>
                            <p className="text-xs mt-0.5" style={{ color: c.text, opacity: 0.7 }}>{kpi.subtitle}</p>
                        </button>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Critical alerts panel */}
                <div className="bg-white border border-gray-200 rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-base text-red-400">emergency</span>
                            <h4 className="text-sm font-semibold text-primary-text">Alertas Críticos</h4>
                        </div>
                        <button onClick={() => onNavigate('ALERTAS')} className="text-xs text-gray-500 hover:underline">Ver todos</button>
                    </div>
                    {criticalAlertsList.length === 0 ? (
                        <div className="text-center py-4 text-secondary-text">
                            <span className="material-symbols-outlined text-2xl block mb-1 opacity-30">check_circle</span>
                            <p className="text-xs">Nenhum alerta crítico</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {criticalAlertsList.map((a, i) => (
                                <div key={i} className="flex items-start gap-2 p-2 bg-white rounded-lg border-l-4" style={{ borderLeftColor: '#dc2626', borderTop: '1px solid #fee2e2', borderRight: '1px solid #fee2e2', borderBottom: '1px solid #fee2e2' }}>
                                    <span className="material-symbols-outlined text-sm shrink-0 mt-0.5" style={{ color: '#dc2626' }}>report</span>
                                    <div className="min-w-0">
                                        <p className="text-xs font-semibold text-gray-800 truncate">{a.personnelName}</p>
                                        <p className="text-xs text-gray-500">{a.message}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Recent unread notifications */}
                <div className="bg-white border border-gray-200 rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-base text-gray-500">notifications_active</span>
                            <h4 className="text-sm font-semibold text-primary-text">Notificações Recentes</h4>
                            {stats.unreadNotifications > 0 && (
                                <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-600 text-white font-medium">{stats.unreadNotifications}</span>
                            )}
                        </div>
                        <button onClick={() => onNavigate('NOTIFICACOES')} className="text-xs text-gray-500 hover:underline">Ver todas</button>
                    </div>
                    {recentNotifs.length === 0 ? (
                        <div className="text-center py-4 text-secondary-text">
                            <span className="material-symbols-outlined text-2xl block mb-1 opacity-30">notifications_none</span>
                            <p className="text-xs">Todas as notificações foram lidas</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {recentNotifs.map(n => (
                                <div key={n.id} className="p-2 bg-white rounded-lg border-l-4" style={{ borderLeftColor: '#2563eb', borderTop: '1px solid #dbeafe', borderRight: '1px solid #dbeafe', borderBottom: '1px solid #dbeafe' }}>
                                    <p className="text-xs font-semibold text-gray-800 truncate">{n.title}</p>
                                    <p className="text-xs text-gray-500 line-clamp-2">{n.message}</p>
                                    <p className="text-xs text-gray-400 mt-0.5">{n.time_ago}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Vacations upcoming */}
            {vacations.filter(v => v.start_date > today).slice(0, 3).length > 0 && (
                <div className="bg-primary border border-rustic-border rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="material-symbols-outlined text-base text-blue-400">beach_access</span>
                        <h4 className="text-sm font-semibold text-primary-text">Próximas Férias</h4>
                    </div>
                    <div className="space-y-1.5">
                        {vacations.filter(v => v.start_date > today && v.status !== 'cancelado').slice(0, 3).map(v => (
                            <div key={v.id} className="flex items-center justify-between text-sm px-1">
                                <span className="text-primary-text text-xs font-medium">{v.full_name}</span>
                                <span className="text-secondary-text text-xs">{new Date(v.start_date).toLocaleDateString('pt-BR')} → {new Date(v.end_date).toLocaleDateString('pt-BR')} ({v.day_count}d)</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
