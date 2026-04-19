import React from 'react';
import { AlertItem } from '../../services/types';

interface Props {
    alerts: AlertItem[];
    onNavigateToProfile: (id: number) => void;
}

const severityConfig = {
    critical: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-600 text-white', icon: 'error' },
    warning: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-500 text-white', icon: 'warning' },
    info: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-500 text-white', icon: 'info' },
};

const AlertsDashboard: React.FC<Props> = ({ alerts, onNavigateToProfile }) => {
    const criticalCount = alerts.filter(a => a.severity === 'critical').length;
    const warningCount = alerts.filter(a => a.severity === 'warning').length;
    const infoCount = alerts.filter(a => a.severity === 'info').length;

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-red-600 text-white flex items-center justify-center">
                        <span className="material-symbols-outlined text-2xl">error</span>
                    </div>
                    <div>
                        <p className="text-3xl font-black text-red-700">{criticalCount}</p>
                        <p className="text-[10px] font-bold uppercase text-red-500 tracking-wider">Críticos / Expirados</p>
                    </div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-amber-500 text-white flex items-center justify-center">
                        <span className="material-symbols-outlined text-2xl">warning</span>
                    </div>
                    <div>
                        <p className="text-3xl font-black text-amber-700">{warningCount}</p>
                        <p className="text-[10px] font-bold uppercase text-amber-500 tracking-wider">Atenção / 60 dias</p>
                    </div>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-blue-500 text-white flex items-center justify-center">
                        <span className="material-symbols-outlined text-2xl">info</span>
                    </div>
                    <div>
                        <p className="text-3xl font-black text-blue-700">{infoCount}</p>
                        <p className="text-[10px] font-bold uppercase text-blue-500 tracking-wider">Informativos</p>
                    </div>
                </div>
            </div>

            {/* Alert List */}
            {alerts.length === 0 ? (
                <div className="text-center py-16 text-gray-300">
                    <span className="material-symbols-outlined text-6xl mb-4 block">verified</span>
                    <p className="font-bold text-lg">Nenhum alerta pendente</p>
                    <p className="text-sm">Todos os documentos e prazos estão em dia.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {alerts.map((alert, i) => {
                        const cfg = severityConfig[alert.severity];
                        return (
                            <div key={i} className={`${cfg.bg} ${cfg.border} border rounded-xl p-4 flex items-center gap-4 hover:shadow-md transition-all cursor-pointer`} onClick={() => onNavigateToProfile(alert.personnelId)}>
                                <span className={`material-symbols-outlined ${cfg.text}`}>{cfg.icon}</span>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <span className="font-bold text-sm truncate">{alert.personnelName}</span>
                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${cfg.badge} uppercase`}>{alert.alertType}</span>
                                    </div>
                                    <p className={`text-xs ${cfg.text} opacity-80`}>{alert.message}</p>
                                </div>
                                {alert.referenceDate && <span className="text-[10px] font-bold text-gray-400 whitespace-nowrap">{alert.referenceDate ? new Date(alert.referenceDate).toLocaleDateString('pt-BR') : ''}</span>}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default AlertsDashboard;
