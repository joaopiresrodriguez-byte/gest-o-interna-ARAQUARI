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

    const kpis: KpiCard[] = [
        { title: 'Efetivo Total', value: stats.totalPessoal, subtitle: 'militares cadastrados', icon: 'groups', color: 'border-cbm-red/30 bg-cbm-red/5', tab: 'EFETIVO' },
        { title: 'Disponíveis Hoje', value: stats.disponiveis, subtitle: `${stats.emFerias} em férias · ${stats.afastados} afastados`, icon: 'check_circle', color: 'border-emerald-500/30 bg-emerald-500/5', tab: 'DISPONIBILIDADE' },
        { title: 'Alertas Críticos', value: stats.criticalAlerts, subtitle: `${stats.warningAlerts} avisos`, icon: 'warning', color: `border-${stats.criticalAlerts > 0 ? 'red' : 'amber'}-500/30 bg-${stats.criticalAlerts > 0 ? 'red' : 'amber'}-500/5`, tab: 'ALERTAS' },
        { title: 'Notificações', value: stats.unreadNotifications, subtitle: `${notifications.length} total · ${stats.unreadNotifications} não lidas`, icon: 'notifications', color: `border-${stats.unreadNotifications > 0 ? 'cbm-red' : 'rustic-border'}/30`, tab: 'NOTIFICACOES' },
        { title: 'Qualificações', value: courses.length, subtitle: `${stats.expiredCourses} expiradas`, icon: 'school', color: `border-${stats.expiredCourses > 0 ? 'amber' : 'emerald'}-500/30 bg-${stats.expiredCourses > 0 ? 'amber' : 'emerald'}-500/5`, tab: 'CURSOS' },
        { title: 'EPIs / Uniformes', value: epiDeliveries.length, subtitle: `${stats.overdueEpi} com reposição vencida`, icon: 'checkroom', color: `border-${stats.overdueEpi > 0 ? 'amber' : 'emerald'}-500/30 bg-${stats.overdueEpi > 0 ? 'amber' : 'emerald'}-500/5`, tab: 'EPI' },
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
                {kpis.map(kpi => (
                    <button key={kpi.title}
                        onClick={() => kpi.tab && onNavigate(kpi.tab)}
                        className={`bg-primary border rounded-xl p-3 text-left hover:opacity-90 transition-opacity ${kpi.color}`}>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="material-symbols-outlined text-base text-secondary-text">{kpi.icon}</span>
                            <span className="text-xs text-secondary-text font-medium">{kpi.title}</span>
                        </div>
                        <p className="text-2xl font-bold text-primary-text">{kpi.value}</p>
                        <p className="text-xs text-secondary-text mt-0.5">{kpi.subtitle}</p>
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Critical alerts panel */}
                <div className="bg-primary border border-rustic-border rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-base text-red-400">emergency</span>
                            <h4 className="text-sm font-semibold text-primary-text">Alertas Críticos</h4>
                        </div>
                        <button onClick={() => onNavigate('ALERTAS')} className="text-xs text-cbm-red hover:underline">Ver todos</button>
                    </div>
                    {criticalAlertsList.length === 0 ? (
                        <div className="text-center py-4 text-secondary-text">
                            <span className="material-symbols-outlined text-2xl block mb-1 opacity-30">check_circle</span>
                            <p className="text-xs">Nenhum alerta crítico</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {criticalAlertsList.map((a, i) => (
                                <div key={i} className="flex items-start gap-2 p-2 bg-red-500/5 border border-red-500/20 rounded-lg">
                                    <span className="material-symbols-outlined text-sm text-red-400 shrink-0 mt-0.5">report</span>
                                    <div className="min-w-0">
                                        <p className="text-xs font-semibold text-primary-text truncate">{a.personnelName}</p>
                                        <p className="text-xs text-secondary-text">{a.message}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Recent unread notifications */}
                <div className="bg-primary border border-rustic-border rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-base text-cbm-red">notifications_active</span>
                            <h4 className="text-sm font-semibold text-primary-text">Notificações Recentes</h4>
                            {stats.unreadNotifications > 0 && (
                                <span className="text-xs px-1.5 py-0.5 rounded-full bg-cbm-red text-white font-medium">{stats.unreadNotifications}</span>
                            )}
                        </div>
                        <button onClick={() => onNavigate('NOTIFICACOES')} className="text-xs text-cbm-red hover:underline">Ver todas</button>
                    </div>
                    {recentNotifs.length === 0 ? (
                        <div className="text-center py-4 text-secondary-text">
                            <span className="material-symbols-outlined text-2xl block mb-1 opacity-30">notifications_none</span>
                            <p className="text-xs">Todas as notificações foram lidas</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {recentNotifs.map(n => (
                                <div key={n.id} className="p-2 bg-cbm-red/5 border border-cbm-red/20 rounded-lg">
                                    <p className="text-xs font-semibold text-primary-text truncate">{n.title}</p>
                                    <p className="text-xs text-secondary-text line-clamp-2">{n.message}</p>
                                    <p className="text-xs text-secondary-text/60 mt-0.5">{n.time_ago}</p>
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
